import * as React from "react";

import Game from "@feat/gameplay/components/Game";
import GamePageWrapper from "@feat/gameplay/components/GamePageWrapper";
import type { GameSessionContextValue } from "@feat/gameplay/context/index";
import { GameSessionProvider } from "@feat/gameplay/context/index";
import { useLocation, useNavigate, useOutletContext } from "react-router";

import type {
  AppShellOutletContext,
  ExhibitionGameSetup,
  GameLocationState,
  SaveRecord,
} from "@storage/types";

const GamePage: React.FunctionComponent = () => {
  const ctx = useOutletContext<AppShellOutletContext>();
  const location = useLocation();
  const navigate = useNavigate();

  // Capture one-shot state from navigation on first render only.
  const gameState = location.state as GameLocationState;
  const pendingSetupRef = React.useRef<ExhibitionGameSetup | null>(
    gameState?.pendingGameSetup ?? null,
  );
  const pendingLoadRef = React.useRef<SaveRecord | null>(gameState?.pendingLoadSave ?? null);

  // Guard prevents re-clearing on subsequent renders if location.state changes.
  const hasClearedStateRef = React.useRef(false);

  // Clear location state after capturing so browser back/forward doesn't re-trigger.
  // hasClearedStateRef ensures this runs at most once regardless of re-renders.
  React.useEffect(() => {
    if (!hasClearedStateRef.current && location.state) {
      hasClearedStateRef.current = true;
      navigate("/game", { replace: true, state: null });
    }
  }, [location.state, navigate]);

  // Session metadata for the game. sessionReady starts false when the session
  // must auto-resume from RxDB (no pendingLoad, no pendingSetup) so the scheduler
  // waits until onSessionRestored flips it to true. If a save or setup is already
  // queued, sessionReady starts true since the session is known up front.
  const [sessionCtx, setSessionCtx] = React.useState<GameSessionContextValue>(() => {
    const load = pendingLoadRef.current;
    const setup = pendingSetupRef.current;
    return {
      sessionType: "exhibition",
      // Exhibition route: manager-mode toggle is always available.
      // Formula: `seasonGameId == null || managedTeam !== null`; seasonGameId is always
      // null here so this is unconditionally true, even for "Watch" save loads.
      managerModeAllowed: true,
      disableSave: false,
      seasonGameId: null,
      // Seed managedTeam from whichever source is available first: a pending new-game
      // setup carries the user's Play/Watch intent; a pending save load carries the
      // intent from when the game was originally created.
      managedTeam: setup?.managedTeam ?? load?.setup.managedTeam ?? null,
      sessionReady: load != null || setup != null,
    };
  });

  const handleSessionRestored = React.useCallback((managedTeam: 0 | 1 | null) => {
    setSessionCtx((prev) => ({
      ...prev,
      // Exhibition route: manager-mode toggle is always available regardless of whether
      // the session started as "Watch" (managedTeam: null). The formula is
      // `seasonGameId == null || managedTeam !== null`; here seasonGameId is always null.
      managerModeAllowed: true,
      managedTeam,
      sessionReady: true,
    }));
  }, []);

  const handleConsumeSetup = React.useCallback(() => {
    pendingSetupRef.current = null;
  }, []);

  const handleConsumeLoad = React.useCallback(() => {
    pendingLoadRef.current = null;
  }, []);

  const handleNewGame = React.useCallback(() => {
    navigate("/exhibition/new");
  }, [navigate]);

  return (
    <GamePageWrapper>
      {(onSavingStateChange) => (
        <GameSessionProvider value={sessionCtx}>
          <Game
            onBackToHome={ctx.onBackToHome}
            onNewGame={handleNewGame}
            onGameSessionStarted={ctx.onGameSessionStarted}
            pendingGameSetup={pendingSetupRef.current}
            onConsumeGameSetup={handleConsumeSetup}
            pendingLoadSave={pendingLoadRef.current}
            onConsumePendingLoad={handleConsumeLoad}
            onSessionRestored={handleSessionRestored}
            onSavingStateChange={onSavingStateChange}
            onGameOver={ctx.onGameOver}
          />
        </GameSessionProvider>
      )}
    </GamePageWrapper>
  );
};

export default GamePage;
