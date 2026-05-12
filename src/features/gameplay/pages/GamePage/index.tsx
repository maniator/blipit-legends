import * as React from "react";

import Game from "@feat/gameplay/components/Game";
import type { GameSessionContextValue } from "@feat/gameplay/context/index";
import { GameSessionProvider } from "@feat/gameplay/context/index";
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
  // must auto-resume from RxDB (no pendingLoad) so the scheduler waits until
  // onSessionRestored flips it to true. If a save is already queued via
  // pendingLoadRef, sessionReady starts true since the session is known up front.
  const [sessionCtx, setSessionCtx] = React.useState<GameSessionContextValue>(() => {
    const load = pendingLoadRef.current;
    return {
      sessionType: "exhibition",
      managerModeAllowed: load != null ? load.setup.managedTeam !== null : true,
      disableSave: false,
      seasonGameId: null,
      managedTeam: load?.setup.managedTeam ?? null,
      sessionReady: load != null,
    };
  });

  const handleSessionRestored = React.useCallback((managedTeam: 0 | 1 | null) => {
    setSessionCtx((prev) => ({
      ...prev,
      managerModeAllowed: managedTeam !== null,
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

export default GamePage;
