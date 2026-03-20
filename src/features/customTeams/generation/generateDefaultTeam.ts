import { HITTER_STAT_CAP, PITCHER_STAT_CAP } from "@feat/customTeams/statBudget";
import { BATTING_POSITIONS } from "@shared/utils/roster";

import { CITIES, FIRST_NAMES, LAST_NAMES, NICKNAMES } from "./nameConstants";
import { splitBudgetNatural } from "./splitBudgetNatural";

export interface GeneratedPlayer {
  id: string;
  name: string;
  role: "batter" | "pitcher";
  position?: string;
  handedness?: "R" | "L" | "S";
  batting: { contact: number; power: number; speed: number; stamina: number };
  pitching?: { velocity: number; control: number; movement: number; stamina: number };
  pitchingRole?: "SP" | "RP" | "SP/RP";
}

export interface CustomTeamDraft {
  name: string;
  /** 2–3 char generated abbreviation derived from city + nickname. */
  abbreviation: string;
  city: string;
  nickname: string;
  roster: {
    lineup: GeneratedPlayer[];
    bench: GeneratedPlayer[];
    pitchers: GeneratedPlayer[];
  };
}

const makeMulberry32 = (a: number): (() => number) => {
  return (): number => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const seedToNumber = (seed: string | number): number => {
  if (typeof seed === "number") return seed >>> 0;
  const parsed = parseInt(seed, 36);
  if (Number.isFinite(parsed)) return parsed >>> 0;
  return seed.split("").reduce((acc, c) => ((acc << 5) - acc + c.charCodeAt(0)) | 0, 0) >>> 0;
};

const pickFrom = <T>(rng: () => number, arr: ReadonlyArray<T>): T =>
  arr[Math.floor(rng() * arr.length)];

/** Fisher-Yates in-place shuffle using the seeded RNG. Returns the same array. */
const shuffle = <T>(rng: () => number, arr: T[]): T[] => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

export function generateDefaultCustomTeamDraft(seed: string | number): CustomTeamDraft {
  const rng = makeMulberry32(seedToNumber(seed));

  const city = pickFrom(rng, CITIES);
  const nickname = pickFrom(rng, NICKNAMES);

  /** Pick a batting handedness: 65% R, 25% L, 10% S. */
  const pickHandedness = (): "R" | "L" | "S" => {
    const r = rng();
    if (r < 0.65) return "R";
    if (r < 0.9) return "L";
    return "S";
  };

  /** Pick a full name that hasn't been used yet; retries on collision. */
  const usedNames = new Set<string>();
  const pickUniqueName = (): string => {
    for (let attempt = 0; attempt < 50; attempt++) {
      const name = `${pickFrom(rng, FIRST_NAMES)} ${pickFrom(rng, LAST_NAMES)}`;
      if (!usedNames.has(name.toLowerCase())) {
        usedNames.add(name.toLowerCase());
        return name;
      }
    }
    // Fallback: suffix with slot index — practically unreachable with 676 combos and ≤18 players.
    const name = `${pickFrom(rng, FIRST_NAMES)} ${pickFrom(rng, LAST_NAMES)} ${usedNames.size + 1}`;
    usedNames.add(name.toLowerCase());
    return name;
  };

  /** Generate batting stats using the full HITTER_STAT_CAP budget, distributed naturally. */
  const randBatterStats = (): {
    contact: number;
    power: number;
    speed: number;
    stamina: number;
  } => {
    const [ec, ep, es] = splitBudgetNatural(rng, {
      budget: HITTER_STAT_CAP - 3 * 20,
      maxEach: 100 - 20,
    });
    return { contact: 20 + ec, power: 20 + ep, speed: 20 + es, stamina: 50 };
  };

  /** Generate pitching stats using the full PITCHER_STAT_CAP budget, distributed naturally. */
  const randPitcherPitchingStats = (): {
    velocity: number;
    control: number;
    movement: number;
    stamina: number;
  } => {
    const [ev, ec, em] = splitBudgetNatural(rng, {
      budget: PITCHER_STAT_CAP - 3 * 25,
      maxEach: 100 - 25,
    });
    return { velocity: 25 + ev, control: 25 + ec, movement: 25 + em, stamina: 60 };
  };

  // Shuffle batting positions so the batting order varies per seed.
  // All 9 required positions (including DH) are still present, just in a random order.
  const shuffledPositions = shuffle(rng, [...BATTING_POSITIONS]);

  const lineup: GeneratedPlayer[] = Array.from({ length: 9 }, (_, i) => ({
    id: `p_${seed}_L${i}`,
    name: pickUniqueName(),
    role: "batter" as const,
    position: shuffledPositions[i] ?? "DH",
    handedness: pickHandedness(),
    // Distribute the hitter budget naturally: each stat ≥ 20, total = HITTER_STAT_CAP exactly.
    batting: randBatterStats(),
  }));

  // Shuffle a copy of all batting positions for bench assignments so bench composition varies per seed.
  const benchPositionPool = shuffle(rng, [...BATTING_POSITIONS]);
  const bench: GeneratedPlayer[] = Array.from({ length: 4 }, (_, i) => ({
    id: `p_${seed}_B${i}`,
    name: pickUniqueName(),
    role: "batter" as const,
    position: benchPositionPool[i % benchPositionPool.length],
    handedness: pickHandedness(),
    // Distribute the hitter budget naturally: each stat ≥ 20, total = HITTER_STAT_CAP exactly.
    batting: randBatterStats(),
  }));

  // Shuffle bullpen roles: always 1 SP starter, then 4 relievers with varied SP/RP composition.
  const bullpenRoles = shuffle(rng, ["RP", "RP", "RP", "SP/RP"] as ("RP" | "SP/RP")[]);
  const pitchers: GeneratedPlayer[] = Array.from({ length: 5 }, (_, i) => {
    const pitchingRole: "SP" | "RP" | "SP/RP" = i === 0 ? "SP" : bullpenRoles[i - 1];
    return {
      id: `p_${seed}_P${i}`,
      name: pickUniqueName(),
      role: "pitcher" as const,
      position: i === 0 ? "SP" : "RP",
      pitchingRole,
      handedness: pickHandedness(),
      // Distribute the hitter budget naturally: each stat ≥ 20, total = HITTER_STAT_CAP exactly.
      batting: randBatterStats(),
      // Distribute the pitcher budget naturally: each stat ≥ 25, total = PITCHER_STAT_CAP exactly.
      pitching: randPitcherPitchingStats(),
    };
  });

  return {
    name: nickname,
    abbreviation: makeAbbreviation(city, nickname),
    city,
    nickname,
    roster: { lineup, bench, pitchers },
  };
}

/**
 * Derives a deterministic 2–3 char abbreviation from city + nickname.
 * Strategy:
 * - 3+ word city: first letter of each of the first 3 words.
 * - 2-word city: first letter of each word + first letter of nickname.
 * - Single-word city: first 2 letters of city + first letter of nickname.
 */
export function makeAbbreviation(city: string, nickname: string): string {
  const cityWords = city.trim().toUpperCase().split(/\s+/).filter(Boolean);
  const nickChar = nickname.trim().toUpperCase()[0] ?? "X";
  if (cityWords.length >= 3) {
    return cityWords
      .slice(0, 3)
      .map((w) => w[0])
      .join("");
  }
  if (cityWords.length === 2) {
    return cityWords.map((w) => w[0]).join("") + nickChar;
  }
  // Single-word city: first 2 letters of city + first letter of nickname
  const c = cityWords[0] ?? "X";
  return (c.slice(0, 2) + nickname.trim().toUpperCase()[0]).slice(0, 3);
}
