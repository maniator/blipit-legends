import * as React from "react";

import { GameHistoryStore } from "@feat/careerStats/storage/gameHistoryStore";
import {
  resolveCustomIdsInString,
  resolveTeamLabel,
} from "@feat/customTeams/adapters/customTeamAdapter";
import type { State, Strategy } from "@feat/gameplay/context/index";
import { useGameContext } from "@feat/gameplay/context/index";
import {
  DEFAULT_MANAGER_DECISION_VALUES,
  type ManagerDecisionValues,
} from "@feat/gameplay/context/managerDecisionValues";
import { useImportSave } from "@feat/saves/hooks/useImportSave";
import { useSaveSlotActions } from "@feat/saves/hooks/useSaveSlotActions";
import { useSaveStore } from "@feat/saves/hooks/useSaveStore";
import { useCustomTeams } from "@shared/hooks/useCustomTeams";
import { getRngState } from "@shared/utils/rng";
import { currentSeedStr } from "@shared/utils/saves";

import { downloadJson } from "@storage/saveIO";
import type { GameSaveSetup, SaveRecord } from "@storage/types";

interface Params {
  strategy: Strategy;
  managedTeam: 0 | 1;
  managerMode: boolean;
  decisionValues?: ManagerDecisionValues;
  currentSaveId: string | null;
  onSaveIdChange: (id: string | null) => void;
  /** Called when the user loads a save; GameInner owns the actual restore logic. */
  onLoadSave?: (slot: SaveRecord) => void;
}

export interface SavesModalState {
  ref: React.RefObject<HTMLDialogElement | null>;
  saves: SaveRecord[];
  /** Current paste-JSON textarea value (alias: pasteJson from useImportSave). */
  importText: string;
  importError: string | null;
  setImportText: (v: string) => void;
  /** True while an import is in-flight — use to disable the import button. */
  importing: boolean;
  open: () => void;
  close: () => void;
  handleSave: () => void;
  handleLoad: (slot: SaveRecord) => void;
  handleDelete: (id: string) => void;
  handleExport: (slot: SaveRecord) => void;
  handleImportPaste: () => void;
  handleFileImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Replaces any `ct_*` team ID fragment in a save name with the resolved display label. */
  resolveSaveName: (name: string) => string;
  /** Exports all game history as a signed JSON bundle and downloads it. */
  handleExportHistory: () => void;
  /** Imports a game history bundle from a file input change event. */
  handleImportHistoryFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  historyImportError: string | null;
  historyImportSuccess: string | null;
  exportingHistory: boolean;
}

