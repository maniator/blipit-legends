import { buildRoster } from "@feat/customTeams/storage/customTeamSanitizers";

import { fnv1a } from "@storage/hash";
import type { TeamRoster } from "@storage/types";

export const AUTOGEN_VERSION = 1;

export type AutogenTheme = "classic" | "scifi" | "whimsical" | "mix";
export type AutogenParity = "balanced" | "mixed" | "random";

export interface RosterMinimums {
  lineup: number;
  bench: number;
  startingPitchers: number;
  reliefPitchers: number;
}

export interface GenerateLeagueTeamsOptions {
  count: number;
  theme: AutogenTheme;
  parity: AutogenParity;
  masterSeed: string;
  autogenSubSeed: string;
  rosterMinimums: RosterMinimums;
  idFactory?: {
    teamId?: (index?: number) => string;
    playerId?: (index?: number) => string;
  };
}

export interface AutogenMarker {
  version: 1;
  theme: AutogenTheme;
  parity: AutogenParity;
  baseSeed: string;
}

export interface GeneratedLeagueTeam {
  id: string;
  name: string;
  abbreviation: string;
  city: string;
  nickname: string;
  slug: string;
  roster: TeamRoster;
  autogen: AutogenMarker;
  metadata: { tags: string[] };
  statsProfile: string;
}

const CLASSIC_CITIES = [
  "Albany",
  "Boise",
  "Cedar",
  "Dover",
  "Erie",
  "Fresno",
  "Galena",
  "Helena",
  "Ithaca",
  "Juneau",
  "Kenmore",
  "Laredo",
  "Mesa",
  "Nashua",
  "Ogden",
  "Peoria",
  "Quincy",
  "Reno",
  "Salem",
  "Toledo",
  "Utica",
  "Ventura",
  "Waco",
  "Yakima",
];
const CLASSIC_NICKS = [
  "Foxes",
  "Owls",
  "Cubs",
  "Bears",
  "Hawks",
  "Stags",
  "Larks",
  "Otters",
  "Wolves",
  "Kings",
  "Marlins",
  "Bison",
  "Pilots",
  "Comets",
  "Ravens",
  "Tigers",
  "Suns",
  "Knights",
  "Rockets",
  "Herons",
  "Vipers",
  "Lions",
  "Moose",
  "Gulls",
];
const SCIFI_CITIES = [
  "Vega",
  "Andromeda",
  "Orion",
  "Europa",
  "Titan",
  "Ceres",
  "Nova",
  "Pulsar",
  "Zenith",
  "Kepler",
  "Altair",
  "Sirius",
];
const SCIFI_NICKS = [
  "Pilots",
  "Wardens",
  "Rangers",
  "Ionics",
  "Voyagers",
  "Sentinels",
  "Lasers",
  "Orbiters",
  "Comets",
  "Drones",
  "Novas",
  "Phantoms",
];
const WHIMSICAL_CITIES = [
  "Pickle",
  "Waffle",
  "Muffin",
  "Noodle",
  "Taco",
  "Banana",
  "Donut",
  "Pretzel",
  "Cocoa",
  "Biscuit",
  "Cupcake",
  "Gumbo",
];
const WHIMSICAL_NICKS = [
  "Jugglers",
  "Stompers",
  "Whistlers",
  "Bouncers",
  "Wigglers",
  "Zoomers",
  "Paddlers",
  "Nibblers",
  "Hoppers",
  "Twirllers",
  "Launchers",
  "Scooters",
];

const FIRST_NAMES = [
  "Alex",
  "Bailey",
  "Casey",
  "Devon",
  "Elliot",
  "Finley",
  "Gray",
  "Harper",
  "Indy",
  "Jordan",
  "Kai",
  "Logan",
  "Morgan",
  "Nico",
  "Parker",
  "Quinn",
  "Riley",
  "Sawyer",
  "Taylor",
  "Vaughn",
  "Wes",
  "Yuri",
  "Zion",
];
const LAST_NAMES = [
  "Archer",
  "Bennett",
  "Cruz",
  "Diaz",
  "Ellis",
  "Foster",
  "Grant",
  "Hayes",
  "Irwin",
  "Jensen",
  "Knight",
  "Lopez",
  "Mason",
  "Nolan",
  "Ortiz",
  "Price",
  "Reed",
  "Stone",
  "Torres",
  "Usher",
  "Vega",
  "West",
  "Young",
];

