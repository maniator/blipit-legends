import { leagueSeasonStore } from "../storage/leagueSeasonStore";
import { leagueStore } from "../storage/leagueStore";
import { scheduledGameStore } from "../storage/scheduledGameStore";
import { calculateStandings } from "./calculateStandings";
import { determineChampion } from "./determineChampion";
import { isSeasonComplete } from "./isSeasonComplete";

/**
 * Checks whether all non-bye games on `gameDay` are completed. If so, advances
 * `currentGameDay` to `gameDay + 1` and finalizes the season when complete.
 *
 * Idempotent: calling it when games are still scheduled is a no-op.
 */
export async function advanceGameDayIfComplete(
  leagueSeasonId: string,
  gameDay: number,
): Promise<void> {
  const gamesOnDay = await scheduledGameStore.listGamesForDay(leagueSeasonId, gameDay);
  const allDone = gamesOnDay.every((g) => g.status === "completed" || g.status === "bye");
  if (!allDone) return;

  await leagueSeasonStore.advanceGameDay(leagueSeasonId, gameDay + 1);

  // Check whether the season is now complete and finalize if so.
  const allGames = await scheduledGameStore.listGamesForSeason(leagueSeasonId);
  const updatedSeason = await leagueSeasonStore.getLeagueSeason(leagueSeasonId);
  if (updatedSeason && isSeasonComplete(updatedSeason, allGames)) {
    const league = await leagueStore.getLeague(updatedSeason.leagueId);
    if (league) {
      const standings = calculateStandings(allGames, league.teamIds);
      const champion = determineChampion(standings);
      if (champion) {
        await leagueSeasonStore.markSeasonComplete(leagueSeasonId, champion);
        await leagueStore.archiveLeague(updatedSeason.leagueId);
      }
    }
  }
}
