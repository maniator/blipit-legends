import * as React from "react";

import { resolveRestoreLabels } from "@feat/customTeams/adapters/customTeamAdapter";
import type { GameAction, Strategy } from "@feat/gameplay/context/index";
import type { ManagerDecisionValues } from "@feat/gameplay/context/managerDecisionValues";
import {
  DEFAULT_MANAGER_DECISION_VALUES,
  sanitizeManagerDecisionValues,
} from "@feat/gameplay/context/managerDecisionValues";
import { useSaveStore } from "@feat/saves/hooks/useSaveStore";
import { getSeed, reinitSeed, restoreRng, restoreSeed } from "@shared/utils/rng";

import type { SaveRecord, TeamWithRoster } from "@storage/types";

/** Finds the best save to auto-resume: prefer seed+snapshot match, fallback to any snapshot. */
export const findMatchedSave = (saves: SaveRecord[]): SaveRecord | null => {
  const currentSeed = getSeed()?.toString(36);
  let anySnapshot: SaveRecord | null = null;
  for (const s of saves) {
    if (s.stateSnapshot == null) continue;
    if (currentSeed != null && s.seed === currentSeed) return s; // best match
    if (anySnapshot == null) anySnapshot = s; // first snapshot fallback
  }
  return anySnapshot;
};

export interface UseAutoRestoreSaveOptions {
  /** true when pendingGameSetup or pendingLoadSave is set — skips auto-restore. */
  skipAutoRestore: boolean;
  dispatch: (action: GameAction) => void;
  customTeams: TeamWithRoster[];
  customTeamsLoading: boolean;
  rxSaveIdRef: React.MutableRefObject<string | null>;
  setManagerMode: (v: boolean) => void;
  setManagedTeam: (v: 0 | 1) => void;
  setStrategy: (v: Strategy) => void;
  setDecisionValues: (v: ManagerDecisionValues) => void;
  setWasAlreadyFinalOnLoad: (v: boolean) => void;
  setLoadedSaveLeagueId: (v: string | null) => void;
  setGameActive: (v: boolean) => void;
  onGameSessionStarted?: () => void;
}

export interface UseAutoRestoreSaveReturn {
  /** Guard ref — set to true once any restore path has fired to prevent double-restore. */
  restoredRef: React.MutableRefObject<boolean>;
  createSave: ReturnType<typeof useSaveStore>["createSave"];
  saves: ReturnType<typeof useSaveStore>["saves"];
}

export const useAutoRestoreSave = ({
  skipAutoRestore,
  dispatch,
  customTeams,
  customTeamsLoading,
  rxSaveIdRef,
  setManagerMode,
  setManagedTeam,
  setStrategy,
  setDecisionValues,
  setWasAlreadyFinalOnLoad,
  setLoadedSaveLeagueId,
  setGameActive,
  onGameSessionStarted,
}: UseAutoRestoreSaveOptions): UseAutoRestoreSaveReturn => {
  const { saves, createSave } = useSaveStore();

  // restoredRef is initialized to true when skipAutoRestore is set so that
  // auto-resume is bypassed when a pendingGameSetup or pendingLoadSave is active.
  const restoredRef = React.useRef(skipAutoRestore);

  const [rxAutoSave, setRxAutoSave] = React.useState<SaveRecord | null>(null);

  // Set rxAutoSave once when the first seed-matched save appears in the reactive list.
  React.useEffect(() => {
    if (restoredRef.current) return;
    const matched = findMatchedSave(saves);
    if (!matched) return;
    restoredRef.current = true;
    setRxAutoSave(matched);
  }, [saves]);

  // Restore state from the RxDB save as soon as it is loaded and auto-activate the session.
  // Guard against double-dispatch if customTeams updates after the initial restore.
  const prevRxAutoSaveRef = React.useRef<SaveRecord | null>(null);
  React.useEffect(() => {
    if (!rxAutoSave || rxAutoSave === prevRxAutoSaveRef.current) return;
    if (customTeamsLoading) return; // defer until custom teams are loaded
    prevRxAutoSaveRef.current = rxAutoSave;
    const { stateSnapshot: snap, setup } = rxAutoSave;
    if (!snap) return;
    if (snap.rngState !== null) {
      restoreSeed(rxAutoSave.seed);
      restoreRng(snap.rngState);
    } else {
      reinitSeed(rxAutoSave.seed);
    }
    dispatch({
      type: "restore_game",
      payload: {
        ...snap.state,
        teamLabels: resolveRestoreLabels(snap.state, customTeams),
      },
    });
    setStrategy(setup.strategy);
    if (setup.managedTeam !== null) setManagedTeam(setup.managedTeam);
    setManagerMode(setup.managerMode);
    setDecisionValues(
      setup.decisionValues != null
        ? sanitizeManagerDecisionValues(setup.decisionValues)
        : DEFAULT_MANAGER_DECISION_VALUES,
    );
    rxSaveIdRef.current = rxAutoSave.id;
    // If the restored save was already FINAL, mark it so history sync skips re-commit.
    setWasAlreadyFinalOnLoad(snap.state.gameOver === true);
    setLoadedSaveLeagueId(setup.leagueContext?.leagueId ?? null);
    setGameActive(true);
    onGameSessionStarted?.();
  }, [
    dispatch,
    rxAutoSave,
    customTeams,
    customTeamsLoading,
    setStrategy,
    setManagedTeam,
    setManagerMode,
    setDecisionValues,
    setWasAlreadyFinalOnLoad,
    setLoadedSaveLeagueId,
    onGameSessionStarted,
    // rxSaveIdRef is a MutableRefObject — intentionally excluded (refs are stable).
    // setGameActive is a useState setter — intentionally excluded (guaranteed stable by React).
  ]);

  return { restoredRef, createSave, saves };
};
