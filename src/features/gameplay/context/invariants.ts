import { appLog } from "@shared/utils/logger";

import type { State } from "./gameStateTypes";

export interface InvariantViolation {
  message: string;
}

/**
 * Checks for impossible game-state invariants.
 * Returns an array of violation descriptions (empty array = all good).
 * Pure function — no side effects, safe to call in tests.
 */
export const checkGameInvariants = (state: State): InvariantViolation[] => {
  const violations: InvariantViolation[] = [];

  // Batter index must be 0–8 for both teams.
  for (let t = 0; t < 2; t++) {
    const idx = state.batterIndex[t as 0 | 1];
    if (idx < 0 || idx > 8) {
      violations.push({ message: `Team ${t} batterIndex out of bounds: ${idx}` });
    }
  }

  // atBat must be 0 (away batting) or 1 (home batting).
  if (state.atBat !== 0 && state.atBat !== 1) {
    violations.push({ message: `atBat out of range: ${state.atBat}` });
  }

  // Count fields must be within valid game ranges.
  if (state.outs < 0 || state.outs > 2) {
    violations.push({ message: `outs out of range: ${state.outs}` });
  }
  if (state.strikes < 0 || state.strikes > 2) {
    violations.push({ message: `strikes out of range: ${state.strikes}` });
  }
  if (state.balls < 0 || state.balls > 3) {
    violations.push({ message: `balls out of range: ${state.balls}` });
  }

  // Scores must be non-negative.
  if (state.score[0] < 0 || state.score[1] < 0) {
    violations.push({ message: `negative score: [${state.score[0]}, ${state.score[1]}]` });
  }

  // inningRuns sum must match the scoreboard for each team.
  // Both hitBall and buntAttempt always update score and inningRuns together,
  // so a mismatch here indicates a scoring-path bug.
  for (let t = 0; t < 2; t++) {
    const inningSum = (state.inningRuns[t as 0 | 1] ?? []).reduce((acc, r) => acc + (r ?? 0), 0);
    if (inningSum !== state.score[t as 0 | 1]) {
      violations.push({
        message: `Team ${t} score mismatch: score=${state.score[t as 0 | 1]} inningRuns.sum=${inningSum}`,
      });
    }
  }

  // Batter index must not exceed the lineup length (relevant for non-9 custom rosters).
  for (let t = 0; t < 2; t++) {
    const len = state.lineupOrder[t as 0 | 1]?.length ?? 9;
    const idx = state.batterIndex[t as 0 | 1];
    if (len > 0 && idx >= len) {
      violations.push({ message: `Team ${t} batterIndex ${idx} >= lineupOrder.length ${len}` });
    }
  }

  // baseRunnerIds must be consistent with baseLayout.
  const runnerIds = state.baseRunnerIds ?? [null, null, null];
  for (let b = 0; b < 3; b++) {
    const hasRunner = state.baseLayout[b as 0 | 1 | 2] === 1;
    const hasId = runnerIds[b] != null;
    // If layout says occupied but ID is null, that's OK for stock teams (IDs may be unset).
    // If layout says empty but ID is non-null, that IS an inconsistency.
    if (!hasRunner && hasId) {
      violations.push({
        message: `baseRunnerIds[${b}]=${runnerIds[b]} but baseLayout[${b}]=0`,
      });
    }
  }

  // No two runners can share the same non-null ID.
  const nonNullIds = runnerIds.filter((id): id is string => id != null);
  const uniqueIds = new Set(nonNullIds);
  if (uniqueIds.size !== nonNullIds.length) {
    violations.push({
      message: `Duplicate player IDs in baseRunnerIds: ${JSON.stringify(runnerIds)}`,
    });
  }

  return violations;
};

/**
 * Emits a console warning for every invariant violation found in `state`.
 * Should only be called in development / test environments (never in production).
 *
 * @param state  The game state to inspect.
 * @param meta   Optional context included in the warning message so the issue
 *               can be reproduced: seed, saveId, pitchKey, etc.
 */
export const warnIfImpossible = (
  state: State,
  meta?: { seed?: number | null; saveId?: string; pitchKey?: number },
): void => {
  const violations = checkGameInvariants(state);
  if (violations.length === 0) return;

  const ctx = [
    meta?.seed != null ? `seed=0x${meta.seed.toString(16)}` : null,
    meta?.saveId ? `saveId=${meta.saveId}` : null,
    `inning=${state.inning}`,
    `half=${state.atBat}`,
    meta?.pitchKey != null ? `pitchKey=${meta.pitchKey}` : null,
  ]
    .filter(Boolean)
    .join(" ");

  for (const v of violations) {
    appLog.warn(`Invariant violation [${ctx}]: ${v.message}`);
  }
};