const LINEUP_POSITIONS = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH"];
const BENCH_POSITIONS = ["C", "IF", "OF"];

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, items: T[]): T {
  return items[Math.floor(rng() * items.length)];
}

function seededRng(masterSeed: string, autogenSubSeed: string): () => number {
  return mulberry32(parseInt(fnv1a(`${masterSeed}:autogen:${autogenSubSeed}`), 16) >>> 0);
}

function resolveTheme(rng: () => number, theme: AutogenTheme): Exclude<AutogenTheme, "mix"> {
  if (theme !== "mix") return theme;
  return pick(rng, ["classic", "scifi", "whimsical"] as const);
}

function wordLists(theme: Exclude<AutogenTheme, "mix">): { cities: string[]; nicknames: string[] } {
  if (theme === "scifi") return { cities: SCIFI_CITIES, nicknames: SCIFI_NICKS };
  if (theme === "whimsical") return { cities: WHIMSICAL_CITIES, nicknames: WHIMSICAL_NICKS };
  return { cities: CLASSIC_CITIES, nicknames: CLASSIC_NICKS };
}

function teamStrength(rng: () => number, parity: AutogenParity): number {
  const spread = parity === "balanced" ? 0.05 : parity === "mixed" ? 0.15 : 0.3;
  return 1 + (rng() * 2 - 1) * spread;
}

function boundedStat(value: number): number {
  return Math.max(25, Math.min(80, Math.round(value)));
}

function batterStats(rng: () => number, strength: number, position: string) {
  const defenseBias = position === "C" || position === "SS" || position === "CF" ? -4 : 0;
  const powerBias =
    position === "1B" || position === "LF" || position === "RF" || position === "DH" ? 5 : 0;
  const contact = boundedStat((48 + rng() * 12 + defenseBias) * strength);
  const power = boundedStat((42 + rng() * 14 + powerBias) * strength);
  const speed = boundedStat((38 + rng() * 14 + (position === "CF" ? 6 : 0)) * strength);
  const total = contact + power + speed;
  if (total <= 150) return { contact, power, speed, stamina: boundedStat(55 + rng() * 25) };
  const scale = 150 / total;
  return {
    contact: Math.floor(contact * scale),
    power: Math.floor(power * scale),
    speed: Math.floor(speed * scale),
    stamina: boundedStat(55 + rng() * 25),
  };
}

function pitcherStats(rng: () => number, strength: number, role: "SP" | "RP") {
  const staminaBase = role === "SP" ? 72 : 48;
  const velocity = boundedStat((48 + rng() * 16 + (role === "RP" ? 4 : 0)) * strength);
  const control = boundedStat((46 + rng() * 16) * strength);
  const movement = boundedStat((44 + rng() * 16) * strength);
  const total = velocity + control + movement;
  if (total <= 160)
    return { velocity, control, movement, stamina: boundedStat(staminaBase + rng() * 18) };
  const scale = 160 / total;
  return {
    velocity: Math.floor(velocity * scale),
    control: Math.floor(control * scale),
    movement: Math.floor(movement * scale),
    stamina: boundedStat(staminaBase + rng() * 18),
  };
}

function playerName(rng: () => number, used: Set<string>): string {
  for (let i = 0; i < 100; i++) {
    const name = `${pick(rng, FIRST_NAMES)} ${pick(rng, LAST_NAMES)}`;
    if (!used.has(name)) {
      used.add(name);
      return name;
    }
  }
  const name = `${pick(rng, FIRST_NAMES)} ${pick(rng, LAST_NAMES)} ${used.size + 1}`;
  used.add(name);
  return name;
}

