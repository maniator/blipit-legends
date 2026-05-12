import * as React from "react";

import { getDb } from "@storage/db";

/**
 * App-level session state visible to all routes.
 * Tracks whether a game session is active (gates Resume) and whether career
 * stats are available (gates Career Stats menu entry).
 */
export interface AppSessionContextValue {
  hasActiveSession: boolean;
  hasCareerStats: boolean;
  handleGameSessionStarted: () => void;
  handleGameOver: () => void;
  /**
   * Lazily trigger the one-shot RxDB probe for completed games.
   * Call this when the Home screen mounts so the DB is only initialised when
   * `hasCareerStats` is actually needed, not on every deep-link entry point.
   */
  requestCareerStatsProbe: () => void;
}

const AppSessionContext = React.createContext<AppSessionContextValue | undefined>(undefined);

/**
 * Hook to access app session state. Must be used inside AppSessionProvider.
 */
export const useAppSession = (): AppSessionContextValue => {
  const ctx = React.useContext(AppSessionContext);
  if (!ctx) {
    throw new Error("useAppSession must be used inside AppSessionProvider");
  }
  return ctx;
};

interface AppSessionProviderProps {
  children: React.ReactNode;
}

/**
 * Provider for app-level session state.
 * Manages hasActiveSession and hasCareerStats.  The RxDB probe for completed
 * games is **deferred** — it only runs when a consumer calls
 * `requestCareerStatsProbe()` (typically HomeRoute on mount).  This avoids
 * initialising RxDB on deep-link entries to `/game/...` or `/leagues/...`
 * where `hasCareerStats` is never consumed.
 */
export const AppSessionProvider: React.FunctionComponent<AppSessionProviderProps> = ({
  children,
}) => {
  const [hasActiveSession, setHasActiveSession] = React.useState(false);
  const [hasCareerStats, setHasCareerStats] = React.useState(false);
  // Prevents duplicate probes if HomeRoute re-mounts or requestCareerStatsProbe is called twice.
  const probeFiredRef = React.useRef(false);
  // Tracks an in-flight probe so concurrent calls (e.g. StrictMode double-effects) are
  // deduplicated. Unlike probeFiredRef, this is cleared on failure so retries are allowed.
  const probeInFlightRef = React.useRef(false);

  const handleGameSessionStarted = React.useCallback(() => {
    setHasActiveSession(true);
  }, []);

  const handleGameOver = React.useCallback(() => {
    setHasActiveSession(false);
    setHasCareerStats(true);
    // Lock the probe so the next Home mount doesn't issue an unnecessary RxDB
    // query — a game just ended, so career stats are definitely available.
    probeFiredRef.current = true;
    probeInFlightRef.current = false;
  }, []);

  const requestCareerStatsProbe = React.useCallback(() => {
    // JavaScript is single-threaded: the guard check and the assignment below are
    // effectively atomic — no concurrent call can interleave between these two lines.
    if (probeFiredRef.current || probeInFlightRef.current) return;
    probeInFlightRef.current = true;

    // AppSessionProvider is mounted at RootLayout and stays alive for the full
    // app lifetime, so we do not need a cancellation guard here.
    getDb()
      .then((db) => db.completedGames.findOne().exec())
      .then((anyCompletedGame) => {
        if (anyCompletedGame) {
          // Games exist: lock the probe permanently so we don't query on every
          // subsequent Home mount. handleGameOver also sets this to true.
          probeFiredRef.current = true;
          probeInFlightRef.current = false;
          setHasCareerStats(true);
        } else {
          // No games found yet — clear in-flight so the next Home-mount probe
          // can check again (games may be created later via season headless sims
          // or other non-interactive paths). Leave probeFiredRef false.
          probeInFlightRef.current = false;
        }
      })
      .catch(() => {
        // On DB error: clear in-flight so next Home mount can retry, but leave
        // probeFiredRef false so the retry is allowed.
        probeInFlightRef.current = false;
      });
  }, []);

  const value: AppSessionContextValue = React.useMemo(
    () => ({
      hasActiveSession,
      hasCareerStats,
      handleGameSessionStarted,
      handleGameOver,
      requestCareerStatsProbe,
    }),
    [
      hasActiveSession,
      hasCareerStats,
      handleGameSessionStarted,
      handleGameOver,
      requestCareerStatsProbe,
    ],
  );

  return <AppSessionContext.Provider value={value}>{children}</AppSessionContext.Provider>;
};
