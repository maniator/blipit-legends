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

  const handleGameSessionStarted = React.useCallback(() => {
    setHasActiveSession(true);
  }, []);

  const handleGameOver = React.useCallback(() => {
    setHasActiveSession(false);
    setHasCareerStats(true);
  }, []);

  const requestCareerStatsProbe = React.useCallback(() => {
    if (probeFiredRef.current) return;

    // AppSessionProvider is mounted at RootLayout and stays alive for the full
    // app lifetime, so we do not need a cancellation guard here.
    getDb()
      .then((db) => db.completedGames.findOne().exec())
      .then((anyCompletedGame) => {
        // Only mark probe as fired after a successful result so a transient
        // DB failure doesn't permanently block future retries.
        probeFiredRef.current = true;
        // Use functional update so a true set by handleGameOver is never cleared.
        setHasCareerStats((prev) => prev || Boolean(anyCompletedGame));
      })
      .catch(() => {
        // On DB error, leave hasCareerStats unchanged and keep probeFiredRef
        // false so the next Home mount can retry.
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
