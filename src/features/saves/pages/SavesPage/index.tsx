import * as React from "react";

import { resolveCustomIdsInString } from "@feat/customTeams/adapters/customTeamAdapter";
import SaveSlotList from "@feat/saves/components/SaveSlotList";
import { useImportSave } from "@feat/saves/hooks/useImportSave";
import { useSaveSlotActions } from "@feat/saves/hooks/useSaveSlotActions";
import { SaveStore } from "@feat/saves/storage/saveStore";
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
  HelperText,
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
  const { onLoadSave, hasActiveSession, onResumeCurrent } =
    useOutletContext<AppShellOutletContext>();
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
    markBlurred,
    notePaste,
    canImport,
    helperText,
    helperTone,
    importAnnouncement,
  } = useImportSave({
    importFn: SaveStore.importRxdbSave.bind(SaveStore),
    onSuccess: onLoadSave,
  });

  const helperId = "saves-page-import-helper";
  const importInvalid = helperTone === "error";
  const savesHeadingRef = React.useRef<HTMLHeadingElement | null>(null);
  // Move focus to the saves list heading on a successful import so screen
  // readers land on the freshly-updated content rather than back at the
  // disabled CTA. Skip the initial null → null transition.
  React.useEffect(() => {
    if (importAnnouncement) savesHeadingRef.current?.focus();
  }, [importAnnouncement]);

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

      <h2
        ref={savesHeadingRef}
        tabIndex={-1}
        data-testid="saves-list-heading"
        style={{
          color: "inherit",
          fontSize: "inherit",
          margin: 0,
          padding: 0,
          position: "absolute",
          width: 1,
          height: 1,
          overflow: "hidden",
          clip: "rect(0 0 0 0)",
          whiteSpace: "nowrap",
        }}
      >
        Saved games
      </h2>

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
            onBlur={markBlurred}
            onPaste={notePaste}
            placeholder='{"version":1,"header":{…},"events":[…],"sig":"…"}'
            data-testid="paste-save-textarea"
            aria-label="Paste save JSON"
            aria-describedby={helperId}
            aria-invalid={importInvalid || undefined}
          />
          <HelperText
            $tone={helperTone}
            id={helperId}
            data-testid="paste-save-helper"
            data-tone={helperTone}
          >
            <span role="status">{importAnnouncement ?? helperText}</span>
          </HelperText>
          <PasteActions>
            <ActionBtn
              type="button"
              $variant="primary"
              onClick={handlePasteImport}
              disabled={!canImport}
              aria-describedby={helperId}
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
