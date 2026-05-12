import * as React from "react";

export type GameSessionType = "exhibition" | "league";

export type GameSessionContextValue = {
  sessionType: GameSessionType;
  /** When false, the manager-mode toggle is hidden (spectator session). */
  managerModeAllowed: boolean;
  /** When true, in-game save controls are hidden (league season games). */
  disableSave: boolean;
  /** ID of the season game being played; null for exhibition games. */
  seasonGameId: string | null;
  /** Which team index is managed; null = spectator. */
  managedTeam: 0 | 1 | null;
  /**
   * True once the game is ready to auto-play. For ExhibitionGamePage and
   * LeagueGamePage this is always true on mount. For GamePage (legacy /game
   * route) it starts false when the session must auto-resume from RxDB and
   * flips to true via the `onSessionRestored` callback.
   */
  sessionReady: boolean;
};

const GameSessionContext = React.createContext<GameSessionContextValue | undefined>(undefined);

export const useGameSessionContext = (): GameSessionContextValue => {
  const ctx = React.useContext(GameSessionContext);
  if (!ctx) throw new Error("useGameSessionContext must be used within GameSessionProvider");
  return ctx;
};

export const GameSessionProvider: React.FunctionComponent<{
  value: GameSessionContextValue;
  children: React.ReactNode;
}> = ({ value, children }) => (
  <GameSessionContext.Provider value={value}>{children}</GameSessionContext.Provider>
);
