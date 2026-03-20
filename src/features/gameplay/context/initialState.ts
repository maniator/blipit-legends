import { generateGameInstanceId } from "@storage/generateId";

import type { PitcherLogEntry, PlayLogEntry } from "./gameLogTypes";
import type { State } from "./gameStateTypes";
import type { Handedness, ResolvedPlayerMods, TeamCustomPlayerOverrides } from "./playerTypes";
import { buildResolvedMods } from "./resolvePlayerMods";

/** Fallback team names used when a very old save is missing the `teams` field. */
const FALLBACK_TEAMS: [string, string] = ["Away", "Home"];

/**
 * Returns a fresh game state with all fields reset to their starting values.
 * Used for the `reset` action and as the initial state for the context provider.
 */
export const createFreshGameState = (
  teams: [string, string],
  teamLabels?: [string, string],
): State => ({
  gameInstanceId: generateGameInstanceId(),
  inning: 1,
  score: [0, 0] as [number, number],
  teams,
  teamLabels: teamLabels ?? teams,
  baseLayout: [0, 0, 0] as [number, number, number],
  outs: 0,
  strikes: 0,
  balls: 0,
  atBat: 0,
  hitType: undefined,
  gameOver: false,
  pendingDecision: null,
  onePitchModifier: null,
  pitchKey: 0,
  decisionLog: [],
  suppressNextDecision: false,
  pinchHitterStrategy: null,
  defensiveShift: false,
  defensiveShiftOffered: false,
  batterIndex: [0, 0] as [number, number],
  inningRuns: [[], []] as [number[], number[]],
  playLog: [],
  strikeoutLog: [],
  outLog: [],
  playerOverrides: [{}, {}] as [TeamCustomPlayerOverrides, TeamCustomPlayerOverrides],
  lineupOrder: [[], []] as [string[], string[]],
  rosterBench: [[], []] as [string[], string[]],
  rosterPitchers: [[], []] as [string[], string[]],
  activePitcherIdx: [0, 0] as [number, number],
  lineupPositions: [[], []] as [string[], string[]],
  pitcherBattersFaced: [0, 0] as [number, number],
  pitcherPitchCount: [0, 0] as [number, number],
  batterPlateAppearances: [{}, {}] as [Record<string, number>, Record<string, number>],
  substitutedOut: [[], []] as [string[], string[]],
  baseRunnerIds: [null, null, null] as [string | null, string | null, string | null],
  resolvedMods: [{}, {}] as [
    Record<string, ResolvedPlayerMods>,
    Record<string, ResolvedPlayerMods>,
  ],
  handednessByTeam: [{}, {}] as [Record<string, Handedness>, Record<string, Handedness>],
  pitcherGameLog: [[], []] as [PitcherLogEntry[], PitcherLogEntry[]],
});

/**
 * Backfills optional fields that may be missing on older saves,
 * ensuring backward compatibility when a saved game is restored.
 *
 * Uses `createFreshGameState` as the base so any field added to State in the
 * future automatically gets a safe default for saves predating that field.
 * The restored save data is merged on top, overriding the defaults with the
 * actual persisted values.
 *
 * Array/object fields are additionally guarded against explicit null/undefined
 * values, which can appear when a save was written during an older code version
 * that stored null rather than omitting the field entirely.
 */
/**
 * Ensures every entry in a resolved-mods map has stamina fields present.
 * Saves written before fatigue fields were added to `ResolvedPlayerMods` may
 * lack one or both keys; without backfill the fatigue model could receive
 * `undefined` and produce invalid math.
 */
const backfillTeamMods = (
  teamMods: Record<string, ResolvedPlayerMods>,
): Record<string, ResolvedPlayerMods> =>
  Object.fromEntries(
    Object.entries(teamMods).map(([id, m]) => [
      id,
      {
        ...m,
        staminaMod: m.staminaMod ?? 0,
      },
    ]),
  );

export const backfillRestoredState = (restored: State): State => {
  // Build a fresh-defaults base using the save's own teams (fall back to a
  // safe placeholder if teams is absent in a very old save).
  const fresh = createFreshGameState(
    Array.isArray(restored.teams) && restored.teams.length === 2 ? restored.teams : FALLBACK_TEAMS,
  );
  // Merge: fresh supplies safe defaults for any field absent in the save;
  // restored values override fresh defaults for fields that are present.
  const base: State = { ...fresh, ...restored };
  // Backfill playLog rbi for entries from saves that predate the rbi field.
  const playLog: PlayLogEntry[] = (base.playLog ?? []).map((entry) =>
    entry.rbi !== undefined ? entry : { ...entry, rbi: entry.runs },
  );
  // Explicitly guard array/object fields against null or explicit undefined
  // that may survive in saves from older code that wrote null instead of [].
  return {
    ...base,
    playLog,
    teamLabels: base.teamLabels ?? base.teams,
    strikeoutLog: base.strikeoutLog ?? [],
    outLog: base.outLog ?? [],
    playerOverrides: base.playerOverrides ?? [{}, {}],
    lineupOrder: base.lineupOrder ?? [[], []],
    decisionLog: base.decisionLog ?? [],
    inningRuns: base.inningRuns ?? [[], []],
    batterIndex: base.batterIndex ?? [0, 0],
    // Clamp atBat to the valid 0|1 range — corrupted saves (e.g. fixtures written
    // with atBat=3 from a bad snapshot) would yield pitchingTeam=-2, causing
    // out-of-bounds array access in updateActivePitcherLog and a runtime crash.
    atBat: base.atBat === 0 || base.atBat === 1 ? base.atBat : (0 as 0 | 1),
    rosterBench: base.rosterBench ?? [[], []],
    rosterPitchers: base.rosterPitchers ?? [[], []],
    activePitcherIdx: base.activePitcherIdx ?? [0, 0],
    lineupPositions: base.lineupPositions ?? [[], []],
    pitcherBattersFaced: base.pitcherBattersFaced ?? [0, 0],
    pitcherPitchCount: base.pitcherPitchCount ?? [0, 0],
    batterPlateAppearances: base.batterPlateAppearances ?? [{}, {}],
    substitutedOut: base.substitutedOut ?? [[], []],
    baseRunnerIds: base.baseRunnerIds ?? [null, null, null],
    resolvedMods:
      base.resolvedMods && Object.keys(base.resolvedMods[0]).length > 0
        ? [backfillTeamMods(base.resolvedMods[0]), backfillTeamMods(base.resolvedMods[1])]
        : [buildResolvedMods(base.playerOverrides[0]), buildResolvedMods(base.playerOverrides[1])],
    handednessByTeam: base.handednessByTeam ?? [{}, {}],
    pitcherGameLog: base.pitcherGameLog ?? [[], []],
  };
};
