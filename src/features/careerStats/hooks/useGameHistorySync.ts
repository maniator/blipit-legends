import * as React from "react";

import { GameHistoryStore } from "@feat/careerStats/storage/gameHistoryStore";
import { computePitcherGameStats } from "@feat/careerStats/utils/computePitcherGameStats";
import { useGameContext } from "@feat/gameplay/context/index";
import type { LeagueGameContext } from "@feat/leagueMode/storage/types";
import { appLog } from "@shared/utils/logger";
import { getRngState, getSeed } from "@shared/utils/rng";
import { computeBattingStatsFromLogs } from "@shared/utils/stats/computeBattingStatsFromLogs";

import type { BatterGameStatRecord, PitcherGameStatRecord } from "@storage/types";

/** Maximum number of automatic retry attempts after a transient commit failure. */
const MAX_COMMIT_RETRIES = 3;

/**
 * Hooks into the game's gameOver state and commits a completed game to RxDB
 * exactly once per game session.
 *
 * Idempotency is enforced at two levels:
 *   1. Session-level: an `inFlightRef` prevents concurrent commit attempts, and
 *      `committedRef` is set to true only after a successful commit. On transient
 *      failure the `retryCount` state is incremented (up to 3) so the effect
 *      re-fires without requiring a page reload.
 *   2. DB-level: `GameHistoryStore.commitCompletedGame` uses `gameInstanceId`
 *      as the CompletedGameRecord primary key — any concurrent insert of the same
 *      key is treated as "already committed", and missing stat rows are still written
 *      so a partial prior write never permanently loses stats.
 *
 * Loading an already-FINAL save must NOT trigger a new commit. The hook guards
 * against this by checking `wasAlreadyFinalOnLoad` — set when the save is
 * restored with `gameOver === true` from `stateSnapshot`.
 */
