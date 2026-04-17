import type {
  CustomTeamDraft,
  GeneratedPlayer,
} from "@feat/customTeams/generation/generateDefaultTeam";

import type {
  CreateCustomTeamInput,
  TeamBatterPlayer,
  TeamPitcherPlayer,
  TeamPlayer,
  TeamWithRoster,
} from "@storage/types";

import { DEFAULT_LINEUP_POSITIONS, REQUIRED_FIELD_POSITIONS } from "./playerConstants";
import { HITTER_STAT_CAP, hitterStatTotal, PITCHER_STAT_CAP, pitcherStatTotal } from "./statBudget";

/** A batter row as edited in the form. */
export interface EditorBatterPlayer {
  id: string;
  name: string;
  role: "batter";
  /** Position code (e.g. "C", "1B", "SS"). Empty string while unset. */
  position: string;
  handedness: "R" | "L" | "S";
  contact: number;
  power: number;
  speed: number;
  /**
   * Round-tripped from the persisted doc — not shown in the editor UI.
   * Preserved so a save/reload cycle does not silently reset the value.
   * Defaults to 50 when absent.
   */
  stamina?: number;
}

/** A pitcher row as edited in the form. */
export interface EditorPitcherPlayer {
  id: string;
  name: string;
  role: "pitcher";
  /** Position code (e.g. "SP", "RP"). Empty string while unset. */
  position: string;
  handedness: "R" | "L" | "S";
  velocity: number;
  control: number;
  movement: number;
  pitchingRole?: "SP" | "RP" | "SP/RP";
  /**
   * Round-tripped from the persisted doc — not shown in the editor UI.
   * Preserved so a save/reload cycle does not silently reset the value.
   * Defaults to 60 when absent.
   */
  stamina?: number;
}

export type EditorPlayer = EditorBatterPlayer | EditorPitcherPlayer;

/**
 * Patch shape for UPDATE_PLAYER actions and `onChange` callbacks.
 * A partial of either variant — callers patch only the fields relevant to
 * the player's role.
 */
export type EditorPlayerPatch = Partial<EditorBatterPlayer> | Partial<EditorPitcherPlayer>;

export interface EditorState {
  name: string;
  /** 2–3 char compact team label. Empty string while unset. */
  abbreviation: string;
  city: string;
  nickname: string;
  lineup: EditorBatterPlayer[];
  bench: EditorBatterPlayer[];
  pitchers: EditorPitcherPlayer[];
  error: string;
}

export type EditorAction =
  | { type: "SET_FIELD"; field: "name" | "abbreviation" | "city" | "nickname"; value: string }
  | {
      type: "UPDATE_PLAYER";
      section: "lineup" | "bench" | "pitchers";
      index: number;
      player: EditorPlayerPatch;
    }
  | { type: "ADD_PLAYER"; section: "lineup" | "bench" | "pitchers"; player: EditorPlayer }
  | { type: "REMOVE_PLAYER"; section: "lineup" | "bench" | "pitchers"; index: number }
  | { type: "MOVE_UP"; section: "lineup" | "bench" | "pitchers"; index: number }
  | { type: "MOVE_DOWN"; section: "lineup" | "bench" | "pitchers"; index: number }
  /** Reorder section by new ordered list of player IDs (used by DnD drag-end). */
  | { type: "REORDER"; section: "lineup" | "bench" | "pitchers"; orderedIds: string[] }
  /** Move a player from one section (lineup/bench) to the other at a given index. */
  | {
      type: "TRANSFER_PLAYER";
      fromSection: "lineup" | "bench";
      toSection: "lineup" | "bench";
      playerId: string;
      toIndex: number;
    }
  | { type: "APPLY_DRAFT"; draft: CustomTeamDraft }
  | { type: "SET_ERROR"; error: string };

let playerIdCounter = 0;
export const makePlayerId = (): string => `ep_${Date.now()}_${++playerIdCounter}`;

