import type {
  CustomTeamDraft,
  GeneratedPlayer,
} from "@feat/customTeams/generation/generateDefaultTeam";
import {
  DEFAULT_BATTING_STAMINA,
  DEFAULT_PITCHING_STAMINA,
} from "@feat/customTeams/storage/customTeamSanitizers";

import { generatePlayerId } from "@storage/generateId";
import type {
  CreateCustomTeamInput,
  TeamBatterPlayer,
  TeamPitcherPlayer,
  TeamPlayer,
  TeamWithRoster,
} from "@storage/types";

import { DEFAULT_LINEUP_POSITIONS, REQUIRED_FIELD_POSITIONS } from "./playerConstants";
import { HITTER_STAT_CAP, hitterStatTotal, PITCHER_STAT_CAP, pitcherStatTotal } from "./statBudget";

/**
 * Midpoint value used as the default for newly added player stat sliders.
 * Keeps a fresh hitter at exactly the cap (50+50+50 = 150 = HITTER_STAT_CAP)
 * and a fresh pitcher comfortably under (150 < PITCHER_STAT_CAP=160), so a
 * just-added row passes editor validation immediately on first paint.
 */
export const DEFAULT_STAT_MIDPOINT = 50;

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
  /** Batting stamina (0–100). Shown in the editor UI. Defaults to DEFAULT_BATTING_STAMINA when absent. */
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
  /** Pitching stamina (0–100). Shown in the editor UI. Defaults to DEFAULT_PITCHING_STAMINA when absent. */
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

/**
 * Returns the next sequential default-name index for a given role within the
 * team. Names already in use of the form `New batter N` / `New pitcher N` are
 * skipped — we always pick the smallest positive integer that is not already
 * taken in any section (so adding lineup, bench, and pitcher rows in any order
 * yields `New batter 1`, `New batter 2`, `New pitcher 1`, …).
 */
export function nextDefaultNameIndex(
  state: Pick<EditorState, "lineup" | "bench" | "pitchers">,
  role: "batter" | "pitcher",
): number {
  const re = role === "batter" ? /^New batter (\d+)$/i : /^New pitcher (\d+)$/i;
  const players: ReadonlyArray<EditorPlayer> =
    role === "batter" ? [...state.lineup, ...state.bench] : state.pitchers;
  const used = new Set<number>();
  for (const p of players) {
    const m = re.exec(p.name.trim());
    if (m) {
      const n = Number.parseInt(m[1], 10);
      if (Number.isFinite(n) && n > 0) used.add(n);
    }
  }
  let n = 1;
  while (used.has(n)) n += 1;
  return n;
}

/**
 * Picks the default position for a newly added lineup row: the first
 * DEFAULT_LINEUP_POSITIONS slot not already filled in the lineup, falling back
 * to "DH" when every fielding slot is taken.
 */
export function pickDefaultLineupPosition(lineup: ReadonlyArray<EditorBatterPlayer>): string {
  const filled = new Set(lineup.map((p) => p.position).filter(Boolean));
  for (const pos of DEFAULT_LINEUP_POSITIONS) {
    if (!filled.has(pos)) return pos;
  }
  return "DH";
}

/**
 * Picks the default position for a newly added bench row.
 *
 * Spec deviation: the spec called for "BN", but no `BN` value exists in
 * BATTER_POSITION_OPTIONS (the position select would render as "— select —").
 * To keep the new row immediately valid (pickable from the dropdown and
 * useful for satisfying REQUIRED_FIELD_POSITIONS coverage), we instead pick
 * the first required field position that is not yet covered by lineup+bench,
 * falling back to "DH" when every required position is already covered.
 */
export function pickDefaultBenchPosition(
  lineup: ReadonlyArray<EditorBatterPlayer>,
  bench: ReadonlyArray<EditorBatterPlayer>,
): string {
  const covered = new Set([...lineup, ...bench].map((p) => p.position).filter(Boolean));
  for (const pos of REQUIRED_FIELD_POSITIONS) {
    if (!covered.has(pos)) return pos;
  }
  return "DH";
}

