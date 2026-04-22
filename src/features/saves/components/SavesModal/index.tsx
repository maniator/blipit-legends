import * as React from "react";

import type { Strategy } from "@feat/gameplay/context/index";
import type { ManagerDecisionValues } from "@feat/gameplay/context/managerDecisionValues";
import SaveSlotList from "@feat/saves/components/SaveSlotList";

import type { SaveRecord } from "@storage/types";

import {
  CloseButton,
  Dialog,
  DialogTitle,
  EmptyMsg,
  ErrorMsg,
  FileInput,
  HelperText,
  ImportArea,
  Row,
  SavesButton,
  SectionHeading,
  SmallButton,
} from "./styles";
import { useSavesModal } from "./useSavesModal";

interface Props {
  strategy: Strategy;
  managedTeam: 0 | 1;
  managerMode: boolean;
  decisionValues?: ManagerDecisionValues;
  currentSaveId: string | null;
  onSaveIdChange: (id: string | null) => void;
  onLoadSave?: (slot: SaveRecord) => void;
  /** When true a real game session is active and "Save current game" is shown. */
  gameStarted?: boolean;
}

const SavesModal: React.FunctionComponent<Props> = (props) => {
  const {
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
    markBlurred,
    notePaste,
    canImport,
    helperText,
    helperTone,
    importAnnouncement,
    resolveSaveName,
    handleExportHistory,
    handleImportHistoryFile,
    historyImportError,
    historyImportSuccess,
    exportingHistory,
  } = useSavesModal(props);

  const helperId = "saves-modal-import-helper";
  // aria-invalid only appears once the field has been blurred OR pasted
  // into AND the contents fail the cheap envelope-shape check. helperTone
  // already encodes both gates, so we can mirror it for the textarea.
  const importInvalid = helperTone === "error";

  const handleClose = close;

  const handleClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (!ref.current?.open) return;
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const outside =
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom;
    if (outside) handleClose();
  };

  return (
    <>
      <SavesButton
        $variant="saves"
        onClick={open}
        aria-label="Open saves panel"
        data-testid="saves-button"
      >
        💾 Saves
      </SavesButton>

      <Dialog
        ref={ref}
        onClick={handleClick}
        onCancel={(e: React.SyntheticEvent) => {
          e.preventDefault();
          handleClose();
        }}
        data-testid="saves-modal"
      >
        <DialogTitle>💾 Saves</DialogTitle>

        {props.gameStarted && (
          <SmallButton onClick={handleSave} data-testid="save-game-button">
            {props.currentSaveId ? "Update save" : "Save current game"}
          </SmallButton>
        )}

        <SectionHeading>Saved games</SectionHeading>
        {saves.length === 0 ? (
          <EmptyMsg>No saves yet.</EmptyMsg>
        ) : (
          <SaveSlotList
            saves={saves}
            resolveName={resolveSaveName}
            onLoad={handleLoad}
            onExport={handleExport}
            onDelete={handleDelete}
            listTestId="saves-modal-list"
          />
        )}

        <SectionHeading>Import save</SectionHeading>
        {/* TODO: This import UI (file-input + paste textarea + error) is duplicated in
            SavesPage/index.tsx. Both surfaces already share useImportSave for logic;
            extracting the JSX into a shared <SaveImportForm> component would ensure
            any future import-handling bug is fixed in one place. */}
        <Row>
          <FileInput
            type="file"
            accept=".json,application/json"
            onChange={handleFileImport}
            disabled={importing}
            data-testid="import-save-file-input"
          />
        </Row>
        <ImportArea
          rows={4}
          placeholder="…or paste exported JSON here"
          value={importText}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setImportText(e.target.value)}
          onBlur={markBlurred}
          onPaste={notePaste}
          aria-label="Import save JSON"
          aria-describedby={helperId}
          aria-invalid={importInvalid || undefined}
          data-testid="import-save-textarea"
        />
        <HelperText
          $tone={helperTone}
          id={helperId}
          data-testid="import-save-helper"
          data-tone={helperTone}
        >
          <span role="status">{importAnnouncement ?? helperText}</span>
        </HelperText>
        {importError && <ErrorMsg data-testid="import-error">{importError}</ErrorMsg>}
        <Row>
          <SmallButton
            onClick={handleImportPaste}
            disabled={!canImport}
            aria-describedby={helperId}
            data-testid="import-save-button"
          >
            {importing ? "Importing…" : "Import from text"}
          </SmallButton>
        </Row>

        <SectionHeading>Game history</SectionHeading>
        <Row>
          <SmallButton
            onClick={handleExportHistory}
            disabled={exportingHistory}
            data-testid="export-history-button"
          >
            {exportingHistory ? "Exporting…" : "Export history"}
          </SmallButton>
        </Row>
        <Row>
          <FileInput
            type="file"
            accept=".json,application/json"
            onChange={handleImportHistoryFile}
            data-testid="import-history-file-input"
          />
        </Row>
        {historyImportError && (
          <ErrorMsg data-testid="import-history-error">{historyImportError}</ErrorMsg>
        )}
        {historyImportSuccess && (
          <ErrorMsg as="p" style={{ color: "#6ab0e0" }} data-testid="import-history-success">
            {historyImportSuccess}
          </ErrorMsg>
        )}

        <CloseButton onClick={handleClose} data-testid="saves-modal-close-button">
          Close
        </CloseButton>
      </Dialog>
    </>
  );
};

export default SavesModal;