export const useGameHistorySync = (
  rxSaveIdRef: React.MutableRefObject<string | null>,
  /** Pass true when the save being loaded was already in FINAL state. */
  wasAlreadyFinalOnLoad: boolean,
  /** Pass the league game context when the game was launched from league mode. */
  leagueGameContext?: LeagueGameContext | null,
): { isCommitting: boolean } => {
  const gameContext = useGameContext();
  const { gameOver } = gameContext;

  // True after we have successfully committed this game session.
  const committedRef = React.useRef(false);
  // Prevents a second commit attempt while one is already in-flight.
  const inFlightRef = React.useRef(false);
  // Capture the wasAlreadyFinalOnLoad flag in a ref so the effect sees the latest value.
  const alreadyFinalRef = React.useRef(wasAlreadyFinalOnLoad);
  alreadyFinalRef.current = wasAlreadyFinalOnLoad;
  // Incremented on transient failure so the effect re-fires automatically (capped at 3).
  const [retryCount, setRetryCount] = React.useState(0);
  // True while a commit is in-flight (used to show "Saving…" UI).
  const [isCommitting, setIsCommitting] = React.useState(false);

  const gameStateRef = React.useRef(gameContext);
  gameStateRef.current = gameContext;

  const leagueGameContextRef = React.useRef(leagueGameContext);
  leagueGameContextRef.current = leagueGameContext;

  React.useEffect(() => {
    if (!gameOver) return;
    // Skip if: already committed, in-flight, or the game was already FINAL when loaded.
    if (committedRef.current || inFlightRef.current || alreadyFinalRef.current) return;

    const saveId = rxSaveIdRef.current;
    const state = gameStateRef.current;
    const leagueGameContext = leagueGameContextRef.current;

    // gameInstanceId is always present (set in createFreshGameState via generateGameInstanceId).
    // Fall back to saveId as a safeguard. If both are absent bail out.
    const gameId = state.gameInstanceId ?? saveId;
    if (!gameId) return;

    inFlightRef.current = true;
    setIsCommitting(true);

    // Build stat rows for both teams.
    const statRows: Omit<BatterGameStatRecord, "id" | "schemaVersion" | "createdAt">[] = [];

    for (const teamIdx of [0, 1] as const) {
      const teamId = state.teams[teamIdx];
      const opponentTeamId = state.teams[teamIdx === 0 ? 1 : 0];
      const teamStats = computeBattingStatsFromLogs(
        teamIdx,
        state.playLog,
        state.strikeoutLog,
        state.outLog,
      );

      // Lineup order is set from PlayerRecord.id values.
      const order = state.lineupOrder[teamIdx].length > 0 ? state.lineupOrder[teamIdx] : [];

      for (const [key, batting] of Object.entries(teamStats)) {
        const playerId = key;

        // Name comes from playerOverrides (nickname set at game-start from PlayerRecord.name).
        const slotIdx = order.indexOf(playerId);
        const nameAtGameTime =
          state.playerOverrides[teamIdx][playerId]?.nickname?.trim() ||
          (slotIdx >= 0 ? `Batter ${slotIdx + 1}` : playerId);

        statRows.push({
          gameId,
          teamId,
          opponentTeamId,
          playerId,
          nameAtGameTime,
          role: "batter",
          batting,
        });
      }
    }

    const gameMeta = {
      playedAt: Date.now(),
      seed: getSeed()?.toString(36) ?? "",
      rngState: getRngState(),
      homeTeamId: state.teams[1],
      awayTeamId: state.teams[0],
      homeScore: state.score[1],
      awayScore: state.score[0],
      innings: state.inning,
      ...(saveId ? { committedBySaveId: saveId } : {}),
      ...(leagueGameContext?.leagueSeasonId
        ? { leagueSeasonId: leagueGameContext.leagueSeasonId }
        : {}),
      ...(leagueGameContext?.scheduledGameId
        ? { scheduledGameId: leagueGameContext.scheduledGameId }
        : {}),
    };

    // Build pitcher stat rows from pitcherGameLog.
    const pitcherRows: Omit<PitcherGameStatRecord, "id" | "schemaVersion" | "createdAt">[] = [];
    const pitcherGameLog = state.pitcherGameLog ?? [[], []];
    const pitcherResults = computePitcherGameStats(pitcherGameLog, state.score);

    // Build pitcher name maps from playerOverrides (nicknames set at game-start from PlayerRecord.name).
    const pitcherNameMaps: [Map<string, string>, Map<string, string>] = [new Map(), new Map()];
    for (const teamIdx of [0, 1] as const) {
      for (const [id, override] of Object.entries(state.playerOverrides[teamIdx])) {
        if (override.nickname?.trim()) {
          pitcherNameMaps[teamIdx].set(id, override.nickname.trim());
        }
      }
    }

    for (const { teamIdx, result } of pitcherResults) {
      const teamId = state.teams[teamIdx];
      const opponentTeamId = state.teams[teamIdx === 0 ? 1 : 0];
      const playerId = result.pitcherId;
      const nameAtGameTime = pitcherNameMaps[teamIdx].get(playerId) ?? playerId;

      pitcherRows.push({
        gameId,
        teamId,
        opponentTeamId,
        playerId,
        nameAtGameTime,
        outsPitched: result.outsPitched,
        battersFaced: result.battersFaced,
        pitchesThrown: result.pitchesThrown,
        hitsAllowed: result.hitsAllowed,
        walksAllowed: result.walksAllowed,
        strikeoutsRecorded: result.strikeoutsRecorded,
        homersAllowed: result.homersAllowed,
        runsAllowed: result.runsAllowed,
        earnedRuns: result.earnedRuns,
        saves: result.saves,
        holds: result.holds,
        blownSaves: result.blownSaves,
      });
    }

    GameHistoryStore.commitCompletedGame(gameId, gameMeta, statRows, pitcherRows)
      .then(() => {
        committedRef.current = true;
        inFlightRef.current = false;
        setIsCommitting(false);
      })
      .catch((err) => {
        appLog.error("useGameHistorySync: failed to commit completed game", err);
        inFlightRef.current = false;
        setIsCommitting(false);
        // Increment retry nonce so this effect re-fires automatically.
        // Capped at 3 to prevent an infinite loop on persistent DB errors.
        setRetryCount((c) => (c < MAX_COMMIT_RETRIES ? c + 1 : c));
      });
  }, [gameOver, rxSaveIdRef, retryCount]);

  // Reset the committed flag when a new save is loaded (rxSaveIdRef changes).
  // This ensures a new game session can be committed even within the same
  // browser tab.  Guard against the SPEED_INSTANT race: if a commit started via
  // gameInstanceId is still in-flight when saveId transitions null → "save_*",
  // don't clear inFlightRef or isCommitting — the commit must finish first.
  const prevSaveIdRef = React.useRef<string | null>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally runs on every render to detect rxSaveIdRef.current changes (refs don't trigger re-renders)
  React.useEffect(() => {
    const current = rxSaveIdRef.current;
    if (current !== prevSaveIdRef.current) {
      prevSaveIdRef.current = current;
      committedRef.current = false;
      if (!inFlightRef.current) {
        setIsCommitting(false);
      }
    }
  });

  return React.useMemo(() => ({ isCommitting }), [isCommitting]);
};
