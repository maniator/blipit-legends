/**
 * Round-robin schedule generator for League Mode v1.
 *
 * Produces a deterministic list of SeasonGameRecord rows from a set of season
 * team IDs, a games-per-team count, and a series length — using an isolated
 * sub-PRNG so that the schedule is reproducible and decoupled from any other
 * PRNG consumer in the app.
 *
 * Determinism contracts (binding — see _bmad-output/planning-artifacts/league-mode-distillate/02-data-model-routing-schedule.md):
 *   - teamIds are lex-sorted before any iteration (never use Set/Map iteration).
 *   - Sub-PRNG key: `${masterSeed}:schedule`, seeded as:
 *       mulberry32(parseInt(fnv1a(`${masterSeed}:schedule`), 16) >>> 0)
 *   - The local mulberry32 implementation MUST match rng.ts exactly — it is a
 *     LOCAL copy so it never perturbs the global game PRNG. Do not re-export it.
 *   - seriesId is constructed deterministically from team IDs + round index
 *     (no PRNG calls for seriesId assignment).
 */
import type { SeasonGameRecord } from "@feat/league/storage/types";
import { deriveScheduledGameSeed } from "@feat/league/utils/deriveScheduledGameSeed";

import { generateSeasonGameId } from "@storage/generateId";
import { fnv1a } from "@storage/hash";

