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

export interface UseModalLoadSaveOptions {
  dispatch: (action: GameAction) => void;
  customTeams: TeamWithRoster[];
  rxSaveIdRef: React.MutableRefObject<string | null>;
  /** Guard ref shared with useAutoRestoreSave — set to true on modal load. */
  restoredRef: React.MutableRefObject<boolean>;
  setManagerMode: (v: boolean) => void;
  setManagedTeam: (v: 0 | 1) => void;
  setStrategy: (v: Strategy) => void;
  setDecisionValues: (v: ManagerDecisionValues) => void;
  setWasAlreadyFinalOnLoad: (v: boolean) => void;
  setLoadedSaveLeagueId: (v: string | null) => void;
  setGameActive: (v: boolean) => void;
  onGameSessionStarted?: () => void;
}

/** Returns a stable handleModalLoad callback that restores game state from a save slot. */
export const useModalLoadSave = ({
  dispatch,
  customTeams,
  rxSaveIdRef,
  restoredRef,
  setManagerMode,
  setManagedTeam,
  setStrategy,
  setDecisionValues,
  setWasAlreadyFinalOnLoad,
  setLoadedSaveLeagueId,
  setGameActive,
  onGameSessionStarted,
}: UseModalLoadSaveOptions): ((slot: SaveRecord) => void) => {
  return React.useCallback(
    (slot: SaveRecord) => {
      const snap = slot.stateSnapshot;
      if (!snap) return;

      // Prevent the auto-resume effect from re-running while we restore.
      restoredRef.current = true;

      if (snap.rngState !== null) {
        restoreSeed(slot.seed);
        restoreRng(snap.rngState);
      } else {
        reinitSeed(slot.seed);
      }
      dispatch({
        type: "restore_game",
        payload: {
          ...snap.state,
          teamLabels: resolveRestoreLabels(snap.state, customTeams),
        },
      });

      const { setup } = slot;
      setManagerMode(setup.managerMode);
      setManagedTeam(setup.managedTeam ?? 0);
      setStrategy(setup.strategy);
      setDecisionValues(
        setup.decisionValues != null
          ? sanitizeManagerDecisionValues(setup.decisionValues)
          : DEFAULT_MANAGER_DECISION_VALUES,
      );

      rxSaveIdRef.current = slot.id;
      // If the loaded save was already FINAL, mark it so history sync skips re-commit.
      setWasAlreadyFinalOnLoad(snap.state.gameOver === true);
      setLoadedSaveLeagueId(slot.setup.leagueContext?.leagueId ?? null);
      setGameActive(true); // no-op if already active; triggers scheduler if game was over
      onGameSessionStarted?.();
    },
    [
      dispatch,
      customTeams,
      restoredRef,
      setManagerMode,
      setManagedTeam,
      setStrategy,
      setDecisionValues,
      setWasAlreadyFinalOnLoad,
      setLoadedSaveLeagueId,
      onGameSessionStarted,
    ],
  );
};