function handedness(rng: () => number, pitcher: boolean): "R" | "L" | "S" {
  const roll = rng();
  if (pitcher) return roll < 0.3 ? "L" : "R";
  if (roll < 0.1) return "S";
  return roll < 0.35 ? "L" : "R";
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function generateLeagueTeams(options: GenerateLeagueTeamsOptions): GeneratedLeagueTeam[] {
  const { count, theme, parity, masterSeed, autogenSubSeed, rosterMinimums } = options;
  if (!Number.isInteger(count) || count < 1) throw new Error("count must be a positive integer");
  if (
    rosterMinimums.lineup < 9 ||
    rosterMinimums.bench < 3 ||
    rosterMinimums.startingPitchers < 5 ||
    rosterMinimums.reliefPitchers < 3
  ) {
    throw new Error("rosterMinimums must meet v1 minimums: lineup 9, bench 3, 5 SP, 3 RP");
  }
  const rng = seededRng(masterSeed, autogenSubSeed);
  const baseSeed = `${masterSeed}:autogen:${autogenSubSeed}`;
  const teamId =
    options.idFactory?.teamId ??
    ((index?: number) => `ct_auto_${fnv1a(`${baseSeed}:team:${index ?? 0}`)}`);
  const playerId =
    options.idFactory?.playerId ??
    ((index?: number) => `p_auto_${fnv1a(`${baseSeed}:player:${index ?? 0}`)}`);
  let playerIndex = 0;
  const nextPlayerId = () => playerId(playerIndex++);
  const usedTeamNames = new Set<string>();

  return Array.from({ length: count }, (_, teamIndex) => {
    const actualTheme = resolveTheme(rng, theme);
    const { cities, nicknames } = wordLists(actualTheme);
    let city = pick(rng, cities);
    let nickname = pick(rng, nicknames);
    let name = `${city} ${nickname}`;
    let attempts = 0;
    while (usedTeamNames.has(name) && attempts < cities.length * nicknames.length) {
      city = pick(rng, cities);
      nickname = pick(rng, nicknames);
      name = `${city} ${nickname}`;
      attempts++;
    }
    if (usedTeamNames.has(name)) name = `${name} ${teamIndex + 1}`;
    usedTeamNames.add(name);

    const strength = teamStrength(rng, parity);
    const usedPlayerNames = new Set<string>();
    const lineup = Array.from({ length: rosterMinimums.lineup }, (_, i) => {
      const position = LINEUP_POSITIONS[i % LINEUP_POSITIONS.length];
      return {
        id: nextPlayerId(),
        role: "batter" as const,
        name: playerName(rng, usedPlayerNames),
        position,
        handedness: handedness(rng, false),
        batting: batterStats(rng, strength, position),
      };
    });
    const bench = Array.from({ length: rosterMinimums.bench }, (_, i) => {
      const position = BENCH_POSITIONS[i % BENCH_POSITIONS.length];
      return {
        id: nextPlayerId(),
        role: "batter" as const,
        name: playerName(rng, usedPlayerNames),
        position,
        handedness: handedness(rng, false),
        isBenchEligible: true,
        batting: batterStats(rng, strength * 0.95, position),
      };
    });
    const pitchers = [
      ...Array.from({ length: rosterMinimums.startingPitchers }, () => ({
        id: nextPlayerId(),
        role: "pitcher" as const,
        name: playerName(rng, usedPlayerNames),
        position: "P",
        handedness: handedness(rng, true),
        isPitcherEligible: true,
        pitchingRole: "SP" as const,
        pitching: pitcherStats(rng, strength, "SP"),
      })),
      ...Array.from({ length: rosterMinimums.reliefPitchers }, () => ({
        id: nextPlayerId(),
        role: "pitcher" as const,
        name: playerName(rng, usedPlayerNames),
        position: "P",
        handedness: handedness(rng, true),
        isPitcherEligible: true,
        pitchingRole: "RP" as const,
        pitching: pitcherStats(rng, strength, "RP"),
      })),
    ];

    const roster = buildRoster({ lineup, bench, pitchers });
    const abbreviation = nickname.slice(0, 3).toUpperCase();
    return {
      id: teamId(teamIndex),
      name,
      abbreviation,
      city,
      nickname,
      slug: slugify(name),
      roster,
      metadata: { tags: ["autogen"] },
      statsProfile: parity,
      autogen: {
        version: AUTOGEN_VERSION,
        theme,
        parity,
        baseSeed,
      },
    };
  });
}
