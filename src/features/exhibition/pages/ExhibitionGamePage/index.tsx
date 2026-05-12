import * as React from "react";

import Game from "@feat/gameplay/components/Game";
import GamePageWrapper from "@feat/gameplay/components/GamePageWrapper";
import type { GameSessionContextValue } from "@feat/gameplay/context/index";
import { GameSessionProvider } from "@feat/gameplay/context/index";
import { useNavigate, useOutletContext } from "react-router";
import { useSessionStorage } from "usehooks-ts";

import type { AppShellOutletContext, ExhibitionGameSetup } from "@storage/types";

const ExhibitionGamePage: React.FunctionComponent = () => {
  const ctx = useOutletContext<AppShellOutletContext>();
  const navigate = useNavigate();

  // useSessionStorage reads from sessionStorage synchronously into React state,
  // so `storedSetup` is available on the very first render — no ref guards needed.
  const [storedSetup, , removeStoredSetup] = useSessionStorage<ExhibitionGameSetup | null>(
    "pendingExhibitionSetup",
    null,
  );

  // Snapshot the initial value so subsequent renders (after removal sets the hook
  // state to null) don't trigger a spurious re-render.
  const pendingSetupRef = React.useRef<ExhibitionGameSetup | null>(storedSetup);

  // Clear from sessionStorage on mount so a page refresh doesn't re-start a new game.
  React.useEffect(() => {
    removeStoredSetup();
  }, [removeStoredSetup]);

  const handleConsumeSetup = React.useCallback(() => {
    pendingSetupRef.current = null;
  }, []);

  const handleConsumePendingLoad = React.useCallback(() => {}, []);

  const handleNewGame = React.useCallback(() => {
    navigate("/exhibition/new");
  }, [navigate]);

  // Session context — starts with `sessionReady: false` when there is no pending setup
  // so the auto-play scheduler waits for GameInner to complete RxDB auto-restore.
  // When a pending setup is present (new game), the session is immediately ready.
  const [sessionCtx, setSessionCtx] = React.useState<GameSessionContextValue>(() => ({
    sessionType: "exhibition",
    // Exhibition games always have seasonGameId: null, so the manager-mode formula
    // (`seasonGameId == null || managedTeam !== null`) evaluates to true unconditionally.
    managerModeAllowed: true,
    disableSave: false,
    seasonGameId: null,
    managedTeam: pendingSetupRef.current?.managedTeam ?? null,
    sessionReady: pendingSetupRef.current !== null,
  }));

  // Called by GameInner when RxDB auto-restore completes (only fires when
  // pendingGameSetup is null, i.e., page refresh or deep-link without a setup).
  const handleSessionRestored = React.useCallback((managedTeam: 0 | 1 | null) => {
    setSessionCtx((prev) => ({
      ...prev,
      managedTeam,
      sessionReady: true,
    }));
  }, []);

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
            pendingLoadSave={null}
            onConsumePendingLoad={handleConsumePendingLoad}
            onSessionRestored={handleSessionRestored}
            onSavingStateChange={onSavingStateChange}
            onGameOver={ctx.onGameOver}
          />
        </GameSessionProvider>
      )}
    </GamePageWrapper>
  );
};

export default ExhibitionGamePage;
