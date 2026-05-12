import * as React from "react";

import Game from "@feat/gameplay/components/Game";
import GamePageWrapper from "@feat/gameplay/components/GamePageWrapper";
import { GameSessionProvider } from "@feat/gameplay/context/index";
import { deriveExhibitionSession } from "@feat/gameplay/utils/gameSessionDerive";
import { Navigate, useNavigate, useOutletContext } from "react-router";
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
  // state to null) don't trigger a spurious redirect to /exhibition/new.
  const pendingSetupRef = React.useRef<ExhibitionGameSetup | null>(storedSetup);

  // Clear from sessionStorage on mount so a page refresh doesn't re-enter the game.
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

  if (pendingSetupRef.current === null) {
    return <Navigate to="/exhibition/new" replace />;
  }

  return (
    <GamePageWrapper>
      {(onSavingStateChange) => (
        <GameSessionProvider value={deriveExhibitionSession(pendingSetupRef.current!)}>
          <Game
            onBackToHome={ctx.onBackToHome}
            onNewGame={handleNewGame}
            onGameSessionStarted={ctx.onGameSessionStarted}
            pendingGameSetup={pendingSetupRef.current}
            onConsumeGameSetup={handleConsumeSetup}
            pendingLoadSave={null}
            onConsumePendingLoad={handleConsumePendingLoad}
            onSavingStateChange={onSavingStateChange}
            onGameOver={ctx.onGameOver}
          />
        </GameSessionProvider>
      )}
    </GamePageWrapper>
  );
};

export default ExhibitionGamePage;
