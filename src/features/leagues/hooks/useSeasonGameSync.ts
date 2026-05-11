import * as React from "react";

import { useGameContext } from "@feat/gameplay/context/index";
import { applySeasonGameResult } from "@feat/leagues/utils/applySeasonGameResult";
import { appLog } from "@shared/utils/logger";

import { getDb } from "@storage/db";

/**
 * Mirrors the `useGameHistorySync` pattern for the league-season path.
 *
 * When `seasonGameIdRef.current` is set and the game reaches FINAL, commits the
 * result to the `seasonGames` record (status='completed', boxscore, standings)
 * and advances `seasons.currentGameDay` if all games for that day are done.
 *
 * Idempotency is enforced by:
 *   1. Session-level `committedRef` — set on first successful commit.
 *   2. `applySeasonGameResult` checking `seasonGames.status === 'completed'`
 *      before writing — safe against duplicate calls.
 *
 * Resets the committed flag when `seasonGameIdRef.current` changes (new game).
 */
export const useSeasonGameSync = (
  seasonGameIdRef: React.MutableRefObject<string | undefined>,
): void => {
  const { gameOver, score } = useGameContext();

  const committedRef = React.useRef(false);
  const prevSeasonGameIdRef = React.useRef<string | undefined>(undefined);

  // Reset committed flag whenever the season game ID changes (new game session).
  // This effect intentionally has no dependency array so it runs on every render
  // to detect changes to seasonGameIdRef.current (refs don't trigger re-renders).
  // This mirrors the identical pattern in useGameHistorySync.
  React.useEffect(() => {
    const current = seasonGameIdRef.current;
    if (current !== prevSeasonGameIdRef.current) {
      prevSeasonGameIdRef.current = current;
      committedRef.current = false;
    }
  });

  React.useEffect(() => {
    if (!gameOver) return;
    const seasonGameId = seasonGameIdRef.current;
    if (!seasonGameId) return;
    if (committedRef.current) return;

    committedRef.current = true;

    // score[0] = away (teams[0]), score[1] = home (teams[1])
    const awayScore = score[0];
    const homeScore = score[1];

    getDb()
      .then((db) => applySeasonGameResult(db, seasonGameId, { homeScore, awayScore }))
      .catch((err) => {
        appLog.error("[useSeasonGameSync] failed to apply season game result", err);
        // Non-fatal: career stats are already committed by useGameHistorySync.
        // Reset so the user can retry by re-navigating (edge case only).
        committedRef.current = false;
      });
  }, [gameOver, score, seasonGameIdRef]);
};
