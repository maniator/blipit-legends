import type { State, Strategy } from "@feat/gameplay/context/index";
import type { ManagerDecisionValues } from "@feat/gameplay/context/managerDecisionValues";

/** Typed setup stored on the save header for deterministic game restore. */
export interface GameSaveSetup {
  strategy: Strategy;
  /** null when the user chose "just watch" (no managed team). */
  managedTeam: 0 | 1 | null;
  managerMode: boolean;
  homeTeam: string;
  awayTeam: string;
  /** Manager/AI decision tuning values at the time of save. Optional for backward compat. */
  decisionValues?: ManagerDecisionValues;
}

/** Scored snapshot stored on the save header for quick display. */
export interface ScoreSnapshot {
  away: number;
  home: number;
}

/** Inning position snapshot stored on the save header. */
export interface InningSnapshot {
  inning: number;
  atBat: number;
}

/** Full game state snapshot — enough to resume without replaying all events. */
export interface StateSnapshot {
  state: State;
  rngState: number | null;
}

/** Persisted save-header document (one per save game). */
export interface SaveRecord {
  id: string;
  name: string;
  seed: string;
  homeTeamId: string;
  awayTeamId: string;
  createdAt: number;
  updatedAt: number;
  /** Highest pitchKey (EventRecord.at) that has been stored; acts as a progress cursor. */
  progressIdx: number;
  /** Small immutable setup blob used to reconstruct the game deterministically. */
  setup: GameSaveSetup;
  scoreSnapshot?: ScoreSnapshot;
  inningSnapshot?: InningSnapshot;
  /** Full game State + rngState captured on each half-inning, for restore. */
  stateSnapshot?: StateSnapshot;
  schemaVersion: number;
}

/** Append-only event document (one per game event). */
export interface EventRecord {
  /** Deterministic primary key: `${saveId}:${idx}` */
  id: string;
  saveId: string;
  /** Monotonic index per save, starting at 0. */
  idx: number;
  /** Deterministic position within the game — the pitchKey at the time the event occurred. */
  at: number;
  type: string;
  payload: Record<string, unknown>;
  /** Wall-clock timestamp — metadata only, NOT used for determinism. */
  ts: number;
  schemaVersion: number;
}

/** Input shape for creating a new save. */
export interface GameSetup {
  homeTeamId: string;
  awayTeamId: string;
  seed: string;
  setup: GameSaveSetup;
}

/** A single game event to be appended. */
export interface GameEvent {
  type: string;
  at: number;
  payload: Record<string, unknown>;
}

/** Optional progress-update summary fields. */
export interface ProgressSummary {
  scoreSnapshot?: ScoreSnapshot;
  inningSnapshot?: InningSnapshot;
  /** Full game State + rngState for deterministic restore. */
  stateSnapshot?: StateSnapshot;
  /**
   * Refreshed setup blob — supplied by the explicit user-driven save-overwrite
   * path (SavesModal) so changes the user has made to decisionValues / strategy /
   * managerMode / homeTeam / awayTeam since the original save are persisted on
   * overwrite. The auto-flush game-loop sync path intentionally does NOT pass this
   * field; setup should only refresh on an explicit "Update save" action.
   */
  setup?: GameSaveSetup;
}

/** Portable export format: save header + full event log, signed for integrity. */
export interface PortableSaveExport {
  version: 1;
  header: SaveRecord;
  events: EventRecord[];
  /** FNV-1a 32-bit signature of export key + JSON.stringify({header, events}) */
  sig: string;
}

/** @deprecated Use PortableSaveExport for new storage/export code. */
export type RxdbExportedSave = PortableSaveExport;