/**
 * Picks the default position for a newly added pitcher row: "SP" while the
 * rotation has fewer than 5 starters, otherwise "RP".
 */
export function pickDefaultPitcherPosition(
  pitchers: ReadonlyArray<EditorPitcherPlayer>,
): "SP" | "RP" {
  const starters = pitchers.filter((p) => p.position === "SP" || p.pitchingRole === "SP").length;
  return starters < 5 ? "SP" : "RP";
}

/**
 * Builds a new batter row populated with sensible defaults so the row passes
 * editor validation (no over-cap warning, name non-empty, position pre-filled)
 * the moment it is added.
 */
export function createDefaultBatter(
  state: Pick<EditorState, "lineup" | "bench" | "pitchers">,
  section: "lineup" | "bench",
): EditorBatterPlayer {
  const n = nextDefaultNameIndex(state, "batter");
  const position =
    section === "lineup"
      ? pickDefaultLineupPosition(state.lineup)
      : pickDefaultBenchPosition(state.lineup, state.bench);
  return {
    id: generatePlayerId(),
    name: `New batter ${n}`,
    role: "batter",
    position,
    handedness: "R",
    contact: DEFAULT_STAT_MIDPOINT,
    power: DEFAULT_STAT_MIDPOINT,
    speed: DEFAULT_STAT_MIDPOINT,
    stamina: DEFAULT_BATTING_STAMINA,
  };
}

/**
 * Builds a new pitcher row populated with sensible defaults so the row passes
 * editor validation (no over-cap warning, name non-empty, position pre-filled)
 * the moment it is added.
 */
export function createDefaultPitcher(
  state: Pick<EditorState, "lineup" | "bench" | "pitchers">,
): EditorPitcherPlayer {
  const n = nextDefaultNameIndex(state, "pitcher");
  const position = pickDefaultPitcherPosition(state.pitchers);
  return {
    id: generatePlayerId(),
    name: `New pitcher ${n}`,
    role: "pitcher",
    position,
    handedness: "R",
    velocity: DEFAULT_STAT_MIDPOINT,
    control: DEFAULT_STAT_MIDPOINT,
    movement: DEFAULT_STAT_MIDPOINT,
    pitchingRole: position,
    stamina: DEFAULT_PITCHING_STAMINA,
  };
}

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
  stamina: p.batting.stamina ?? DEFAULT_BATTING_STAMINA,
});

const draftPitcherToEditor = (p: GeneratedPlayer): EditorPitcherPlayer => {
  const pitching = p.pitching ?? {
    velocity: 60,
    control: 60,
    movement: 60,
    stamina: DEFAULT_PITCHING_STAMINA,
  };
  return {
    id: p.id,
    name: p.name,
    role: "pitcher",
    position: p.position ?? "",
    handedness: p.handedness ?? "R",
    velocity: pitching.velocity,
    control: pitching.control,
    movement: pitching.movement,
    stamina: pitching.stamina ?? DEFAULT_PITCHING_STAMINA,
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
  stamina: p.batting.stamina ?? DEFAULT_BATTING_STAMINA,
});

