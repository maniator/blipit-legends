/**
 * Pure season standings derivation — no DB access.
 *
 * Derives per-team standings from completed SeasonGameRecord rows.
 * Aggregates wins, losses, ties, and run differential, then sorts by:
 *   1. winPct DESC (wins + 0.5 × ties) / gamesPlayed
 *   2. runDifferential DESC
 *   3. seasonTeamId ASC (stability)
 *
 * Caller is responsible for loading the completed games from RxDB and passing
 * them here. This function is intentionally a pure transform.
 */
import type { SeasonGameRecord } from "@feat/league/storage/types";

interface BoxscoreResult {
  homeScore: number;
  awayScore: number;
}

export interface TeamStandingRow {
  seasonTeamId: string;
  wins: number;
  losses: number;
  ties: number;
  /** (wins + 0.5 × ties) / gamesPlayed. 0 when no games played. */
  winPct: number;
  runDifferential: number;
}

/**
 * Derives sorted standings from a list of completed season games.
 *
 * @param completedGames - Only rows with status === 'completed' contribute.
 *   Games with null/undefined boxscore are skipped.
 * @param seasonTeamIds - All season team IDs in the league. Teams with no games
 *   appear at the bottom with 0–0 records.
 */
export function deriveStandings(
  completedGames: SeasonGameRecord[],
  seasonTeamIds: string[],
): TeamStandingRow[] {
  const rows = new Map<string, TeamStandingRow>();

  // Initialize all teams with zeroed records.
  for (const id of seasonTeamIds) {
    rows.set(id, { seasonTeamId: id, wins: 0, losses: 0, ties: 0, winPct: 0, runDifferential: 0 });
  }

  for (const game of completedGames) {
    if (game.status !== "completed") continue;
    if (!game.boxscore) continue;

    const bs = game.boxscore as unknown as BoxscoreResult;
    const homeScore = typeof bs.homeScore === "number" ? bs.homeScore : null;
    const awayScore = typeof bs.awayScore === "number" ? bs.awayScore : null;
    if (homeScore === null || awayScore === null) continue;

    const home = rows.get(game.homeSeasonTeamId);
    const away = rows.get(game.awaySeasonTeamId);
    if (!home || !away) continue;

    const diff = homeScore - awayScore;

    if (homeScore > awayScore) {
      home.wins++;
      away.losses++;
    } else if (awayScore > homeScore) {
      away.wins++;
      home.losses++;
    } else {
      home.ties++;
      away.ties++;
    }

    home.runDifferential += diff;
    away.runDifferential -= diff;
  }

  // Compute winPct and sort.
  const result = [...rows.values()].map((row) => {
    const gamesPlayed = row.wins + row.losses + row.ties;
    const winPct = gamesPlayed > 0 ? (row.wins + 0.5 * row.ties) / gamesPlayed : 0;
    return { ...row, winPct };
  });

  result.sort((a, b) => {
    if (b.winPct !== a.winPct) return b.winPct - a.winPct;
    if (b.runDifferential !== a.runDifferential) return b.runDifferential - a.runDifferential;
    return a.seasonTeamId.localeCompare(b.seasonTeamId);
  });

  return result;
}