const moveItem = <T>(arr: T[], from: number, to: number): T[] => {
  if (to < 0 || to >= arr.length) return arr;
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, [action.field]: action.value, error: "" };
    case "UPDATE_PLAYER": {
      // Use EditorPlayer[] cast so the spread works uniformly across all sections.
      const list = [...(state[action.section] as EditorPlayer[])];
      list[action.index] = { ...list[action.index], ...action.player } as EditorPlayer;
      return { ...state, [action.section]: list, error: "" };
    }
    case "ADD_PLAYER":
      return { ...state, [action.section]: [...state[action.section], action.player], error: "" };
    case "REMOVE_PLAYER": {
      const list = (state[action.section] as EditorPlayer[]).filter((_, i) => i !== action.index);
      return { ...state, [action.section]: list, error: "" };
    }
    case "REORDER": {
      const lookup = new Map((state[action.section] as EditorPlayer[]).map((p) => [p.id, p]));
      const reordered = action.orderedIds.flatMap((id) => {
        const p = lookup.get(id);
        return p ? [p] : [];
      });
      return { ...state, [action.section]: reordered };
    }
    case "TRANSFER_PLAYER": {
      const player = state[action.fromSection].find((p) => p.id === action.playerId);
      if (!player) return state;
      const fromList = state[action.fromSection].filter((p) => p.id !== action.playerId);
      const toList = [...state[action.toSection]];
      const clampedIndex = Math.max(0, Math.min(action.toIndex, toList.length));
      toList.splice(clampedIndex, 0, player);
      return { ...state, [action.fromSection]: fromList, [action.toSection]: toList };
    }
    case "MOVE_UP":
      return {
        ...state,
        [action.section]: moveItem(
          state[action.section] as EditorPlayer[],
          action.index,
          action.index - 1,
        ),
      };
    case "MOVE_DOWN":
      return {
        ...state,
        [action.section]: moveItem(
          state[action.section] as EditorPlayer[],
          action.index,
          action.index + 1,
        ),
      };
    case "APPLY_DRAFT":
      return {
        ...state,
        name: action.draft.name,
        abbreviation: action.draft.abbreviation ?? "",
        city: action.draft.city,
        nickname: action.draft.nickname,
        lineup: action.draft.roster.lineup.map(draftBatterToEditor),
        bench: (action.draft.roster.bench ?? []).map(draftBatterToEditor),
        pitchers: action.draft.roster.pitchers.map(draftPitcherToEditor),
        error: "",
      };
    case "SET_ERROR":
      return { ...state, error: action.error };
    default:
      return state;
  }
}

const draftBatterToEditor = (p: GeneratedPlayer): EditorBatterPlayer => ({
  id: p.id,
  name: p.name,
  role: "batter",
  position: p.position ?? "",
  handedness: p.handedness ?? "R",
  contact: p.batting.contact,
  power: p.batting.power,
  speed: p.batting.speed,
  stamina: p.batting.stamina,
});

const draftPitcherToEditor = (p: GeneratedPlayer): EditorPitcherPlayer => {
  const pitching = p.pitching ?? { velocity: 60, control: 60, movement: 60, stamina: 60 };
  return {
    id: p.id,
    name: p.name,
    role: "pitcher",
    position: p.position ?? "",
    handedness: p.handedness ?? "R",
    velocity: pitching.velocity,
    control: pitching.control,
    movement: pitching.movement,
    stamina: pitching.stamina,
    ...(p.pitchingRole !== undefined && { pitchingRole: p.pitchingRole }),
  };
};

const docBatterToEditor = (p: TeamBatterPlayer): EditorBatterPlayer => ({
  id: p.id,
  name: p.name,
  role: "batter",
  position: p.position ?? "",
  handedness: p.handedness ?? "R",
  contact: p.batting.contact,
  power: p.batting.power,
  speed: p.batting.speed,
  stamina: p.batting.stamina,
});

const docPitcherToEditor = (p: TeamPitcherPlayer): EditorPitcherPlayer => {
  const pitching = p.pitching ?? { velocity: 60, control: 60, movement: 60, stamina: 60 };
  return {
    id: p.id,
    name: p.name,
    role: "pitcher",
    position: p.position ?? "",
    handedness: p.handedness ?? "R",
    velocity: pitching.velocity,
    control: pitching.control,
    movement: pitching.movement,
    stamina: pitching.stamina,
    ...(p.pitchingRole !== undefined && { pitchingRole: p.pitchingRole }),
  };
};

const docPlayerToEditor = (p: TeamPlayer): EditorPlayer =>
  p.role === "pitcher" ? docPitcherToEditor(p) : docBatterToEditor(p);

export const initEditorState = (team?: TeamWithRoster): EditorState => ({
  name: team?.name ?? "",
  abbreviation: team?.abbreviation ?? "",
  city: team?.city ?? "",
  nickname: team?.nickname ?? "",
  lineup: (team?.roster.lineup ?? []).map(docPlayerToEditor) as EditorBatterPlayer[],
  bench: (team?.roster.bench ?? []).map(docPlayerToEditor) as EditorBatterPlayer[],
  pitchers: (team?.roster.pitchers ?? []).map(docPlayerToEditor) as EditorPitcherPlayer[],
  error: "",
});

