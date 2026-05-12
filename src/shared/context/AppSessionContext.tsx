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
 * Manages hasActiveSession and hasCareerStats, probes DB on mount to check for
 * completed games, and exposes state via useAppSession hook.
 */
export const AppSessionProvider: React.FunctionComponent<AppSessionProviderProps> = ({
  children,
}) => {
  const [hasActiveSession, setHasActiveSession] = React.useState(false);
  const [hasCareerStats, setHasCareerStats] = React.useState(false);

  const handleGameSessionStarted = React.useCallback(() => {
    setHasActiveSession(true);
  }, []);

  const handleGameOver = React.useCallback(() => {
    setHasActiveSession(false);
    setHasCareerStats(true);
  }, []);

  // Probe DB on mount to check for completed games.
  React.useEffect(() => {
    let cancelled = false;

    async function loadCareerStatsAvailability() {
      try {
        const db = await getDb();
        const anyCompletedGame = await db.completedGames.findOne().exec();
        if (!cancelled) {
          // Use functional update so a true set by handleGameOver is never cleared.
          setHasCareerStats((prev) => prev || Boolean(anyCompletedGame));
        }
      } catch {
        // On DB error, leave hasCareerStats unchanged (don't hide it if it was already true).
      }
    }

    void loadCareerStatsAvailability();

    return () => {
      cancelled = true;
    };
  }, []);

  const value: AppSessionContextValue = React.useMemo(
    () => ({
      hasActiveSession,
      hasCareerStats,
      handleGameSessionStarted,
      handleGameOver,
    }),
    [hasActiveSession, hasCareerStats, handleGameSessionStarted, handleGameOver],
  );

  return <AppSessionContext.Provider value={value}>{children}</AppSessionContext.Provider>;
};
