import { leagueSeasonStore } from "../storage/leagueSeasonStore";
import { scheduledGameStore } from "../storage/scheduledGameStore";
import type { LeagueSeasonRecord } from "../storage/types";
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
}
