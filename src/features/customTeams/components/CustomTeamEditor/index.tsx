import * as React from "react";

import { closestCenter, DndContext } from "@dnd-kit/core";
import { useCustomTeams } from "@shared/hooks/useCustomTeams";

import type { TeamWithRoster } from "@storage/types";

import type { EditorPlayer, EditorState, ValidationIssue } from "./editorState";
import {
  collectValidationIssues,
  editorReducer,
  editorStateToCreateInput,
  initEditorState,
} from "./editorState";
import { BenchFormSection, LineupFormSection, PitchersSection } from "./RosterSections";
import {
  ButtonRow,
  CancelBtn,
  EditorContainer,
  EditorTitle,
  ErrorSummary,
  ErrorSummaryHeading,
  ErrorSummaryLink,
  ErrorSummaryList,
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

const FORM_ERROR_HEADING_ID = "form-error-heading";

const CustomTeamEditor: React.FunctionComponent<Props> = ({ team, onSave, onCancel }) => {
  const [state, dispatch] = React.useReducer(editorReducer, team, initEditorState);
  const { createTeam, updateTeam, teams: allTeams } = useCustomTeams();

  // Phase 2A — error surface state.
  //
  // - `submitIssues` is the set of validation issues captured the last
  //   time the user pressed Save. It is the canonical input to the
  //   summary block + per-field inline messages, and is recomputed every
  //   time `state` changes once the user has attempted submit.
  // - `attemptedSubmit` gates submit-button-disabled behaviour AND
  //   "validate-on-every-keystroke" inline messaging. Before the first
  //   submit attempt, only blurred fields surface inline errors.
  // - `blurredFields` tracks which inputs the user has blurred so we can
  //   show inline marking on blur without requiring a submit attempt.
  const [attemptedSubmit, setAttemptedSubmit] = React.useState(false);
  const [blurredFields, setBlurredFields] = React.useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );
  const [resolvedAnnouncement, setResolvedAnnouncement] = React.useState("");
  const headingRef = React.useRef<HTMLHeadingElement>(null);
  const prevIssueCountRef = React.useRef(0);

  /** Mark a field as blurred so its inline error can render even pre-submit. */
  const handleFieldBlur = React.useCallback((fieldId: string) => {
    setBlurredFields((prev) => {
      if (prev.has(fieldId)) return prev;
      const next = new Set(prev);
      next.add(fieldId);
      return next;
    });
  }, []);

  // Validation issues from the structured validator + the legacy
  // string-shaped `state.error` (used by import flows / async save
  // failures). We surface both inside the same summary block so users
  // never see two error UIs at once.
  const validationIssues = React.useMemo(() => collectValidationIssues(state), [state]);
  const summaryIssues: ValidationIssue[] = React.useMemo(() => {
    const importIssue: ValidationIssue | null = state.error
      ? { fieldId: "", summaryMessage: state.error }
      : null;
    return importIssue ? [importIssue, ...validationIssues] : validationIssues;
  }, [state.error, validationIssues]);
  const showSummary = summaryIssues.length > 0 && (attemptedSubmit || !!state.error);
  const issueCount = showSummary ? summaryIssues.length : 0;

  // Polite live announcement when the user fixes the last error.
  React.useEffect(() => {
    if (prevIssueCountRef.current > 0 && issueCount === 0) {
      setResolvedAnnouncement("All errors resolved");
      const t = window.setTimeout(() => setResolvedAnnouncement(""), 1500);
      prevIssueCountRef.current = issueCount;
      return () => window.clearTimeout(t);
    }
    prevIssueCountRef.current = issueCount;
  }, [issueCount]);

  /**
   * Map of fieldId → inline message, but only for issues whose field is
   * eligible to render inline — i.e. the user has either attempted to
   * submit OR has blurred that field. Used by child components to look
   * up per-input messaging.
   */
  const inlineErrors = React.useMemo(() => {
    const out: Record<string, string> = {};
    for (const issue of validationIssues) {
      if (!issue.fieldId || !issue.inlineMessage) continue;
      if (!attemptedSubmit && !blurredFields.has(issue.fieldId)) continue;
      // First issue per field wins — keeps inline copy stable when
      // multiple rules fire on the same input.
      if (!(issue.fieldId in out)) out[issue.fieldId] = issue.inlineMessage;
    }
    return out;
  }, [validationIssues, attemptedSubmit, blurredFields]);

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

  /**
   * Move focus to the form-error summary heading and ensure it's in view.
   * Caller schedules this in a `setTimeout` so the summary has rendered.
   */
  const focusErrorHeading = React.useCallback(() => {
    setTimeout(() => {
      headingRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      headingRef.current?.focus();
    }, 0);
  }, []);

  const handleSave = async () => {
    const issues = collectValidationIssues(state);
    if (issues.length > 0) {
      // Mark every previously-unblurred field as blurred so its inline
      // marker (if any) shows alongside the summary.
      setAttemptedSubmit(true);
      focusErrorHeading();
      return;
    }
    setAttemptedSubmit(true);
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
      focusErrorHeading();
    }
  };

  const handleSummaryLinkClick = React.useCallback(
    (e: React.MouseEvent<HTMLAnchorElement> | React.KeyboardEvent<HTMLAnchorElement>) => {
      const targetId = e.currentTarget.getAttribute("data-target-id");
      if (!targetId) return;
      e.preventDefault();
      const el = document.getElementById(targetId);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      // Section anchors aren't focusable by default — fall back to a
      // `tabindex="-1"` hop so screen readers/keyboard land on it.
      const focusable = el as HTMLElement;
      if (focusable.tabIndex < 0 && !focusable.hasAttribute("tabindex")) {
        focusable.setAttribute("tabindex", "-1");
      }
      focusable.focus({ preventScroll: true });
    },
    [],
  );

  const handleSummaryLinkKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLAnchorElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        handleSummaryLinkClick(e);
      }
    },
    [handleSummaryLinkClick],
  );

  const submitDisabled = attemptedSubmit && summaryIssues.length > 0;

  return (
    <EditorContainer>
      <EditorTitle>{team ? "Edit Team" : "Create Team"}</EditorTitle>

      {showSummary && (
        <ErrorSummary
          role="alert"
          aria-labelledby={FORM_ERROR_HEADING_ID}
          data-testid="custom-team-editor-error-summary"
        >
          <ErrorSummaryHeading id={FORM_ERROR_HEADING_ID} ref={headingRef} tabIndex={-1}>
            {issueCount === 1
              ? "1 issue to fix before saving"
              : `${issueCount} issues to fix before saving`}
          </ErrorSummaryHeading>
          <ErrorSummaryList>
            {summaryIssues.map((issue, idx) => (
              <li key={`${issue.fieldId}-${idx}`}>
                {issue.fieldId ? (
                  <ErrorSummaryLink
                    href={`#${issue.fieldId}`}
                    data-target-id={issue.fieldId}
                    onClick={handleSummaryLinkClick}
                    onKeyDown={handleSummaryLinkKeyDown}
                  >
                    {issue.summaryMessage}
                  </ErrorSummaryLink>
                ) : (
                  issue.summaryMessage
                )}
              </li>
            ))}
          </ErrorSummaryList>
        </ErrorSummary>
      )}

      <TeamInfoSection
        state={state}
        isEditMode={isEditMode}
        dispatch={dispatch}
        inlineErrors={inlineErrors}
        onFieldBlur={handleFieldBlur}
      />

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
      <LiveRegion
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-testid="custom-team-editor-resolved-announcement"
      >
        {resolvedAnnouncement}
      </LiveRegion>

      <ButtonRow>
        <SaveBtn
          type="button"
          onClick={handleSave}
          disabled={submitDisabled}
          aria-disabled={submitDisabled || undefined}
          title={submitDisabled ? "Fix the errors above to save" : undefined}
          data-testid="custom-team-save-button"
        >
          Save Team
        </SaveBtn>
        <CancelBtn type="button" onClick={onCancel} data-testid="custom-team-cancel-button">
          Cancel
        </CancelBtn>
      </ButtonRow>
    </EditorContainer>
  );
};

export default CustomTeamEditor;
