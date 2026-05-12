import * as React from "react";

import { resolveCustomIdsInString } from "@feat/customTeams/adapters/customTeamAdapter";
import SaveSlotList from "@feat/saves/components/SaveSlotList";
import { useImportSave } from "@feat/saves/hooks/useImportSave";
import { useSaveSlotActions } from "@feat/saves/hooks/useSaveSlotActions";
import { SaveStore } from "@feat/saves/storage/saveStore";
import { useAppSession } from "@shared/context/AppSessionContext";
import { useNavigate, useOutletContext } from "react-router";

import { teamsCollection } from "@storage/db";
import type { AppShellOutletContext } from "@storage/types";
import type { SaveRecord, TeamRecord } from "@storage/types";

import {
  ActionBtn,
  BackBtn,
  EmptyState,
  ErrorMessage,
  FileInput,
  ImportSection,
  ImportSectionTitle,
  LoadingState,
  PageContainer,
  PageHeader,
  PageTitle,
  PasteActions,
  PasteTextarea,
} from "./styles";

/**
 * Standalone Exhibition Saves page.
 *
 * Loads saves directly from SaveStore (non-reactive) rather than via the
 * reactive RxDB hook so it can live outside the <RxDatabaseProvider> tree.
 * The "Load" action is routed through AppShell outlet context so AppShell
 * can store the pending save, mount the Game, and navigate to /game.
 */
const SavesPage: React.FunctionComponent = () => {
  const navigate = useNavigate();
  const { onLoadSave, onResumeCurrent } = useOutletContext<AppShellOutletContext>();
  const { hasActiveSession } = useAppSession();
  const [saves, setSaves] = React.useState<SaveRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [teams, setTeams] = React.useState<TeamRecord[]>([]);

  const {
    pasteJson,
    setPasteJson,
    importError,
    importing,
    handleFileImport,
    handlePasteImport,
    handlePasteFromClipboard,
  } = useImportSave({
    importFn: SaveStore.importRxdbSave.bind(SaveStore),
    onSuccess: onLoadSave,
  });

  const loadSaves = React.useCallback(() => {
    setLoading(true);
    Promise.allSettled([SaveStore.listSaves(), teamsCollection().then((col) => col.find().exec())])
      .then(([saveResult, teamsResult]) => {
        setSaves(saveResult.status === "fulfilled" ? saveResult.value : []);
        setTeams(
          teamsResult.status === "fulfilled"
            ? teamsResult.value.map((d) => d.toJSON() as unknown as TeamRecord)
            : [],
        );
      })
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    loadSaves();
  }, [loadSaves]);

  const { handleDelete, handleExport } = useSaveSlotActions({
    deleteSave: (id) => SaveStore.deleteSave(id),
    exportSave: (id) => SaveStore.exportRxdbSave(id),
    onDeleted: (id) => setSaves((prev) => prev.filter((s) => s.id !== id)),
  });

  return (
    <PageContainer data-testid="saves-page">
      <PageHeader>
        <BackBtn
          type="button"
          onClick={() => navigate("/")}
          data-testid="saves-page-back-button"
          aria-label="Back to Home"
        >
          ← Back to Home
        </BackBtn>
        {hasActiveSession && (
          <BackBtn
            type="button"
            onClick={onResumeCurrent}
            data-testid="saves-page-back-to-game-button"
            aria-label="Back to Game"
          >
            ← Back to Game
          </BackBtn>
        )}
      </PageHeader>

      <PageTitle>💾 Exhibition Saves</PageTitle>

      {loading ? (
        <LoadingState>Loading saves…</LoadingState>
      ) : saves.length === 0 ? (
        <EmptyState data-testid="saves-page-empty">No saves yet.</EmptyState>
      ) : (
        <SaveSlotList
          saves={saves}
          resolveName={(name) => resolveCustomIdsInString(name, teams)}
          onLoad={onLoadSave}
          onExport={handleExport}
          onDelete={handleDelete}
        />
      )}

      <ImportSection>
        <div>
          <ImportSectionTitle>Import from file</ImportSectionTitle>
          <FileInput
            type="file"
            accept=".json,application/json"
            onChange={handleFileImport}
            disabled={importing}
            data-testid="import-save-file-input"
          />
        </div>
        <div>
          <ImportSectionTitle>Paste save JSON</ImportSectionTitle>
          <PasteTextarea
            value={pasteJson}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPasteJson(e.target.value)}
            placeholder='{"version":1,"header":{…},"events":[…],"sig":"…"}'
            data-testid="paste-save-textarea"
            aria-label="Paste save JSON"
          />
          <PasteActions>
            <ActionBtn
              type="button"
              $variant="primary"
              onClick={handlePasteImport}
              disabled={importing}
              data-testid="paste-save-button"
            >
              {importing ? "Importing…" : "Import from text"}
            </ActionBtn>
            {typeof navigator !== "undefined" && navigator.clipboard && (
              <ActionBtn
                type="button"
                onClick={handlePasteFromClipboard}
                data-testid="paste-from-clipboard-button"
              >
                Paste from clipboard
              </ActionBtn>
            )}
          </PasteActions>
        </div>
      </ImportSection>

      {importError && <ErrorMessage data-testid="import-error">{importError}</ErrorMessage>}
    </PageContainer>
  );
};

export default SavesPage;