const docPitcherToEditor = (p: TeamPitcherPlayer): EditorPitcherPlayer => {
  const pitching = p.pitching ?? {
    velocity: 60,
    control: 60,
    movement: 60,
    stamina: DEFAULT_PITCHING_STAMINA,
  };
  return {
    id: p.id,
    name: p.name,
    role: "pitcher",
    position: p.position ?? "",
    handedness: p.handedness ?? "R",
    velocity: pitching.velocity,
    control: pitching.control,
    movement: pitching.movement,
    stamina: pitching.stamina ?? DEFAULT_PITCHING_STAMINA,
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

/**
 * Stable DOM ids for sections used as anchor targets when a validation
 * issue does not have a single specific input element to point to.
 *
 * Phase 2A — keep IDs co-located with the validator that emits them so
 * field-id ↔ DOM target stays in sync.
 */
export const LINEUP_SECTION_FIELD_ID = "custom-team-lineup-section";
export const BENCH_SECTION_FIELD_ID = "custom-team-bench-section";
export const PITCHERS_SECTION_FIELD_ID = "custom-team-pitchers-section";

/** A single validation problem surfaced in the form error summary. */
export interface ValidationIssue {
  /**
   * Anchor target id. Empty string means no scroll target — the issue is
   * still listed in the summary but rendered as plain text rather than a
   * link. Field-level inline errors only render when `fieldId` matches a
   * known input id (e.g. `ct-name`, `ct-abbrev`).
   */
  fieldId: string;
  /** Long-form copy shown inside the summary list. */
  summaryMessage: string;
  /**
   * Short per-field copy shown inline beneath the offending input. MUST
   * NOT duplicate {@link summaryMessage} verbatim — it is the field-local
   * complement to the canonical summary copy.
   */
  inlineMessage?: string;
}

/**
 * Returns every validation issue for the current editor state, in the
 * order they should appear in the top-of-form summary.
 *
 * Phase 2A: collects problems across categories instead of bailing on the
 * first one. Per-row issues (empty name, dup name, over-cap stats) are
 * limited to one issue per row to keep the summary scannable.
 */
export function collectValidationIssues(state: EditorState): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!state.name.trim()) {
    issues.push({
      fieldId: "ct-name",
      summaryMessage: "Team name is required.",
      inlineMessage: "Required.",
    });
  }

  const abbrev = state.abbreviation.trim();
  if (!abbrev) {
    issues.push({
      fieldId: "ct-abbrev",
      summaryMessage: "Team abbreviation is required (2–3 characters).",
      inlineMessage: "Required (2–3 characters).",
    });
  } else if (abbrev.length < 2 || abbrev.length > 3) {
    issues.push({
      fieldId: "ct-abbrev",
      summaryMessage: "Team abbreviation must be 2–3 characters.",
      inlineMessage: "Must be 2–3 characters.",
    });
  }

  if (state.lineup.length === 0) {
    issues.push({
      fieldId: LINEUP_SECTION_FIELD_ID,
      summaryMessage: "At least 1 lineup player is required.",
    });
  }

  for (const p of [...state.lineup, ...state.bench, ...state.pitchers]) {
    if (!p.name.trim()) {
      issues.push({
        fieldId: `name-${p.id}`,
        summaryMessage: "All players must have a name.",
        inlineMessage: "Required.",
      });
      break;
    }
  }

  // Enforce unique player names within the team (case-insensitive across all slots).
  const allPlayersForDup = [...state.lineup, ...state.bench, ...state.pitchers].filter((p) =>
    p.name.trim(),
  );
  const seenNamesMap = new Map<string, string>(); // lowercase → first-seen original-cased name
  const seenIdsMap = new Map<string, string>(); // lowercase → first-seen player id
  const dupOriginals = new Set<string>();
  let firstDupTargetId = "";
  for (const p of allPlayersForDup) {
    const lower = p.name.trim().toLowerCase();
    if (seenNamesMap.has(lower)) {
      dupOriginals.add(seenNamesMap.get(lower)!);
      if (!firstDupTargetId) firstDupTargetId = `name-${p.id}`;
    } else {
      seenNamesMap.set(lower, p.name.trim());
      seenIdsMap.set(lower, p.id);
    }
  }
  if (dupOriginals.size > 0) {
    const display = [...dupOriginals].map((n) => `"${n}"`).join(", ");
    issues.push({
      fieldId: firstDupTargetId,
      summaryMessage: `Duplicate player name(s) within this team: ${display}. Each player must have a unique name.`,
      inlineMessage: "Duplicate name.",
    });
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
    issues.push({
      fieldId: LINEUP_SECTION_FIELD_ID,
      summaryMessage: `Starting lineup has duplicate position(s): ${duplicateLineupPos.join(", ")}. Each position must appear exactly once.`,
    });
  }
  if (missingLineupPos.length > 0) {
    issues.push({
      fieldId: LINEUP_SECTION_FIELD_ID,
      summaryMessage: `Starting lineup is missing position(s): ${missingLineupPos.join(", ")}.`,
    });
  }

  // Check that all required field positions are covered in lineup + bench.
  const fieldPlayers = [...state.lineup, ...state.bench];
  const coveredPositions = new Set(fieldPlayers.map((p) => p.position).filter(Boolean));
  const missingPositions = REQUIRED_FIELD_POSITIONS.filter((pos) => !coveredPositions.has(pos));
  if (missingPositions.length > 0) {
    issues.push({
      fieldId: BENCH_SECTION_FIELD_ID,
      summaryMessage: `Roster must include at least one player at each of: ${missingPositions.join(", ")}.`,
    });
  }

  // Check hitter stat cap (contact + power + speed ≤ HITTER_STAT_CAP).
  for (const player of [...state.lineup, ...state.bench]) {
    const total = hitterStatTotal(player.contact, player.power, player.speed);
    if (total > HITTER_STAT_CAP) {
      issues.push({
        fieldId: `name-${player.id}`,
        summaryMessage: `${player.name || "A hitter"} is over the stat cap (${total} / ${HITTER_STAT_CAP}).`,
      });
      break;
    }
  }

  // Check pitcher stat cap (velocity + control + movement ≤ PITCHER_STAT_CAP).
  for (const player of state.pitchers) {
    if (
      player.velocity === undefined ||
      player.control === undefined ||
      player.movement === undefined
    ) {
      issues.push({
        fieldId: `name-${player.id}`,
        summaryMessage: `${player.name || "A pitcher"} is missing pitching stats.`,
      });
      break;
    }
    const total = pitcherStatTotal(player.velocity, player.control, player.movement);
    if (total > PITCHER_STAT_CAP) {
      issues.push({
        fieldId: `name-${player.id}`,
        summaryMessage: `${player.name || "A pitcher"} is over the stat cap (${total} / ${PITCHER_STAT_CAP}).`,
      });
      break;
    }
  }

  return issues;
}

