import * as React from "react";

import Game from "@feat/gameplay/components/Game";
import {
  Navigate,
  useBeforeUnload,
  useBlocker,
  useLocation,
  useNavigate,
  useOutletContext,
} from "react-router";

import type { AppShellOutletContext, ExhibitionGameSetup } from "@storage/types";

import { SavingBanner } from "./styles";

type ExhibitionGameLocationState = {
  pendingGameSetup?: ExhibitionGameSetup;
} | null;

const ExhibitionGamePage: React.FunctionComponent = () => {
  const ctx = useOutletContext<AppShellOutletContext>();
  const location = useLocation();
  const navigate = useNavigate();

  const gameState = location.state as ExhibitionGameLocationState;
  const pendingSetupRef = React.useRef<ExhibitionGameSetup | null>(
    gameState?.pendingGameSetup ?? null,
  );

  const hasClearedStateRef = React.useRef(false);

  React.useEffect(() => {
    if (!hasClearedStateRef.current && location.state) {
      hasClearedStateRef.current = true;
      navigate("/game/exhibition", { replace: true, state: null });
    }
  }, [location.state, navigate]);

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
      {blocker.state === "blocked" && (
        <SavingBanner role="status" aria-live="polite" data-testid="saving-stats-banner">
          💾 Saving stats… Navigation will continue automatically.
        </SavingBanner>
      )}
    </>
  );
};

export default ExhibitionGamePage;
