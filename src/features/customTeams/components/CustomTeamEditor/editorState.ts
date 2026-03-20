import type { CustomTeamDraft } from "@feat/customTeams/generation/generateDefaultTeam";

import type { CreateCustomTeamInput, TeamPlayer, TeamWithRoster } from "@storage/types";

import { DEFAULT_LINEUP_POSITIONS, REQUIRED_FIELD_POSITIONS } from "./playerConstants";
import { HITTER_STAT_CAP, hitterStatTotal, PITCHER_STAT_CAP, pitcherStatTotal } from "./statBudget";

/** A single player row as edited in the form (stats as numbers 0–100). */
export interface EditorPlayer {
  id: string;
  name: string;
  /** Position code (e.g. "C", "1B", "SS", "SP"). Empty string while unset. */
  position: string;
  /** Batting handedness. Defaults to "R" for new players. */
  handedness: "R" | "L" | "S";
  contact: number;
  power: number;
  speed: number;
  velocity?: number;
  control?: number;
  movement?: number;
  /** Pitcher role eligibility. Only meaningful for pitchers. */
  pitchingRole?: "SP" | "RP" | "SP/RP";
}

export interface EditorState {
  name: string;
  /** 2–3 char compact team label. Empty string while unset. */
  abbreviation: string;
  city: string;
  nickname: string;
  lineup: EditorPlayer[];
  bench: EditorPlayer[];
  pitchers: EditorPlayer[];
  error: string;
}

export type EditorAction =
  | { type: "SET_FIELD"; field: "name" | "abbreviation" | "city" | "nickname"; value: string }
  | {
      type: "UPDATE_PLAYER";
      section: "lineup" | "bench" | "pitchers";
      index: number;
      player: Partial<EditorPlayer>;
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
      const list = [...state[action.section]];
      list[action.index] = { ...list[action.index], ...action.player };
      return { ...state, [action.section]: list, error: "" };
    }
    case "ADD_PLAYER":
      return { ...state, [action.section]: [...state[action.section], action.player], error: "" };
    case "REMOVE_PLAYER": {
      const list = state[action.section].filter((_, i) => i !== action.index);
      return { ...state, [action.section]: list, error: "" };
    }
    case "REORDER": {
      const lookup = new Map(state[action.section].map((p) => [p.id, p]));
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
        [action.section]: moveItem(state[action.section], action.index, action.index - 1),
      };
    case "MOVE_DOWN":
      return {
        ...state,
        [action.section]: moveItem(state[action.section], action.index, action.index + 1),
      };
    case "APPLY_DRAFT":
      return {
        ...state,
        name: action.draft.name,
        abbreviation: action.draft.abbreviation ?? "",
        city: action.draft.city,
        nickname: action.draft.nickname,
        lineup: action.draft.roster.lineup.map(draftPlayerToEditor),
        bench: action.draft.roster.bench.map(draftPlayerToEditor),
        pitchers: action.draft.roster.pitchers.map(draftPlayerToEditor),
        error: "",
      };
    case "SET_ERROR":
      return { ...state, error: action.error };
    default:
      return state;
  }
}

const draftPlayerToEditor = (p: CustomTeamDraft["roster"]["lineup"][number]): EditorPlayer => ({
  id: p.id,
  name: p.name,
  position: p.position ?? "",
  handedness: p.handedness ?? "R",
  contact: p.batting.contact,
  power: p.batting.power,
  speed: p.batting.speed,
  ...(p.pitching && {
    velocity: p.pitching.velocity,
    control: p.pitching.control,
    movement: p.pitching.movement,
  }),
  ...(p.pitchingRole !== undefined && { pitchingRole: p.pitchingRole }),
});

const docPlayerToEditor = (p: TeamPlayer): EditorPlayer => ({
  id: p.id,
  name: p.name,
  position: p.position ?? "",
  handedness: p.handedness ?? "R",
  contact: p.batting.contact,
  power: p.batting.power,
  speed: p.batting.speed,
  ...(p.pitching && {
    velocity: p.pitching.velocity,
    control: p.pitching.control,
    movement: p.pitching.movement,
  }),
  ...(p.pitchingRole !== undefined && { pitchingRole: p.pitchingRole }),
});

export const initEditorState = (team?: TeamWithRoster): EditorState => ({
  name: team?.name ?? "",
  abbreviation: team?.abbreviation ?? "",
  city: team?.city ?? "",
  nickname: team?.nickname ?? "",
  lineup: team?.roster.lineup.map(docPlayerToEditor) ?? [],
  bench: team?.roster.bench.map(docPlayerToEditor) ?? [],
  pitchers: team?.roster.pitchers.map(docPlayerToEditor) ?? [],
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
    const total = pitcherStatTotal(player.velocity ?? 0, player.control ?? 0, player.movement ?? 0);
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
      lineup: state.lineup.map(editorToTeamPlayer("batter")),
      bench: state.bench.map(editorToTeamPlayer("batter")),
      pitchers: state.pitchers.map(editorToTeamPlayer("pitcher")),
    },
  };
}

const editorToTeamPlayer =
  (role: "batter" | "pitcher") =>
  (p: EditorPlayer): TeamPlayer => {
    const trimmedPosition = p.position.trim();
    const pitcherRoleFromPosition =
      trimmedPosition === "SP" || trimmedPosition === "RP" || trimmedPosition === "SP/RP"
        ? trimmedPosition
        : undefined;
    const normalizedPitchingRole = p.pitchingRole ?? pitcherRoleFromPosition ?? "SP/RP";

    const base: TeamPlayer = {
      id: p.id,
      name: p.name.trim(),
      role,
      position: role === "pitcher" ? normalizedPitchingRole : trimmedPosition || "DH",
      handedness: p.handedness,
      batting: { contact: p.contact, power: p.power, speed: p.speed, stamina: 50 },
    };

    if (role === "pitcher") {
      return {
        ...base,
        pitching: {
          velocity: p.velocity ?? 60,
          control: p.control ?? 60,
          movement: p.movement ?? 60,
          stamina: 60,
        },
        pitchingRole: normalizedPitchingRole,
      };
    }

    return base;
  };

/**
 * Converts a single `EditorPlayer` to a `TeamPlayer` with the given role.
 * Exported for use in the player-export flow (where we need the role to
 * correctly populate the pitching fields and compute the player sig).
 */
export const editorPlayerToTeamPlayer = (p: EditorPlayer, role: "batter" | "pitcher"): TeamPlayer =>
  editorToTeamPlayer(role)(p);
