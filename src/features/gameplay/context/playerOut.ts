import type { StrikeoutEntry } from "./gameLogTypes";
import { checkGameOver, nextHalfInning } from "./gameOver";
import type { State } from "./gameStateTypes";
import { updateActivePitcherLog } from "./pitcherLog";
import type { Strategy } from "./playerTypes";
import { resolveBatterPlayerId } from "./resolveBatterPlayerId";

/**
 * Increments the pitching team's pitch count.
 * Called once per pitch event to a batter in this engine:
 * balls, called/swinging strikes, fouls (whether count advances or stays),
 * balls in play, and intentional_walk events all count.
 * An intentional walk is modeled as a single pitch event here (not four pitches as in real baseball).
 * Steal attempts do NOT count — they are baserunning events, not pitches to the batter.
 */
export const incrementPitchCount = (state: State): State => {
  const pitchingTeam = (1 - (state.atBat as number)) as 0 | 1;
  const cur = state.pitcherPitchCount ?? ([0, 0] as [number, number]);
  const newPitchCount: [number, number] = [cur[0], cur[1]];
  newPitchCount[pitchingTeam] = newPitchCount[pitchingTeam] + 1;
  return {
    ...state,
    pitcherPitchCount: newPitchCount,
    pitcherGameLog: updateActivePitcherLog(
      state.pitcherGameLog ?? [[], []],
      pitchingTeam,
      (entry) => ({ ...entry, pitchesThrown: entry.pitchesThrown + 1 }),
    ),
  };
};

export const nextBatter = (state: State): State => {
  const newBatterIndex: [number, number] = [state.batterIndex[0], state.batterIndex[1]];
  newBatterIndex[state.atBat as 0 | 1] = (newBatterIndex[state.atBat as 0 | 1] + 1) % 9;
  return { ...state, batterIndex: newBatterIndex };
};

/**
 * Increments the pitching team's batters-faced counter (fatigue tracking).
 * Called once per completed batter plate appearance.
 */
export const incrementPitcherFatigue = (state: State): State => {
  const pitchingTeam = (1 - (state.atBat as number)) as 0 | 1;
  const newFaced: [number, number] = [state.pitcherBattersFaced[0], state.pitcherBattersFaced[1]];
  newFaced[pitchingTeam] = newFaced[pitchingTeam] + 1;
  return { ...state, pitcherBattersFaced: newFaced };
};

/**
 * Increments completed plate appearances for the current batter by stable player ID.
 * This is the workload signal for batter fatigue.
 */
export const incrementBatterPlateAppearances = (
  state: State,
  teamIdx: 0 | 1,
  playerId: string,
): State => {
  const byTeam =
    state.batterPlateAppearances ?? ([{}, {}] as [Record<string, number>, Record<string, number>]);
  const nextByTeam: [Record<string, number>, Record<string, number>] = [
    { ...byTeam[0] },
    { ...byTeam[1] },
  ];
  const current = nextByTeam[teamIdx][playerId] ?? 0;
  nextByTeam[teamIdx][playerId] = current + 1;
  return { ...state, batterPlateAppearances: nextByTeam };
};

/** Options for `playerOut`. */
export interface PlayerOutOptions {
  /**
   * When `true`, the outLog entry is flagged as a sacrifice fly.
   * Sac flies count as PA but not AB; the batter earns RBI.
   */
  isSacFly?: boolean;
  /** Number of RBI credited on this plate appearance. Only meaningful when `isSacFly` is true. */
  rbi?: number;
}

/**
 * Record an out and handle half-inning transitions.
 *
 * batterCompleted: true  → the *batter's* at-bat is over (strikeout, pop-out, bunt out).
 *                          Rotates the batting order to the next batter.
 * batterCompleted: false → a *runner* was put out (caught stealing).
 *                          The same batter remains at the plate; order does NOT rotate.
 */
export const playerOut = (
  state: State,
  log: (msg: string) => void,
  batterCompleted = false,
  { isSacFly, rbi }: PlayerOutOptions = {},
): State => {
  // Record this batter's completed plate appearance in outLog (covers K, pop-outs, groundouts, FC, bunts, sac flies).
  const battingTeam = state.atBat as 0 | 1;
  const slotIdx = state.batterIndex[battingTeam];
  const playerId = resolveBatterPlayerId(state, battingTeam, slotIdx);
  const outEntry: StrikeoutEntry | null = batterCompleted
    ? {
        team: battingTeam,
        batterNum: slotIdx + 1,
        playerId,
        ...(isSacFly ? { isSacFly: true, rbi: rbi ?? 1 } : {}),
      }
    : null;
  const stateWithOut = outEntry ? { ...state, outLog: [...state.outLog, outEntry] } : state;
  const stateWithBatterWorkload =
    batterCompleted && playerId
      ? incrementBatterPlateAppearances(stateWithOut, battingTeam, playerId)
      : stateWithOut;
  // Increment pitcher fatigue when the batter's plate appearance is complete.
  const stateWithFatigue = batterCompleted
    ? incrementPitcherFatigue(stateWithBatterWorkload)
    : stateWithBatterWorkload;
  const stateAfterBatter = batterCompleted ? nextBatter(stateWithFatigue) : stateWithFatigue;

  // Track out for the active pitcher on the pitching team.
  const pitchingTeam = (1 - (state.atBat as number)) as 0 | 1;
  const stateWithPitcherOut = {
    ...stateAfterBatter,
    pitcherGameLog: updateActivePitcherLog(
      stateAfterBatter.pitcherGameLog ?? [[], []],
      pitchingTeam,
      (entry) => ({
        ...entry,
        // Credit the pitcher with this out regardless of whether the batter's PA is over.
        // A runner put out (e.g. caught stealing, or the lead runner in a 6-4-3 DP where
        // batterCompleted=false) still counts as an out the pitcher recorded toward IP.
        // battersFaced only increments when the batter's plate appearance is complete.
        outsPitched: entry.outsPitched + 1,
        battersFaced: batterCompleted ? entry.battersFaced + 1 : entry.battersFaced,
      }),
    ),
  };
  const newOuts = stateWithPitcherOut.outs + 1;
  if (newOuts === 3) {
    const afterHalf = nextHalfInning(stateWithPitcherOut, log);
    if (afterHalf.gameOver) return afterHalf;
    if (stateWithPitcherOut.atBat === 1 && stateWithPitcherOut.inning >= 9) {
      const maybe = checkGameOver(afterHalf, log);
      if (maybe.gameOver) return maybe;
    }
    return afterHalf;
  }
  log(newOuts === 1 ? "One out." : "Two outs.");
  // Only clear per-batter state when the batter's at-bat is actually over.
  // When batterCompleted=false (caught stealing), the same batter stays at the
  // plate, so pinchHitterStrategy must persist for that at-bat.
  // defensiveShift and defensiveShiftOffered persist for the whole half-inning
  // and are reset in nextHalfInning.
  return {
    ...stateWithPitcherOut,
    // Only reset the count when the batter's at-bat is over.
    // On a caught stealing (batterCompleted=false) the same batter remains at the
    // plate, so the count (strikes/balls) must survive. MLB rule 5.06(b)(4)(G).
    ...(batterCompleted ? { strikes: 0, balls: 0 } : {}),
    outs: newOuts,
    pendingDecision: null,
    onePitchModifier: null,
    hitType: undefined,
    ...(batterCompleted
      ? {
          pinchHitterStrategy: null as Strategy | null,
        }
      : {}),
  };
};