/**
 * Backward-compatible single-string validator. Returns the first issue's
 * summary message, or an empty string when the state is valid.
 *
 * Prefer {@link collectValidationIssues} for new call sites that need to
 * surface every issue at once (e.g. the form error summary block).
 */
export function validateEditorState(state: EditorState): string {
  const issues = collectValidationIssues(state);
  return issues.length > 0 ? issues[0].summaryMessage : "";
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

    // `position` must be "SP" or "RP" (the only values in PITCHER_POSITION_OPTIONS).
    // `pitchingRole` is the eligibility field and may additionally be "SP/RP".
    const normalizedPosition =
      trimmedPosition === "SP" || trimmedPosition === "RP" ? trimmedPosition : "SP";

    return {
      id: p.id,
      name: p.name.trim(),
      role: "pitcher",
      position: normalizedPosition,
      handedness: p.handedness,
      pitching: {
        velocity: p.velocity,
        control: p.control,
        movement: p.movement,
        stamina: p.stamina ?? DEFAULT_PITCHING_STAMINA,
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
    batting: {
      contact: p.contact,
      power: p.power,
      speed: p.speed,
      stamina: p.stamina ?? DEFAULT_BATTING_STAMINA,
    },
  };
};

/**
 * Converts a single `EditorPlayer` to a `TeamPlayer`.
 * Exported for use in the player-export flow (where we need the role to
 * correctly populate the pitching fields and compute the player sig).
 * The player's role is determined by `p.role`.
 */
export const editorPlayerToTeamPlayer = (p: EditorPlayer): TeamPlayer => editorToTeamPlayer(p);
