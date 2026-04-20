import { leagueSeasonStore } from "../storage/leagueSeasonStore";
import { leagueStore } from "../storage/leagueStore";
import { scheduledGameStore } from "../storage/scheduledGameStore";
import type { LeagueSeasonRecord } from "../storage/types";
import { calculateStandings } from "./calculateStandings";
import { determineChampion } from "./determineChampion";
import { isSeasonComplete } from "./isSeasonComplete";
import { simulateGame } from "./simulateGame";

export async function simulateGameDay(
  leagueSeason: LeagueSeasonRecord,
  gameDay: number,
): Promise<void> {
  const games = await scheduledGameStore.listGamesForDay(leagueSeason.id, gameDay);
  const scheduledGames = games.filter((g) => g.status === "scheduled");

  for (const game of scheduledGames) {
    const result = await simulateGame(game, leagueSeason.id);
    await scheduledGameStore.markScheduledGameCompleted(game.id, game.id, {
      winnerId: result.winnerId,
      homeScore: result.homeScore,
      awayScore: result.awayScore,
    });
  }

  await leagueSeasonStore.advanceGameDay(leagueSeason.id, gameDay + 1);

  // Check whether the season is now complete and finalize if so.
  const allGames = await scheduledGameStore.listGamesForSeason(leagueSeason.id);
  const updatedSeason = await leagueSeasonStore.getLeagueSeason(leagueSeason.id);
  if (updatedSeason && isSeasonComplete(updatedSeason, allGames)) {
    const league = await leagueStore.getLeague(leagueSeason.leagueId);
    if (league) {
      const standings = calculateStandings(allGames, league.teamIds);
      const champion = determineChampion(standings);
      if (champion) {
        await leagueSeasonStore.markSeasonComplete(leagueSeason.id, champion);
        await leagueStore.archiveLeague(leagueSeason.leagueId);
      }
    }
  }
}