/** Validates the state and returns an error string or empty string if valid. */
export function validateEditorState(state: EditorState): string {
  if (!state.name.trim()) return "Team name is required.";
  const abbrev = state.abbreviation.trim();
  if (!abbrev) return "Team abbreviation is required (2–3 characters).";
  if (abbrev.length < 2 || abbrev.length > 3) return "Team abbreviation must be 2–3 characters.";
  if (state.lineup.length === 0) return "At least 1 lineup player is required.";
  for (const p of [...state.lineup, ...state.bench, ...state.pitchers]) {
    if (!p.name.trim()) return "All players must have a name.";
  }

  // Enforce unique player names within the team (case-insensitive across all slots).
  const allPlayersForDup = [...state.lineup, ...state.bench, ...state.pitchers].filter((p) =>
    p.name.trim(),
  );
  const seenNamesMap = new Map<string, string>(); // lowercase → first-seen original-cased name
  const dupOriginals = new Set<string>();
  for (const p of allPlayersForDup) {
    const lower = p.name.trim().toLowerCase();
    if (seenNamesMap.has(lower)) {
      dupOriginals.add(seenNamesMap.get(lower)!);
    } else {
      seenNamesMap.set(lower, p.name.trim());
    }
  }
  if (dupOriginals.size > 0) {
    const display = [...dupOriginals].map((n) => `"${n}"`).join(", ");
    return `Duplicate player name(s) within this team: ${display}. Each player must have a unique name.`;
  }

  // Check starting lineup for duplicate or missing required positions.
  const lineupPosCounts = new Map<string, number>();
  for (const p of state.lineup) {
    if (p.position) lineupPosCounts.set(p.position, (lineupPosCounts.get(p.position) ?? 0) + 1);
  }
  const duplicateLineupPos = DEFAULT_LINEUP_POSITIONS.filter(
    (pos) => (lineupPosCounts.get(pos) ?? 0) > 1,
  );
  const missingLineupPos = DEFAULT_LINEUP_POSITIONS.filter((pos) => !lineupPosCounts.has(pos));
  if (duplicateLineupPos.length > 0) {
    return `Starting lineup has duplicate position(s): ${duplicateLineupPos.join(", ")}. Each position must appear exactly once.`;
  }
  if (missingLineupPos.length > 0) {
    return `Starting lineup is missing position(s): ${missingLineupPos.join(", ")}.`;
  }

  // Check that all required field positions are covered in lineup + bench.
  const fieldPlayers = [...state.lineup, ...state.bench];
  const coveredPositions = new Set(fieldPlayers.map((p) => p.position).filter(Boolean));
  const missingPositions = REQUIRED_FIELD_POSITIONS.filter((pos) => !coveredPositions.has(pos));
  if (missingPositions.length > 0) {
    return `Roster must include at least one player at each of: ${missingPositions.join(", ")}.`;
  }

  // Check hitter stat cap (contact + power + speed ≤ HITTER_STAT_CAP).
  for (const player of [...state.lineup, ...state.bench]) {
    const total = hitterStatTotal(player.contact, player.power, player.speed);
    if (total > HITTER_STAT_CAP) {
      return `${player.name || "A hitter"} is over the stat cap (${total} / ${HITTER_STAT_CAP}).`;
    }
  }

  // Check pitcher stat cap (velocity + control + movement ≤ PITCHER_STAT_CAP).
  for (const player of state.pitchers) {
    if (
      player.velocity === undefined ||
      player.control === undefined ||
      player.movement === undefined
    ) {
      return `${player.name || "A pitcher"} is missing pitching stats.`;
    }
    const total = pitcherStatTotal(player.velocity, player.control, player.movement);
    if (total > PITCHER_STAT_CAP) {
      return `${player.name || "A pitcher"} is over the stat cap (${total} / ${PITCHER_STAT_CAP}).`;
    }
  }

  return "";
}

/** Maps EditorState to CreateCustomTeamInput. */
export function editorStateToCreateInput(state: EditorState): CreateCustomTeamInput {
  return {
    name: state.name.trim(),
    abbreviation: state.abbreviation.trim().toUpperCase(),
    city: state.city.trim() || undefined,
    nickname: state.nickname.trim() || undefined,
    roster: {
      lineup: state.lineup.map(editorToTeamPlayer),
      bench: state.bench.map(editorToTeamPlayer),
      pitchers: state.pitchers.map(editorToTeamPlayer),
    },
  };
}

const editorToTeamPlayer = (p: EditorPlayer): TeamPlayer => {
  const trimmedPosition = p.position.trim();

  if (p.role === "pitcher") {
    const pitcherRoleFromPosition =
      trimmedPosition === "SP" || trimmedPosition === "RP" || trimmedPosition === "SP/RP"
        ? trimmedPosition
        : undefined;
    const normalizedPitchingRole = p.pitchingRole ?? pitcherRoleFromPosition ?? "SP/RP";

    if (p.velocity === undefined || p.control === undefined || p.movement === undefined) {
      throw new Error("Pitcher is missing pitching stats.");
    }

    return {
      id: p.id,
      name: p.name.trim(),
      role: "pitcher",
      position: normalizedPitchingRole,
      handedness: p.handedness,
      pitching: {
        velocity: p.velocity,
        control: p.control,
        movement: p.movement,
        stamina: p.stamina ?? 60,
      },
      pitchingRole: normalizedPitchingRole,
    };
  }

  return {
    id: p.id,
    name: p.name.trim(),
    role: "batter",
    position: trimmedPosition || "DH",
    handedness: p.handedness,
    batting: { contact: p.contact, power: p.power, speed: p.speed, stamina: p.stamina ?? 50 },
  };
};

/**
 * Converts a single `EditorPlayer` to a `TeamPlayer`.
 * Exported for use in the player-export flow (where we need the role to
 * correctly populate the pitching fields and compute the player sig).
 * The player's role is determined by `p.role`.
 */
export const editorPlayerToTeamPlayer = (p: EditorPlayer): TeamPlayer => editorToTeamPlayer(p);
