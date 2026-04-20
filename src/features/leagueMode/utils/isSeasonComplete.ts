import type { LeagueSeasonRecord, ScheduledGameRecord } from "../storage/types";

/**
 * Returns true when the season is fully complete.
 *
 * A season is complete when either:
 *   (1) Every non-bye game has status "completed", OR
 *   (2) `currentGameDay >= totalGameDays` and there are no remaining "scheduled" games.
 */
export function isSeasonComplete(
  season: LeagueSeasonRecord,
  games: ScheduledGameRecord[],
): boolean {
  const nonByeGames = games.filter((g) => g.status !== "bye");

  // Condition 1: all non-bye games completed
  if (nonByeGames.length > 0 && nonByeGames.every((g) => g.status === "completed")) {
    return true;
  }

  // Condition 2: day limit reached and no scheduled games remain
  if (
    season.currentGameDay >= season.totalGameDays &&
    !nonByeGames.some((g) => g.status === "scheduled")
  ) {
    return true;
  }

  return false;
}
