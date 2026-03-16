/**
 * Pitcher log utilities for the game reducer.
 *
 * These helpers create and update PitcherLogEntry values in the pitcherGameLog
 * field of game state. They are pure functions — they take state and return
 * the updated pitcherGameLog without mutating input.
 */
import type { PitcherLogEntry } from "./gameLogTypes";
import type { State } from "./gameStateTypes";

/**
 * Creates a new PitcherLogEntry for a pitcher entering the game.
 *
 * @param teamIdx  - The PITCHING team index (0 = away pitching, 1 = home pitching).
 * @param pitcherId - The roster player ID of the pitcher.
 * @param state     - Current game state (used to capture inning, half, score on entry).
 */
export const createPitcherLogEntry = (
  teamIdx: 0 | 1,
  pitcherId: string,
  state: State,
): PitcherLogEntry => ({
  teamIdx,
  pitcherId,
  inningEntered: state.inning,
  // halfEntered: the PITCHING team's half context.
  // atBat=0 means away is batting → home is pitching (bottom of inning perspective).
  // But the "half" here refers to which half-inning the pitcher entered.
  // atBat is the BATTING team; the fielding team's half is: atBat (which is 0 for top/away-batting).
  halfEntered: state.atBat as 0 | 1,
  scoreOnEntry: [...state.score] as [number, number],
  outsPitched: 0,
  battersFaced: 0,
  pitchesThrown: 0,
  hitsAllowed: 0,
  walksAllowed: 0,
  strikeoutsRecorded: 0,
  runsAllowed: 0,
  homersAllowed: 0,
});

/**
 * Returns the index of the current pitcher's log entry for the given pitching team.
 * Returns -1 if no entry exists (should not happen after setTeams initializes).
 */
export const activePitcherLogIdx = (
  pitcherGameLog: [PitcherLogEntry[], PitcherLogEntry[]],
  teamIdx: 0 | 1,
): number => {
  const entries = pitcherGameLog[teamIdx];
  return entries.length - 1;
};

/**
 * Immutably updates the last pitcher log entry for the given pitching team.
 * Returns the same `pitcherGameLog` reference if there is no entry to update.
 */
export const updateActivePitcherLog = (
  pitcherGameLog: [PitcherLogEntry[], PitcherLogEntry[]],
  teamIdx: 0 | 1,
  updater: (entry: PitcherLogEntry) => PitcherLogEntry,
): [PitcherLogEntry[], PitcherLogEntry[]] => {
  // Guard: pitcherGameLog[teamIdx] can be undefined at runtime if teamIdx is out-of-bounds
  // (e.g. pitchingTeam derived from an invalid atBat value in a corrupted restore).
  const entries = pitcherGameLog[teamIdx] as PitcherLogEntry[] | undefined;
  if (!entries || entries.length === 0) return pitcherGameLog;
  const lastIdx = entries.length - 1;
  const updated = updater(entries[lastIdx]);
  const newEntries = [...entries.slice(0, lastIdx), updated];
  return teamIdx === 0 ? [newEntries, pitcherGameLog[1]] : [pitcherGameLog[0], newEntries];
};

/**
 * Pushes a new pitcher log entry for the given pitching team.
 * Used when a pitcher change is made (make_substitution with kind=pitcher)
 * or when the game starts (setTeams initializes the first pitcher).
 */
export const pushPitcherLogEntry = (
  pitcherGameLog: [PitcherLogEntry[], PitcherLogEntry[]],
  teamIdx: 0 | 1,
  entry: PitcherLogEntry,
): [PitcherLogEntry[], PitcherLogEntry[]] => {
  const newEntries = [...pitcherGameLog[teamIdx], entry];
  return teamIdx === 0 ? [newEntries, pitcherGameLog[1]] : [pitcherGameLog[0], newEntries];
};
