import * as React from "react";

import { resolveRestoreLabels } from "@feat/customTeams/adapters/customTeamAdapter";
import type { GameAction, Strategy } from "@feat/gameplay/context/index";
import type { ManagerDecisionValues } from "@feat/gameplay/context/managerDecisionValues";
import {
  DEFAULT_MANAGER_DECISION_VALUES,
  sanitizeManagerDecisionValues,
} from "@feat/gameplay/context/managerDecisionValues";
import { reinitSeed, restoreRng, restoreSeed } from "@shared/utils/rng";

import type { SaveRecord, TeamWithRoster } from "@storage/types";

export interface UseGameSaveRestoreOptions {
  pendingLoadSave: SaveRecord | null | undefined;
  dispatch: (action: GameAction) => void;
  customTeams: TeamWithRoster[];
  rxSaveIdRef: React.MutableRefObject<string | null>;
  setManagerMode: (v: boolean) => void;
  setManagedTeam: (v: 0 | 1) => void;
  setStrategy: (v: Strategy) => void;
  setDecisionValues: (v: ManagerDecisionValues) => void;
  setLoadedSaveLeagueId: (v: string | null) => void;
  setGameActive: (v: boolean) => void;
  onGameSessionStarted?: () => void;
  onConsumePendingLoad?: () => void;
}

export interface UseGameSaveRestoreReturn {
  wasAlreadyFinalOnLoad: boolean;
  setWasAlreadyFinalOnLoad: (v: boolean) => void;
}

export const useGameSaveRestore = ({
  pendingLoadSave,
  dispatch,
  customTeams,
  rxSaveIdRef,
  setManagerMode,
  setManagedTeam,
  setStrategy,
  setDecisionValues,
  setLoadedSaveLeagueId,
  setGameActive,
  onGameSessionStarted,
  onConsumePendingLoad,
}: UseGameSaveRestoreOptions): UseGameSaveRestoreReturn => {
  const [wasAlreadyFinalOnLoad, setWasAlreadyFinalOnLoad] = React.useState(false);

  const prevPendingLoad = React.useRef<SaveRecord | null>(null);
  React.useEffect(() => {
    if (!pendingLoadSave) return;
    if (pendingLoadSave === prevPendingLoad.current) return;
    prevPendingLoad.current = pendingLoadSave;

    const snap = pendingLoadSave.stateSnapshot;
    if (!snap) {
      onConsumePendingLoad?.();
      return;
    }

    if (snap.rngState !== null) {
      restoreSeed(pendingLoadSave.seed);
      restoreRng(snap.rngState);
    } else {
      reinitSeed(pendingLoadSave.seed);
    }
    dispatch({
      type: "restore_game",
      payload: {
        ...snap.state,
        teamLabels: resolveRestoreLabels(snap.state, customTeams),
      },
    });

    const setup = pendingLoadSave.setup;
    setManagerMode(setup.managerMode);
    setManagedTeam(setup.managedTeam ?? 0);
    setStrategy(setup.strategy);
    setDecisionValues(
      setup.decisionValues != null
        ? sanitizeManagerDecisionValues(setup.decisionValues)
        : DEFAULT_MANAGER_DECISION_VALUES,
    );

    rxSaveIdRef.current = pendingLoadSave.id;
    setWasAlreadyFinalOnLoad(snap.state.gameOver === true);
    setLoadedSaveLeagueId(setup.leagueContext?.leagueId ?? null);
    setGameActive(true);
    onGameSessionStarted?.();
    onConsumePendingLoad?.();
    return () => {
      prevPendingLoad.current = null;
    };
  }, [
    pendingLoadSave,
    dispatch,
    customTeams,
    rxSaveIdRef,
    setManagerMode,
    setManagedTeam,
    setStrategy,
    setDecisionValues,
    setLoadedSaveLeagueId,
    setGameActive,
    onGameSessionStarted,
    onConsumePendingLoad,
  ]);

  return { wasAlreadyFinalOnLoad, setWasAlreadyFinalOnLoad };
};
