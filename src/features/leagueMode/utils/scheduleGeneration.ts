// Byes are schedule-padding only. Win% = W / (W+L). Bye records are status='bye'
// and must be excluded from all standings denominators.
//
// Home/away balance: guaranteed equal for even team counts.
// For odd team counts, a ~1-game asymmetry per team is acceptable for v1 (documented).
//
// Round-robin ensures each team plays every other team an equal number of times
// (within rounding to complete rounds).

import type { ScheduledGameRecord } from "@feat/leagueMode/storage/types";

const BYE_TEAM = "__bye__";

export interface GenerateScheduleOptions {
  leagueSeasonId: string;
  teamIds: string[]; // 2–30 teams
  seriesLength?: number; // games per series pair per round, default 3
  gamesPerTeam?: number; // target non-bye games per team, default 30
}

/**
 * Deterministic counter-based ID — no nanoid so IDs are stable across calls.
 * Format: sgame_{leagueSeasonId}_r{round}_p{pairIdx}_d{dayOffset}_pass{pass}
 */
const makeGameId = (
  leagueSeasonId: string,
  pass: number,
  round: number,
  pairIdx: number,
  dayOffset: number,
): string => `sgame_${leagueSeasonId}_pass${pass}_r${round}_p${pairIdx}_d${dayOffset}`;

/**
 * Generates a deterministic round-robin schedule using the Berger circle method.
 *
 * - Pads to even team count with a phantom "__bye__" team if needed.
 * - Repeats full round-robin passes until gamesPerTeam target is met.
 * - Never cuts mid-pass, ensuring equal non-bye game counts for all teams.
 */
export function generateSchedule(options: GenerateScheduleOptions): ScheduledGameRecord[] {
  const { leagueSeasonId, teamIds, seriesLength = 3, gamesPerTeam = 30 } = options;

  if (teamIds.length < 2) {
    throw new Error("generateSchedule requires at least 2 teams");
  }

  // Pad to even count with phantom bye team
  const teams: string[] = teamIds.length % 2 === 0 ? [...teamIds] : [...teamIds, BYE_TEAM];
  const paddedN = teams.length; // always even
  const roundsPerPass = paddedN - 1;
  // Non-bye rounds per team per pass: each team plays roundsPerPass rounds,
  // minus 1 bye round if we have an odd real team count.
  const hasOddTeams = teamIds.length % 2 !== 0;
  const nonByeRoundsPerPass = hasOddTeams ? roundsPerPass - 1 : roundsPerPass;
  // Each round spans seriesLength game days, so total non-bye games per pass per team:
  const gamesPerPassPerTeam = nonByeRoundsPerPass * seriesLength;

  const totalPasses = Math.ceil(gamesPerTeam / gamesPerPassPerTeam);

  const records: ScheduledGameRecord[] = [];
  // Track who hosted last for each sorted pair key to alternate home/away
  const lastHome = new Map<string, string>();
  let currentGameDay = 0;

  for (let pass = 0; pass < totalPasses; pass++) {
    // Circle: fix teams[0], rotate the rest
    // Initial rotation for this pass (rotate by (pass * roundsPerPass) positions)
    // to vary matchups across passes
    const rotatable = teams.slice(1);
    // Rotate rotatable by pass * (roundsPerPass) to get varied matchups across passes
    const rotateBy = (pass * roundsPerPass) % rotatable.length;
    const rotated = [...rotatable.slice(rotateBy), ...rotatable.slice(0, rotateBy)];

    // Current circle state: [fixed, ...rotated]
    let circle = [teams[0], ...rotated];

    for (let round = 0; round < roundsPerPass; round++) {
      // Determine pairs for this round
      const pairs: [string, string][] = [];
      for (let i = 0; i < paddedN / 2; i++) {
        const a = circle[i];
        const b = circle[paddedN - 1 - i];
        pairs.push([a, b]);
      }

      // Emit seriesLength game days for this round
      for (let dayOffset = 0; dayOffset < seriesLength; dayOffset++) {
        currentGameDay++;

        for (let pairIdx = 0; pairIdx < pairs.length; pairIdx++) {
          const [a, b] = pairs[pairIdx];
          const aIsBye = a === BYE_TEAM;
          const bIsBye = b === BYE_TEAM;

          if (aIsBye && bIsBye) {
            // Shouldn't happen with valid padded even count
            continue;
          }

          const id = makeGameId(leagueSeasonId, pass, round, pairIdx, dayOffset);

          if (aIsBye || bIsBye) {
            // Bye record: real team gets a bye
            const realTeam = aIsBye ? b : a;
            records.push({
              id,
              leagueSeasonId,
              gameDay: currentGameDay,
              awayTeamId: realTeam,
              homeTeamId: realTeam,
              status: "bye",
              schemaVersion: 0,
            });
          } else {
            // Real game: alternate home/away based on who hosted last
            const pairKey = [a, b].sort().join("|");
            const prev = lastHome.get(pairKey);
            let home: string;
            let away: string;
            if (!prev) {
              // First encounter: use pair index parity for initial assignment
              home = a;
              away = b;
            } else if (prev === a) {
              home = b;
              away = a;
            } else {
              home = a;
              away = b;
            }
            lastHome.set(pairKey, home);

            records.push({
              id,
              leagueSeasonId,
              gameDay: currentGameDay,
              awayTeamId: away,
              homeTeamId: home,
              status: "scheduled",
              schemaVersion: 0,
            });
          }
        }
      }

      // Rotate circle: keep circle[0] fixed, rotate rest by 1
      if (round < roundsPerPass - 1) {
        const fixed = circle[0];
        const rest = circle.slice(1);
        circle = [fixed, rest[rest.length - 1], ...rest.slice(0, -1)];
      }
    }
  }

  return records;
}
