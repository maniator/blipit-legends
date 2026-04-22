import * as React from "react";

import { closestCenter, DndContext } from "@dnd-kit/core";
import { useCustomTeams } from "@shared/hooks/useCustomTeams";

import type { TeamWithRoster } from "@storage/types";

import type { EditorPlayer, EditorState } from "./editorState";
import {
  editorReducer,
  editorStateToCreateInput,
  initEditorState,
  validateEditorState,
} from "./editorState";
import { BenchFormSection, LineupFormSection, PitchersSection } from "./RosterSections";
import {
  ButtonRow,
  CancelBtn,
  EditorContainer,
  EditorTitle,
  ErrorMsg,
  LiveRegion,
  SaveBtn,
} from "./styles";
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

  // Track the most recently added player so its row can apply the one-shot
  // highlight + autofocus the name input. Cleared after the highlight window
  // (1.5s) so subsequent edits / re-renders don't re-trigger the animation.
  const [newlyAddedPlayerId, setNewlyAddedPlayerId] = React.useState<string | null>(null);
  const [addAnnouncement, setAddAnnouncement] = React.useState("");
  const stateRef = React.useRef(state);
  stateRef.current = state;

  React.useEffect(() => {
    if (!newlyAddedPlayerId) return;
    const t = window.setTimeout(() => setNewlyAddedPlayerId(null), 1500);
    return () => window.clearTimeout(t);
  }, [newlyAddedPlayerId]);

  /**
   * Adds a player to the requested section using a default-populated factory.
   * Centralises the announcement / focus / highlight side effects so each
   * "Add" button stays a one-liner.
   */
  const handleAddPlayerWithDefaults = React.useCallback(
    (
      section: "lineup" | "bench" | "pitchers",
      makePlayer: (state: EditorState) => EditorPlayer,
    ) => {
      const player = makePlayer(stateRef.current);
      dispatch({ type: "ADD_PLAYER", section, player });
      setNewlyAddedPlayerId(player.id);
      const noun = section === "pitchers" ? "pitcher" : "batter";
      setAddAnnouncement(`New ${noun} added — ${player.name}`);
    },
    [],
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
            newlyAddedPlayerId={newlyAddedPlayerId}
            onAddPlayerWithDefaults={handleAddPlayerWithDefaults}
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
            newlyAddedPlayerId={newlyAddedPlayerId}
            onAddPlayerWithDefaults={handleAddPlayerWithDefaults}
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
        newlyAddedPlayerId={newlyAddedPlayerId}
        onAddPlayerWithDefaults={handleAddPlayerWithDefaults}
      />

      <LiveRegion
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-testid="custom-team-editor-add-announcement"
      >
        {addAnnouncement}
      </LiveRegion>

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