export const useSavesModal = ({
  strategy,
  managedTeam,
  managerMode,
  decisionValues,
  currentSaveId,
  onSaveIdChange,
  onLoadSave,
}: Params): SavesModalState => {
  const ref = React.useRef<HTMLDialogElement>(null);
  // Exclude `dispatch` (function) and `log` (announcements array) — only serializable
  // State fields must reach fullState; functions cannot be stored in IndexedDB (DataCloneError).
  const {
    dispatch: _dispatch,
    log: _log,
    dispatchLog,
    teams,
    inning,
    pitchKey,
    ...gameStateRest
  } = useGameContext();
  // Reactive saves list — auto-updates when any save is mutated in RxDB.
  const { saves, createSave, updateProgress, deleteSave, exportRxdbSave, importRxdbSave } =
    useSaveStore();

  // Custom team docs for resolving human-readable labels on save names.
  const { teams: customTeams } = useCustomTeams();

  const logRef = React.useRef(dispatchLog);
  logRef.current = dispatchLog;
  const log = (msg: string) => logRef.current({ type: "log", payload: msg });

  const open = () => ref.current?.showModal();
  const close = () => ref.current?.close();

  const handleSave = () => {
    const teamLabel = (id: string) => resolveTeamLabel(id, customTeams);
    const name = `${teamLabel(teams[0])} vs ${teamLabel(teams[1])} · Inning ${inning}`;
    const fullState: State = { ...gameStateRest, teams, inning, pitchKey } as State;
    const setup: GameSaveSetup = {
      strategy,
      managedTeam,
      managerMode,
      homeTeam: teams[1],
      awayTeam: teams[0],
      decisionValues: decisionValues ?? DEFAULT_MANAGER_DECISION_VALUES,
    };

    if (currentSaveId) {
      // Update the existing save with a fresh state snapshot.
      updateProgress(currentSaveId, pitchKey, {
        scoreSnapshot: { away: fullState.score[0], home: fullState.score[1] },
        inningSnapshot: { inning: fullState.inning, atBat: fullState.atBat },
        stateSnapshot: { state: fullState, rngState: getRngState() },
      })
        .then(() => {
          log("Game saved!");
        })
        .catch((err: unknown) => {
          log(`Failed to save game: ${err instanceof Error ? err.message : String(err)}`);
        });
    } else {
      // Create a new explicit snapshot save.
      createSave(
        {
          homeTeamId: teams[1],
          awayTeamId: teams[0],
          seed: currentSeedStr(),
          setup,
        },
        { name },
      )
        .then(async (id) => {
          await updateProgress(id, pitchKey, {
            scoreSnapshot: { away: fullState.score[0], home: fullState.score[1] },
            inningSnapshot: { inning: fullState.inning, atBat: fullState.atBat },
            stateSnapshot: { state: fullState, rngState: getRngState() },
          });
          onSaveIdChange(id);
          log("Game saved!");
        })
        .catch((err: unknown) => {
          log(`Failed to save game: ${err instanceof Error ? err.message : String(err)}`);
        });
    }
  };

  const handleLoad = (slot: SaveRecord) => {
    // Check snapshot availability for the error case.  The actual restore
    // (dispatch, rng, localStorage) is handled by GameInner via onLoadSave so
    // that the /saves-page and in-game-modal paths share identical logic.
    const snap =
      slot.stateSnapshot ??
      saves
        .filter((s) => s.seed === slot.seed && s.stateSnapshot != null)
        .sort((a, b) => b.updatedAt - a.updatedAt)[0]?.stateSnapshot;

    if (!snap) {
      log(`Unable to load save "${slot.name}" — no state snapshot available yet.`);
      return;
    }

    // Enrich the slot so GameInner always receives a snapshot (might be a
    // fallback from a same-seed save when the clicked slot has none).
    const slotWithSnapshot: SaveRecord = slot.stateSnapshot
      ? slot
      : { ...slot, stateSnapshot: snap };

    onSaveIdChange(slot.id);
    onLoadSave?.(slotWithSnapshot);
    log(`Loaded: ${slot.name}`);
    close();
  };

  const { handleDelete, handleExport } = useSaveSlotActions({
    deleteSave,
    exportSave: exportRxdbSave,
    onDeleted: (id) => {
      if (currentSaveId === id) onSaveIdChange(null);
    },
    onError: (msg, err) => log(`${msg}: ${err instanceof Error ? err.message : String(err)}`),
  });

  // Use the shared import hook; pass raw error messages (modal consumers are
  // in-game and can tolerate technical wording; friendlyImportError is default
  // for the full-page SavesPage).
  const {
    pasteJson: importText,
    setPasteJson: setImportText,
    importError,
    importing,
    handleFileImport,
    handlePasteImport: handleImportPaste,
  } = useImportSave({
    importFn: importRxdbSave,
    onSuccess: (importedSave) => {
      log("Save imported!");
      handleLoad(importedSave);
    },
    formatError: (raw) => raw,
  });

  /**
   * Replaces any `ct_*` team ID token in a save name with the resolved display label.
   */
  const resolveSaveName = (name: string): string => resolveCustomIdsInString(name, customTeams);

  // ── Game history export/import ──────────────────────────────────────────
  const [exportingHistory, setExportingHistory] = React.useState(false);
  const [historyImportError, setHistoryImportError] = React.useState<string | null>(null);
  const [historyImportSuccess, setHistoryImportSuccess] = React.useState<string | null>(null);

  const handleExportHistory = React.useCallback(async () => {
    setExportingHistory(true);
    try {
      const json = await GameHistoryStore.exportGameHistory();
      downloadJson(json, `ballgame-history-${Date.now()}.json`);
    } catch (err) {
      logRef.current({
        type: "log",
        payload: `History export failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setExportingHistory(false);
    }
  }, []);

  const handleImportHistoryFile = React.useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setHistoryImportError(null);
      setHistoryImportSuccess(null);
      try {
        const text = await file.text();
        // Build set of known team IDs — all teams are v1 ct_* records.
        const teamIds = new Set(customTeams.map((t) => t.id));
        const result = await GameHistoryStore.importGameHistory(text, teamIds);
        const msg =
          `Imported ${result.gamesCreated} game(s), ${result.statsCreated} stat row(s). ` +
          (result.gamesSkipped + result.statsSkipped > 0
            ? `(${result.gamesSkipped} game(s), ${result.statsSkipped} stat row(s) already existed — skipped)`
            : "");
        setHistoryImportSuccess(msg.trim());
      } catch (err) {
        setHistoryImportError(err instanceof Error ? err.message : String(err));
      }
      // Reset file input so the same file can be re-imported.
      e.target.value = "";
    },
    [customTeams],
  );

  return {
    ref,
    saves,
    importText,
    importError,
    setImportText,
    importing,
    open,
    close,
    handleSave,
    handleLoad,
    handleDelete,
    handleExport,
    handleImportPaste,
    handleFileImport,
    resolveSaveName,
    handleExportHistory,
    handleImportHistoryFile,
    historyImportError,
    historyImportSuccess,
    exportingHistory,
  };
};
