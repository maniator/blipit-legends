import type { DecisionType, OnePitchModifier } from "./decisionTypes";
import type { State } from "./gameStateTypes";
import type { Strategy } from "./playerTypes";

export const checkGameOver = (state: State, log: (msg: string) => void): State => {
  if (state.inning >= 9) {
    const [away, home] = state.score;
    if (away !== home) {
      const winner = away > home ? state.teamLabels[0] : state.teamLabels[1];
      log(`That's the ball game! ${winner} win!`);
      return { ...state, gameOver: true };
    }
  }
  return state;
};

export const nextHalfInning = (state: State, log: (msg: string) => void): State => {
  const newState = {
    ...state,
    baseLayout: [0, 0, 0] as [number, number, number],
    baseRunnerIds: [null, null, null] as [string | null, string | null, string | null],
    outs: 0,
    strikes: 0,
    balls: 0,
    pendingDecision: null as DecisionType | null,
    onePitchModifier: null as OnePitchModifier,
    hitType: undefined,
    suppressNextDecision: false,
    pinchHitterStrategy: null as Strategy | null,
    defensiveShift: false,
    defensiveShiftOffered: false,
  };
  let newHalfInning = newState.atBat + 1;
  let newInning = newState.inning;

  if (newHalfInning > 1) {
    newHalfInning = 0;
    newInning += 1;
  }

  const next = { ...newState, inning: newInning, atBat: newHalfInning };

  // Standard rule: if the home team is already winning at the start of the bottom
  // of the 9th (or later), they win — no need to play the bottom half.
  if (newHalfInning === 1 && newInning >= 9) {
    const [away, home] = next.score;
    if (home > away) {
      log(`${next.teamLabels[1]} win! No need to play the bottom of the ${newInning}th.`);
      return { ...next, gameOver: true };
    }
  }

  if (newHalfInning === 0 && newInning > 9) {
    const maybe = checkGameOver(next, log);
    if (maybe.gameOver) return maybe;
  }

  const isExtra = newInning > 9;
  let extraRunnerId: string | null = null;
  if (isExtra) {
    const lineupSize = Math.max(1, next.lineupOrder[newHalfInning].length);
    const lastBatterIdx = (next.batterIndex[newHalfInning] - 1 + lineupSize) % lineupSize;
    extraRunnerId = next.lineupOrder[newHalfInning][lastBatterIdx] || null;
  }
  const nextWithBase = isExtra
    ? {
        ...next,
        baseLayout: [0, 1, 0] as [number, number, number],
        baseRunnerIds: [null, extraRunnerId, null] as [string | null, string | null, string | null],
      }
    : next;

  log(`${state.teamLabels[newHalfInning]} are now up to bat!`);
  if (isExtra) log("Tiebreak rule: runner placed on 2nd base.");
  return nextWithBase;
};

export const checkWalkoff = (state: State, log: (msg: string) => void): State => {
  if (state.inning >= 9 && state.atBat === 1) {
    const [away, home] = state.score;
    if (home > away) {
      log(`Walk-off! ${state.teamLabels[1]} win!`);
      return { ...state, gameOver: true };
    }
  }
  return state;
};
