import * as React from "react";

import Game from "@feat/gameplay/components/Game";
import { GameSessionProvider } from "@feat/gameplay/context/index";
import { deriveExhibitionSession } from "@feat/gameplay/utils/gameSessionDerive";
import { Navigate, useBeforeUnload, useBlocker, useNavigate, useOutletContext } from "react-router";

import type { AppShellOutletContext, ExhibitionGameSetup } from "@storage/types";

import { SavingBanner } from "./styles";

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

  const [isCommitting, setIsCommitting] = React.useState(false);

  const blocker = useBlocker(isCommitting);

  React.useEffect(() => {
    if (blocker.state === "blocked" && !isCommitting) {
      blocker.proceed?.();
    }
  }, [blocker, isCommitting]);

  useBeforeUnload(
    React.useCallback(
      (event) => {
        if (isCommitting) {
          event.preventDefault();
          event.returnValue = "";
        }
      },
      [isCommitting],
    ),
  );

  if (pendingSetupRef.current === null) {
    return <Navigate to="/exhibition/new" replace />;
  }

  return (
    <>
      <GameSessionProvider value={deriveExhibitionSession(pendingSetupRef.current)}>
        <Game
          onBackToHome={ctx.onBackToHome}
          onNewGame={handleNewGame}
          onGameSessionStarted={ctx.onGameSessionStarted}
          pendingGameSetup={pendingSetupRef.current}
          onConsumeGameSetup={handleConsumeSetup}
          pendingLoadSave={null}
          onConsumePendingLoad={handleConsumePendingLoad}
          onSavingStateChange={setIsCommitting}
          onGameOver={ctx.onGameOver}
        />
      </GameSessionProvider>
      {blocker.state === "blocked" && (
        <SavingBanner role="status" aria-live="polite" data-testid="saving-stats-banner">
          💾 Saving stats… Navigation will continue automatically.
        </SavingBanner>
      )}
    </>
  );
};

export default ExhibitionGamePage;
