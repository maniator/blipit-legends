/**
 * Season preset constants for League Mode v1.
 *
 * These values mirror the schedule parameters in leagueStore and are used
 * by UI components that need to display total game-day counts without
 * querying the full `seasonGames` collection.
 */

/**
 * Total game days in a Mini/Sprint season (8 teams, 14 gamesPerTeam, 2-game series).
 *
 * Derivation: 8 teams → 7 opponents each. seriesPerPair = 14 / (7 × 2) = 1.
 * Berger rounds per pass = n−1 = 7. Each round spans seriesLength=2 consecutive
 * game days. Total game days = 7 rounds × 2 days/round = 14 (days 0–13).
 */
export const SPRINT_TOTAL_GAME_DAYS = 14;

/**
 * Returns the total number of game days for a given preset + seasonLength.
 * Defaults to SPRINT_TOTAL_GAME_DAYS for unknown combinations.
 */
export function getTotalGameDays(preset: string, seasonLength: string): number {
  if (preset === "mini" && seasonLength === "sprint") return SPRINT_TOTAL_GAME_DAYS;
  return SPRINT_TOTAL_GAME_DAYS;
}
