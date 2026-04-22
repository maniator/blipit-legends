import * as React from "react";

import type { DragEndEvent } from "@dnd-kit/core";
import { closestCenter, DndContext, useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";

import type { EditorAction, EditorPlayer, EditorState } from "./editorState";
import { createDefaultBatter, createDefaultPitcher, makePlayerId } from "./editorState";
import SortablePlayerRow from "./SortablePlayerRow";
import {
  AddPlayerBtn,
  FormSection,
  ImportPlayerBtn,
  PlayerDuplicateActions,
  PlayerDuplicateBanner,
  SectionHeading,
  SmallIconBtn,
} from "./styles";
import { BENCH_DROPPABLE_ID, LINEUP_DROPPABLE_ID } from "./useEditorDragHandlers";
import type { PendingPlayerImport } from "./useImportPlayerFile";

// ── Blank-player factories ─────────────────────────────────────────────────────
//
// Retained for callers that explicitly want an empty row (e.g. tests). New
// "Add player / Add pitcher" buttons in the editor use `createDefaultBatter` /
// `createDefaultPitcher` from `editorState.ts` so the inserted row passes
// validation immediately on first paint.

export const makeBlankBatter = (): EditorPlayer => ({
  id: makePlayerId(),
  name: "",
  role: "batter",
  position: "",
  handedness: "R",
  contact: 60,
  power: 60,
  speed: 60,
});

export const makeBlankPitcher = (): EditorPlayer => ({
  id: makePlayerId(),
  name: "",
  role: "pitcher",
  position: "",
  handedness: "R",
  velocity: 60,
  control: 60,
  movement: 60,
});

// ── Shared duplicate-warning banner ───────────────────────────────────────────

type DuplicateBannerProps = {
  section: "lineup" | "bench" | "pitchers";
  pending: PendingPlayerImport;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  dispatch: React.Dispatch<EditorAction>;
};

const DuplicateBanner: React.FunctionComponent<DuplicateBannerProps> = ({
  section,
  pending,
  onConfirm,
  onCancel,
  dispatch,
}) => {
  const handleConfirm = React.useCallback(async () => {
    try {
      await onConfirm();
    } catch (error: unknown) {
      dispatch({
        type: "SET_ERROR",
        error:
          error instanceof Error ? error.message : "Failed to import player. Please try again.",
      });
    }
  }, [onConfirm, dispatch]);

  return (
    <PlayerDuplicateBanner role="alert" data-testid={`player-import-${section}-duplicate-banner`}>
      ⚠ {pending.warning}
      <PlayerDuplicateActions>
        <SmallIconBtn
          type="button"
          data-testid={`player-import-${section}-confirm-button`}
          onClick={() => void handleConfirm()}
        >
          Import Anyway
        </SmallIconBtn>
        <SmallIconBtn type="button" onClick={onCancel}>
          Cancel
        </SmallIconBtn>
      </PlayerDuplicateActions>
    </PlayerDuplicateBanner>
  );
};

// ── Shared section props ───────────────────────────────────────────────────────

type SectionSharedProps = {
  existingPlayerIds: Set<string>;
  pendingPlayerImport: PendingPlayerImport | null;
  dispatch: React.Dispatch<EditorAction>;
  setPendingPlayerImport: React.Dispatch<React.SetStateAction<PendingPlayerImport | null>>;
  handleExportPlayer: (p: EditorPlayer) => void;
  /** Player ID of the most recently added row (for highlight + focus). */
  newlyAddedPlayerId: string | null;
  /**
   * Called by per-section "Add" buttons. Receives the section name and a
   * factory that synthesizes a default-populated row from the current state
   * snapshot. The container takes care of dispatching ADD_PLAYER, focusing
   * the new row, announcing it to assistive tech, and triggering the
   * highlight animation.
   */
  onAddPlayerWithDefaults: (
    section: "lineup" | "bench" | "pitchers",
    makePlayer: (state: EditorState) => EditorPlayer,
  ) => void;
};

// ── LineupFormSection ──────────────────────────────────────────────────────────

type LineupFormSectionProps = SectionSharedProps & {
  lineup: EditorPlayer[];
  lineupFileRef: React.RefObject<HTMLInputElement | null>;
  onImportFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

export const LineupFormSection: React.FunctionComponent<LineupFormSectionProps> = ({
  lineup,
  existingPlayerIds,
  pendingPlayerImport,
  dispatch,
  setPendingPlayerImport,
  lineupFileRef,
  onImportFile,
  handleExportPlayer,
  newlyAddedPlayerId,
  onAddPlayerWithDefaults,
}) => {
  const { setNodeRef } = useDroppable({ id: LINEUP_DROPPABLE_ID });
  return (
    <FormSection ref={setNodeRef} data-testid="custom-team-lineup-section">
      <SectionHeading>Lineup (drag to reorder; drag to/from Bench)</SectionHeading>
      {pendingPlayerImport?.section === "lineup" && (
        <DuplicateBanner
          section="lineup"
          pending={pendingPlayerImport}
          dispatch={dispatch}
          onConfirm={async () => {
            await pendingPlayerImport.onConfirm();
            setPendingPlayerImport(null);
          }}
          onCancel={() => setPendingPlayerImport(null)}
        />
      )}
      <SortableContext items={lineup.map((p) => p.id)} strategy={verticalListSortingStrategy}>
        {lineup.map((p, i) => (
          <SortablePlayerRow
            key={p.id}
            player={p}
            isExistingPlayer={existingPlayerIds.has(p.id)}
            isNewlyAdded={p.id === newlyAddedPlayerId}
            onChange={(patch) =>
              dispatch({ type: "UPDATE_PLAYER", section: "lineup", index: i, player: patch })
            }
            onRemove={() => dispatch({ type: "REMOVE_PLAYER", section: "lineup", index: i })}
            onExport={() => handleExportPlayer(p)}
          />
        ))}
      </SortableContext>
      <AddPlayerBtn
        type="button"
        data-testid="custom-team-add-lineup-player-button"
        onClick={() =>
          onAddPlayerWithDefaults("lineup", (state) => createDefaultBatter(state, "lineup"))
        }
      >
        + Add Player
      </AddPlayerBtn>
      <input
        ref={lineupFileRef}
        type="file"
        accept=".json"
        style={{ display: "none" }}
        onChange={onImportFile}
        data-testid="import-lineup-player-input"
        aria-label="Import lineup player from file"
      />
      <ImportPlayerBtn type="button" onClick={() => lineupFileRef.current?.click()}>
        ↑ Import Player
      </ImportPlayerBtn>
    </FormSection>
  );
};

// ── BenchFormSection ───────────────────────────────────────────────────────────

type BenchFormSectionProps = SectionSharedProps & {
  bench: EditorPlayer[];
  benchFileRef: React.RefObject<HTMLInputElement | null>;
  onImportFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

export const BenchFormSection: React.FunctionComponent<BenchFormSectionProps> = ({
  bench,
  existingPlayerIds,
  pendingPlayerImport,
  dispatch,
  setPendingPlayerImport,
  benchFileRef,
  onImportFile,
  handleExportPlayer,
  newlyAddedPlayerId,
  onAddPlayerWithDefaults,
}) => {
  const { setNodeRef } = useDroppable({ id: BENCH_DROPPABLE_ID });
  return (
    <FormSection ref={setNodeRef} data-testid="custom-team-bench-section">
      <SectionHeading>Bench (drag to reorder; drag to/from Lineup)</SectionHeading>
      {pendingPlayerImport?.section === "bench" && (
        <DuplicateBanner
          section="bench"
          pending={pendingPlayerImport}
          dispatch={dispatch}
          onConfirm={async () => {
            await pendingPlayerImport.onConfirm();
            setPendingPlayerImport(null);
          }}
          onCancel={() => setPendingPlayerImport(null)}
        />
      )}
      <SortableContext items={bench.map((p) => p.id)} strategy={verticalListSortingStrategy}>
        {bench.map((p, i) => (
          <SortablePlayerRow
            key={p.id}
            player={p}
            isExistingPlayer={existingPlayerIds.has(p.id)}
            isNewlyAdded={p.id === newlyAddedPlayerId}
            onChange={(patch) =>
              dispatch({ type: "UPDATE_PLAYER", section: "bench", index: i, player: patch })
            }
            onRemove={() => dispatch({ type: "REMOVE_PLAYER", section: "bench", index: i })}
            onExport={() => handleExportPlayer(p)}
          />
        ))}
      </SortableContext>
      <AddPlayerBtn
        type="button"
        data-testid="custom-team-add-bench-player-button"
        onClick={() =>
          onAddPlayerWithDefaults("bench", (state) => createDefaultBatter(state, "bench"))
        }
      >
        + Add Player
      </AddPlayerBtn>
      <input
        ref={benchFileRef}
        type="file"
        accept=".json"
        style={{ display: "none" }}
        onChange={onImportFile}
        data-testid="import-bench-player-input"
        aria-label="Import player from file"
      />
      <ImportPlayerBtn type="button" onClick={() => benchFileRef.current?.click()}>
        ↑ Import Player
      </ImportPlayerBtn>
    </FormSection>
  );
};

// ── PitchersSection ────────────────────────────────────────────────────────────

type PitchersSectionProps = SectionSharedProps & {
  pitchers: EditorPlayer[];
  pitchersFileRef: React.RefObject<HTMLInputElement | null>;
  onImportFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  sensors: ReturnType<typeof import("@dnd-kit/core").useSensors>;
  handlePitchersDragEnd: (event: DragEndEvent) => void;
};

export const PitchersSection: React.FunctionComponent<PitchersSectionProps> = ({
  pitchers,
  existingPlayerIds,
  pendingPlayerImport,
  dispatch,
  setPendingPlayerImport,
  pitchersFileRef,
  onImportFile,
  handleExportPlayer,
  sensors,
  handlePitchersDragEnd,
  newlyAddedPlayerId,
  onAddPlayerWithDefaults,
}) => (
  <FormSection data-testid="custom-team-pitchers-section">
    <SectionHeading>Pitchers (drag to reorder)</SectionHeading>
    {pendingPlayerImport?.section === "pitchers" && (
      <DuplicateBanner
        section="pitchers"
        pending={pendingPlayerImport}
        dispatch={dispatch}
        onConfirm={async () => {
          await pendingPlayerImport.onConfirm();
          setPendingPlayerImport(null);
        }}
        onCancel={() => setPendingPlayerImport(null)}
      />
    )}
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handlePitchersDragEnd}
    >
      <SortableContext items={pitchers.map((p) => p.id)} strategy={verticalListSortingStrategy}>
        {pitchers.map((p, i) => (
          <SortablePlayerRow
            key={p.id}
            player={p}
            isPitcher
            isExistingPlayer={existingPlayerIds.has(p.id)}
            isNewlyAdded={p.id === newlyAddedPlayerId}
            onChange={(patch) =>
              dispatch({ type: "UPDATE_PLAYER", section: "pitchers", index: i, player: patch })
            }
            onRemove={() => dispatch({ type: "REMOVE_PLAYER", section: "pitchers", index: i })}
            onExport={() => handleExportPlayer(p)}
          />
        ))}
      </SortableContext>
    </DndContext>
    <AddPlayerBtn
      type="button"
      data-testid="custom-team-add-pitcher-button"
      onClick={() => onAddPlayerWithDefaults("pitchers", (state) => createDefaultPitcher(state))}
    >
      + Add Pitcher
    </AddPlayerBtn>
    <input
      ref={pitchersFileRef}
      type="file"
      accept=".json"
      style={{ display: "none" }}
      onChange={onImportFile}
      data-testid="import-pitchers-player-input"
      aria-label="Import pitcher from file"
    />
    <ImportPlayerBtn type="button" onClick={() => pitchersFileRef.current?.click()}>
      ↑ Import Pitcher
    </ImportPlayerBtn>
  </FormSection>
);
