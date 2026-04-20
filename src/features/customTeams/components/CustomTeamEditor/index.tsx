import * as React from "react";

import { closestCenter, DndContext } from "@dnd-kit/core";
import { useCustomTeams } from "@shared/hooks/useCustomTeams";

import type { TeamWithRoster } from "@storage/types";

import {
  editorReducer,
  editorStateToCreateInput,
  initEditorState,
  validateEditorState,
} from "./editorState";
import { BenchFormSection, LineupFormSection, PitchersSection } from "./RosterSections";
import { ButtonRow, CancelBtn, EditorContainer, EditorTitle, ErrorMsg, SaveBtn } from "./styles";
import { TeamInfoSection } from "./TeamInfoSection";
import { useEditorDragHandlers } from "./useEditorDragHandlers";
import type { PendingPlayerImport } from "./useImportPlayerFile";
import { useImportPlayerFile } from "./useImportPlayerFile";
import { usePlayerExport } from "./usePlayerExport";

type Props = {
  /** Existing team to edit. Undefined means create-new mode. */
  team?: TeamWithRoster;
  onSave: (id: string) => void;
  onCancel: () => void;
};

const CustomTeamEditor: React.FunctionComponent<Props> = ({ team, onSave, onCancel }) => {
  const [state, dispatch] = React.useReducer(editorReducer, team, initEditorState);
  const { createTeam, updateTeam, teams: allTeams } = useCustomTeams();
  const errorRef = React.useRef<HTMLParagraphElement>(null);

  const isEditMode = !!team;
  const existingPlayerIds = React.useMemo(
    () =>
      new Set([
        ...(team?.roster.lineup.map((p) => p.id) ?? []),
        ...(team?.roster.bench?.map((p) => p.id) ?? []),
        ...(team?.roster.pitchers.map((p) => p.id) ?? []),
      ]),
    [team],
  );

  const lineupFileRef = React.useRef<HTMLInputElement>(null);
  const benchFileRef = React.useRef<HTMLInputElement>(null);
  const pitchersFileRef = React.useRef<HTMLInputElement>(null);
  const [pendingPlayerImport, setPendingPlayerImport] = React.useState<PendingPlayerImport | null>(
    null,
  );

  const handleExportPlayer = usePlayerExport();

  const handleImportPlayerFile = useImportPlayerFile({
    teamId: team?.id,
    allTeams,
    lineup: state.lineup,
    bench: state.bench,
    pitchers: state.pitchers,
    dispatch,
    setPendingPlayerImport,
  });

  // Pre-bind per-section handlers; useMemo caches the curried function return values.
  const handleImportLineupFile = React.useMemo(
    () => handleImportPlayerFile("lineup"),
    [handleImportPlayerFile],
  );
  const handleImportBenchFile = React.useMemo(
    () => handleImportPlayerFile("bench"),
    [handleImportPlayerFile],
  );
  const handleImportPitchersFile = React.useMemo(
    () => handleImportPlayerFile("pitchers"),
    [handleImportPlayerFile],
  );

  const { sensors, handleLineupBenchDragEnd, handlePitchersDragEnd } = useEditorDragHandlers({
    lineup: state.lineup,
    bench: state.bench,
    pitchers: state.pitchers,
    dispatch,
  });

  const handleSave = async () => {
    const err = validateEditorState(state);
    if (err) {
      dispatch({ type: "SET_ERROR", error: err });
      setTimeout(() => {
        errorRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        errorRef.current?.focus();
      }, 0);
      return;
    }
    try {
      const input = editorStateToCreateInput(state);
      if (team) {
        await updateTeam(team.id, { roster: input.roster });
        onSave(team.id);
      } else {
        const id = await createTeam(input);
        onSave(id);
      }
    } catch (e) {
      dispatch({ type: "SET_ERROR", error: e instanceof Error ? e.message : "Save failed." });
      setTimeout(() => {
        errorRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        errorRef.current?.focus();
      }, 0);
    }
  };

  return (
    <EditorContainer>
      <EditorTitle>{team ? "Edit Team" : "Create Team"}</EditorTitle>

      <TeamInfoSection state={state} isEditMode={isEditMode} dispatch={dispatch} />

      {state.error && (
        <ErrorMsg
          ref={errorRef}
          role="alert"
          tabIndex={-1}
          data-testid="custom-team-editor-error-summary"
        >
          {state.error}
        </ErrorMsg>
      )}

      <div data-testid="lineup-bench-dnd-container">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleLineupBenchDragEnd}
        >
          <LineupFormSection
            lineup={state.lineup}
            existingPlayerIds={existingPlayerIds}
            pendingPlayerImport={pendingPlayerImport}
            dispatch={dispatch}
            setPendingPlayerImport={setPendingPlayerImport}
            lineupFileRef={lineupFileRef}
            onImportFile={handleImportLineupFile}
            handleExportPlayer={handleExportPlayer}
          />
          <BenchFormSection
            bench={state.bench}
            existingPlayerIds={existingPlayerIds}
            pendingPlayerImport={pendingPlayerImport}
            dispatch={dispatch}
            setPendingPlayerImport={setPendingPlayerImport}
            benchFileRef={benchFileRef}
            onImportFile={handleImportBenchFile}
            handleExportPlayer={handleExportPlayer}
          />
        </DndContext>
      </div>
      <PitchersSection
        pitchers={state.pitchers}
        existingPlayerIds={existingPlayerIds}
        pendingPlayerImport={pendingPlayerImport}
        dispatch={dispatch}
        setPendingPlayerImport={setPendingPlayerImport}
        pitchersFileRef={pitchersFileRef}
        onImportFile={handleImportPitchersFile}
        handleExportPlayer={handleExportPlayer}
        sensors={sensors}
        handlePitchersDragEnd={handlePitchersDragEnd}
      />

      <ButtonRow>
        <SaveBtn type="button" onClick={handleSave} data-testid="custom-team-save-button">
          Save Team
        </SaveBtn>
        <CancelBtn type="button" onClick={onCancel} data-testid="custom-team-cancel-button">
          Cancel
        </CancelBtn>
      </ButtonRow>
      {state.error && (
        <ErrorMsg role="presentation" aria-hidden="true" data-testid="custom-team-save-error-hint">
          {state.error}
        </ErrorMsg>
      )}
    </EditorContainer>
  );
};

export default CustomTeamEditor;
