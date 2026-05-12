import * as React from "react";

import Game from "@feat/gameplay/components/Game";
import GamePageWrapper from "@feat/gameplay/components/GamePageWrapper";
import { GameSessionProvider } from "@feat/gameplay/context/index";
import { deriveExhibitionSession } from "@feat/gameplay/utils/gameSessionDerive";
import { Navigate, useNavigate, useOutletContext } from "react-router";

import type { AppShellOutletContext, ExhibitionGameSetup } from "@storage/types";

const ExhibitionGamePage: React.FunctionComponent = () => {
  const ctx = useOutletContext<AppShellOutletContext>();
  const navigate = useNavigate();

  // Read the pending setup from sessionStorage once on first render.
  // Using a ref-guarded read so it only fires once, even in Strict Mode.
  const hasReadStorageRef = React.useRef(false);
  const pendingSetupRef = React.useRef<ExhibitionGameSetup | null>(null);
  if (!hasReadStorageRef.current) {
    hasReadStorageRef.current = true;
    const setupJson = sessionStorage.getItem("pendingExhibitionSetup");
    if (setupJson) {
      sessionStorage.removeItem("pendingExhibitionSetup");
      try {
        pendingSetupRef.current = JSON.parse(setupJson) as ExhibitionGameSetup;
      } catch {
        pendingSetupRef.current = null;
      }
    }
  }

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
