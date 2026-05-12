import * as React from "react";

import { DecisionType, useGameSessionContext } from "@feat/gameplay/context/index";
import { isSpeechPending } from "@feat/gameplay/utils/announce";
import { appLog } from "@shared/utils/logger";

/**
 * Speech-gated scheduler — runs while the game is in progress.
 * Waits for the current announcement to finish before pitching, so nothing
 * gets cut off. Adds a brief pause at half-inning transitions when muted.
 *
 * `gameOver` is included as an explicit parameter (and effect dependency) so
 * the scheduler restarts automatically when a new in-progress save is loaded
 * after a finished game — without it the timer chain would stay dead.
 *
 * With Game rendered as a proper route element, it unmounts when the user
 * navigates away from /game, so no off-route guard is needed.
 */
export const useAutoPlayScheduler = ({
  gameStarted,
  pendingDecision,
  managerMode,
  gameOver,
  muted,
  speed,
  paused,
  handlePitch,
  inning,
  atBat,
}: {
  gameStarted: boolean;
  pendingDecision: DecisionType | null;
  managerMode: boolean;
  gameOver: boolean;
  muted: boolean;
  speed: number;
  /** When true the scheduler does not fire — the game is user-paused. */
  paused: boolean;
  handlePitch: () => void;
  inning: number;
  atBat: 0 | 1 | null;
}): void => {
  // Track previous inning/atBat to detect half-inning transitions across effect re-runs.
  // This ref is LOCAL to this hook (not passed between hooks), so it's not cross-hook mutation.
  const prevInningRef = React.useRef(inning);
  const prevAtBatRef = React.useRef(atBat);
  const { sessionReady } = useGameSessionContext();

  // Stabilize the pitch callback so the scheduler effect does not restart on every render.
  // handlePitch closes over currentState (recreated every pitch), so putting it in the effect
  // dep array would tear down and restart the timer chain on every state update, effectively
  // adding an extra render-time delay to the configured `speed` interval.
  // Using a ref means the effect always invokes the latest version without re-mounting.
  const handlePitchRef = React.useRef(handlePitch);
  handlePitchRef.current = handlePitch;

  React.useEffect(() => {
    if (!sessionReady) return;
    if (!gameStarted) return;
    if (gameOver) return;
    if (paused) return;
    if (pendingDecision && managerMode) return;

    let timerId: ReturnType<typeof setTimeout>;
    let extraWait = 0;
    let cancelled = false;
    let needsInningPause = false;
    const MAX_SPEECH_WAIT_MS = 8000;
    const SPEECH_POLL_MS = 300;
    // Allow E2E tests to disable the muted half-inning pause to avoid CI timeouts.
    // Set localStorage.setItem("_e2eNoInningPause", "1") via addInitScript to skip the pause.
    const INNING_PAUSE_MS =
      typeof localStorage !== "undefined" && localStorage.getItem("_e2eNoInningPause") ? 0 : 1500;

    const tick = (delay: number) => {
      timerId = setTimeout(() => {
        if (cancelled) return;
        // NOTE: We intentionally do NOT re-check gameStateRef.current.gameOver here.
        // The ref can be stale during a same-component save restore, which would
        // permanently kill the chain. The effect-level `if (gameOver) return` guard
        // (above) and the `cancelled` flag are sufficient: when the game truly ends,
        // React cleans up this effect (cancelled=true, clearTimeout) and re-runs it
        // with gameOver=true so it returns early without starting a new chain.

        // Instant mode (speed === 0): skip all speech/inning delays.
        const isInstant = speed === 0;

        if (!isInstant && !muted && isSpeechPending() && extraWait < MAX_SPEECH_WAIT_MS) {
          extraWait += SPEECH_POLL_MS;
          tick(SPEECH_POLL_MS);
          return;
        }

        if (!isInstant) {
          // Detect half-inning transitions for muted pause
          // Note: We use refs to track previous values across effect re-runs.
          // The effect re-runs when inning/atBat change, but the ref persists.
          if (inning !== prevInningRef.current || atBat !== prevAtBatRef.current) {
            needsInningPause = true;
            prevInningRef.current = inning;
            prevAtBatRef.current = atBat;
          }

          if (muted && needsInningPause) {
            needsInningPause = false;
            extraWait = 0;
            tick(INNING_PAUSE_MS);
            return;
          }
        } else {
          // Always update inning refs in instant mode (no pause applied, just track
          // for when we exit instant mode so refs stay consistent).
          prevInningRef.current = inning;
          prevAtBatRef.current = atBat;
        }

        // Reset extraWait so the next speech-wait window starts fresh for the new pitch.
        extraWait = 0;
        try {
          handlePitchRef.current();
        } catch (err) {
          // An exception in the pitch handler must not silently kill the autoplay
          // chain. Log it with context and continue scheduling so the game can
          // recover or at least surface a visible error rather than freezing.
          appLog.error("[autoplay] handlePitch threw — continuing scheduler:", err);
        }
        tick(isInstant ? 0 : speed);
      }, delay);
    };

    tick(speed === 0 ? 0 : speed);
    return () => {
      cancelled = true;
      clearTimeout(timerId);
    };
  }, [
    sessionReady,
    gameStarted,
    pendingDecision,
    managerMode,
    gameOver,
    paused,
    // handlePitch intentionally omitted — stabilized via handlePitchRef so the effect
    // does not restart on every pitch (handlePitch is recreated each render).
    muted,
    speed,
    inning,
    atBat,
  ]);
};
