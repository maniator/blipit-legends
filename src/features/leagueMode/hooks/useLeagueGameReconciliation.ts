import * as React from "react";

import { scheduledGameStore } from "@feat/leagueMode/storage/scheduledGameStore";
import type { LeagueGameContext } from "@feat/leagueMode/storage/types";
import { advanceGameDayIfComplete } from "@feat/leagueMode/utils/advanceGameDayIfComplete";

/**
 * Marks a scheduled league game as completed in RxDB once the game ends,
 * recording the final score and winner for standings. Then checks whether all
 * games on that day are finished and advances `currentGameDay` if so.
 *
 * Fires at most once per mount.
 */
export function useLeagueGameReconciliation(
  leagueGameContext: LeagueGameContext | null | undefined,
  completedGameId: string | null | undefined,
  finalScore: { awayScore: number; homeScore: number } | null | undefined,
): void {
  const reconciledRef = React.useRef(false);

  React.useEffect(() => {
    if (!leagueGameContext || !completedGameId) return;
    if (reconciledRef.current) return;
    reconciledRef.current = true;

    const { scheduledGameId, leagueSeasonId } = leagueGameContext;

    scheduledGameStore
      .getScheduledGame(scheduledGameId)
      .then(async (game) => {
        if (!game) return;

        if (finalScore) {
          const { awayScore, homeScore } = finalScore;
          const winnerId =
            homeScore > awayScore
              ? game.homeTeamId
              : awayScore > homeScore
                ? game.awayTeamId
                : game.homeTeamId; // home wins ties (matches simulateGame.ts convention)
          await scheduledGameStore.markScheduledGameCompleted(scheduledGameId, completedGameId, {
            winnerId,
            homeScore,
            awayScore,
          });
        } else {
          await scheduledGameStore.markScheduledGameCompleted(scheduledGameId, completedGameId);
        }

        await advanceGameDayIfComplete(leagueSeasonId, game.gameDay);
      })
      .catch(() => {
        // Non-fatal: the game save is already written. The detail page will
        // re-fetch on remount and reflect any state that was persisted.
      });
  }, [leagueGameContext, completedGameId, finalScore]);
}
