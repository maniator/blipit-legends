import * as React from "react";

import Game from "@feat/gameplay/components/Game";
import {
  useBeforeUnload,
  useBlocker,
  useLocation,
  useNavigate,
  useOutletContext,
} from "react-router";

import type {
  AppShellOutletContext,
  ExhibitionGameSetup,
  GameLocationState,
  LeagueGameContext,
  LeagueGameLocationState,
  SaveRecord,
} from "@storage/types";

import { SavingBanner } from "./styles";

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
  const leagueGameContextRef = React.useRef<LeagueGameContext | null>(
    gameState != null && "leagueGameContext" in gameState
      ? ((gameState as LeagueGameLocationState)?.leagueGameContext ?? null)
      : null,
  );

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

  const handleConsumeSetup = React.useCallback(() => {
    pendingSetupRef.current = null;
  }, []);

  const handleConsumeLoad = React.useCallback(() => {
    pendingLoadRef.current = null;
  }, []);

  const handleNewGame = React.useCallback(() => {
    navigate("/exhibition/new");
  }, [navigate]);

  const [isCommitting, setIsCommitting] = React.useState(false);

  const blocker = useBlocker(isCommitting);

  // When a navigation attempt occurs while isCommitting is true, the blocker
  // captures it and enters "blocked" state. The blocker predicate alone won't
  // auto-proceed — we must call blocker.proceed() once the commit finishes so
  // the deferred navigation can continue.
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

  return (
    <>
      <Game
        onBackToHome={ctx.onBackToHome}
        onNewGame={handleNewGame}
        onGameSessionStarted={ctx.onGameSessionStarted}
        pendingGameSetup={pendingSetupRef.current}
        onConsumeGameSetup={handleConsumeSetup}
        pendingLoadSave={pendingLoadRef.current}
        onConsumePendingLoad={handleConsumeLoad}
        onSavingStateChange={setIsCommitting}
        onGameOver={ctx.onGameOver}
        leagueGameContext={leagueGameContextRef.current}
      />
      {blocker.state === "blocked" && (
        <SavingBanner role="status" aria-live="polite" data-testid="saving-stats-banner">
          💾 Saving stats… Navigation will continue automatically.
        </SavingBanner>
      )}
    </>
  );
};

export default GamePage;