// ---------------------------------------------------------------------------
// Local mulberry32 sub-PRNG
// ---------------------------------------------------------------------------
// This MUST be a byte-for-byte copy of the mulberry32 closure in rng.ts.
// It does NOT update the module-level rngInternalA in rng.ts — intentionally.
// Rationale: schedule generation is called at season-creation time, potentially
// before any game seeds are reinit'd. Using the global PRNG would perturb the
// sequence seen by games. An isolated copy guarantees independence.
// Source: src/shared/utils/rng.ts — keep in sync if the algorithm ever changes.
function makeMulberry32(seed: number): () => number {
  let a = seed;
  return (): number => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Berger circle round-robin builder
// ---------------------------------------------------------------------------

/**
 * Builds balanced round-robin rounds using the circle (Berger table) method.
 *
 * For even N: produces N-1 rounds, each with N/2 matchups — every team plays
 * exactly once per round (no byes, no double-booking).
 * For odd N: adds a virtual "__bye__" to make N+1 (even), producing N rounds
 * with floor(N/2) real matchups per round — each team gets exactly 1 bye.
 *
 * Pairs within each round are yielded as [teamA, teamB] where A < B (lex).
 * The PRNG coin-flip for home/away is done by the caller per series.
 *
 * All iteration uses sorted arrays — no Set/Map order dependency.
 */
function buildBergerRounds(sorted: string[]): Array<Array<[string, string]>> {
  const n = sorted.length;
  const isOdd = n % 2 !== 0;
  // For odd N, append a null sentinel to make the count even.
  const teams: (string | null)[] = isOdd ? [...sorted, null] : [...sorted];
  const total = teams.length; // always even

  const fixed = teams[0];
  // rotating is the mutable part of the circle
  const rotating: (string | null)[] = teams.slice(1);
  const rounds: Array<Array<[string, string]>> = [];

  for (let r = 0; r < total - 1; r++) {
    const circle: (string | null)[] = [fixed, ...rotating];
    const round: Array<[string, string]> = [];

    for (let i = 0; i < total / 2; i++) {
      const t1 = circle[i];
      const t2 = circle[total - 1 - i];
      // Skip any matchup involving the bye slot.
      if (t1 !== null && t2 !== null) {
        // Always store in lex order for deterministic seriesId construction.
        round.push(t1 < t2 ? [t1, t2] : [t2, t1]);
      }
    }

    rounds.push(round);

    // Rotate the non-fixed portion one step clockwise.
    const last = rotating.pop()!;
    rotating.unshift(last);
  }

  return rounds;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface GenerateScheduleInput {
  masterSeed: string;
  /**
   * customTeamId[] — will be lex-sorted before use.
   * Pass all team IDs for the season (all leagues combined if multi-league).
   */
  teamIds: string[];
  gamesPerTeam: number;
  seriesLength: number;
  seasonId: string;
  /**
   * Maps customTeamId → seasonTeamId for the FK fields on SeasonGameRecord.
   * Every teamId in `teamIds` must have an entry here.
   */
  seasonTeamIdByCustomTeamId: Record<string, string>;
}

export interface GenerateScheduleResult {
  games: Omit<SeasonGameRecord, "claimedBy">[];
}

/**
 * Generates a balanced round-robin schedule with no-double-booking guarantee.
 *
 * Uses the Berger circle method so each team plays at most once per game day.
 * Game days are assigned as: roundIndex * seriesLength + gameInSeries.
 *
 * Throws if:
 *   - `teamIds` has fewer than 2 entries
 *   - `gamesPerTeam` is not achievable with the given team count and seriesLength
 *   - any teamId is missing from `seasonTeamIdByCustomTeamId`
 */
export function generateSchedule(input: GenerateScheduleInput): GenerateScheduleResult {
  const { masterSeed, teamIds, gamesPerTeam, seriesLength, seasonId, seasonTeamIdByCustomTeamId } =
    input;

  if (teamIds.length < 2) {
    throw new Error(`[generateSchedule] Need at least 2 teams; got ${teamIds.length}`);
  }

  // Lex-sort — PRNG call order must be deterministic (binding contract).
  const sorted = [...teamIds].sort();

  // Validate every team has a seasonTeamId mapping.
  for (const tid of sorted) {
    if (!seasonTeamIdByCustomTeamId[tid]) {
      throw new Error(
        `[generateSchedule] customTeamId "${tid}" has no entry in seasonTeamIdByCustomTeamId`,
      );
    }
  }

  const n = sorted.length;
  // Each team plays against every other team.
  const opponents = n - 1;

  // seriesPerPair: how many times each pair meets.
  // Must be a positive integer — validate and throw early.
  if (gamesPerTeam % (opponents * seriesLength) !== 0) {
    throw new Error(
      `[generateSchedule] gamesPerTeam=${gamesPerTeam} is not evenly divisible by ` +
        `(opponents=${opponents} × seriesLength=${seriesLength}). ` +
        `Choose a gamesPerTeam that satisfies: gamesPerTeam % ${opponents * seriesLength} === 0`,
    );
  }

  const seriesPerPair = gamesPerTeam / (opponents * seriesLength);

  // Build sub-PRNG for schedule generation (isolated — does not touch global PRNG).
  const schedSeedHex = fnv1a(`${masterSeed}:schedule`);
  const schedSeedUint32 = parseInt(schedSeedHex, 16) >>> 0;
  const schedRng = makeMulberry32(schedSeedUint32);

  // Build the Berger round structure (one full round-robin).
  // rounds[r] = array of [teamA, teamB] pairs for round r.
  const bergerRounds = buildBergerRounds(sorted);
  const numBergerRounds = bergerRounds.length;

  const games: Omit<SeasonGameRecord, "claimedBy">[] = [];

  // For each repetition pass, iterate through all Berger rounds.
  // round index in the full season = pass * numBergerRounds + r
  // game day within that season round = seasonRoundIdx * seriesLength + g
  for (let pass = 0; pass < seriesPerPair; pass++) {
    for (let r = 0; r < numBergerRounds; r++) {
      const seasonRoundIdx = pass * numBergerRounds + r;
      const pairsInRound = bergerRounds[r];

      for (const [ctA, ctB] of pairsInRound) {
        // Home/away decided by the sub-PRNG coin flip per series.
        const homeFirst = schedRng() < 0.5;
        const homeCtId = homeFirst ? ctA : ctB;
        const awayCtId = homeFirst ? ctB : ctA;

        // seriesId is deterministic from team IDs + pass + round index.
        // [ctA, ctB] are already in lex order from buildBergerRounds.
        const seriesId = `${seasonId}:${ctA}:${ctB}:p${pass}r${r}`;

        for (let g = 0; g < seriesLength; g++) {
          // Game day: each season round occupies seriesLength consecutive days.
          const gameDay = seasonRoundIdx * seriesLength + g;
          const gameId = generateSeasonGameId();
          // Use stable customTeamIds (homeCtId/awayCtId) as seed inputs, not
          // the random seasonTeamIds. seasonTeamIds are nanoid-generated and
          // differ across two createSeason calls with the same masterSeed,
          // which would break the "same seed → identical outcomes" contract.
          // customTeamIds are persistent across calls and produce stable seeds.
          const derivedSeed = deriveScheduledGameSeed({
            seasonId,
            seasonRoundIdx,
            gameInSeriesIdx: g,
            homeCustomTeamId: homeCtId,
            awayCustomTeamId: awayCtId,
          });
          games.push({
            id: gameId,
            seasonId,
            gameDay,
            homeSeasonTeamId: seasonTeamIdByCustomTeamId[homeCtId],
            awaySeasonTeamId: seasonTeamIdByCustomTeamId[awayCtId],
            seriesId,
            status: "scheduled",
            boxscore: null,
            derivedSeed,
            completedAt: null,
          });
        }
      }
    }
  }

  return { games };
}
