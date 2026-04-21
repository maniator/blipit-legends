import * as React from "react";

import { scheduledGameStore } from "@feat/leagueMode/storage/scheduledGameStore";
import type { LeagueGameContext } from "@feat/leagueMode/storage/types";
import { advanceGameDayIfComplete } from "@feat/leagueMode/utils/advanceGameDayIfComplete";

/**
 * Marks a scheduled league game as completed in RxDB once the game ends.
 *
 * Fires at most once per mount: when both `leagueGameContext` and
 * `completedGameId` (the RxDB save ID written after game-over) are non-null,
 * calls `scheduledGameStore.markScheduledGameCompleted` and then checks whether
 * all games on that day are finished, advancing `currentGameDay` if so.
 */
export function useLeagueGameReconciliation(
  leagueGameContext: LeagueGameContext | null | undefined,
  completedGameId: string | null | undefined,
): void {
  const reconciledRef = React.useRef(false);

  React.useEffect(() => {
    if (!leagueGameContext || !completedGameId) return;
    if (reconciledRef.current) return;
    reconciledRef.current = true;

    const { scheduledGameId, leagueSeasonId } = leagueGameContext;

    scheduledGameStore
      .markScheduledGameCompleted(scheduledGameId, completedGameId)
      .then(async () => {
        const game = await scheduledGameStore.getScheduledGame(scheduledGameId);
        if (game) {
          await advanceGameDayIfComplete(leagueSeasonId, game.gameDay);
        }
      })
      .catch(() => {
        // Non-fatal: the game save is already written. The detail page will
        // re-fetch on remount and reflect any state that was persisted.
      });
  }, [leagueGameContext, completedGameId]);
}
