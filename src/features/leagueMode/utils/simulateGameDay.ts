import { scheduledGameStore } from "../storage/scheduledGameStore";
import type { LeagueSeasonRecord } from "../storage/types";
import { advanceGameDayIfComplete } from "./advanceGameDayIfComplete";
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

  // Delegate advancement + season finalization to the shared utility so both the
  // manual-play path (useLeagueGameReconciliation) and the headless-simulation path
  // use identical logic. All scheduled games are now completed so allDone = true.
  await advanceGameDayIfComplete(leagueSeason.id, gameDay);
}
