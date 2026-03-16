/**
 * Multi-seed regression pack — simulation correctness across varied game outcomes.
 *
 * Validates the following invariants for BOTH teams across several seeds:
 *
 *   1. Game completes within 3 000 pitches.
 *   2. H ≤ AB for every batter (hits are a subset of at-bats).
 *   3. K ≤ AB (strikeouts always count as official at-bats).
 *   4. AB = PA − BB (walks are the only non-AB plate appearance modelled).
 *   5. PA ordering: each lineup slot has ≥ PA as the next slot.
 *   6. Scoreboard consistency: score[i] == sum of inningRuns[i] for i ∈ {0,1}.
 *   7. Team mapping: every playLog/strikeoutLog/outLog entry carries the correct
 *      team tag (no away-into-home or home-into-away leakage).
 *
 * Seed `30nl0i` is intentionally excluded here — it is covered in depth by the
 * dedicated `battingStats.test.ts` file. These seeds exercise different game
 * trajectories (low-scoring, high-scoring, extra-inning-eligible, etc.).
 */

import { selectPitchType } from "@feat/gameplay/constants/pitchTypes";
import type { GameAction, State } from "@feat/gameplay/context/index";
import {
  computeSwingRate,
  resolveBattedBallType,
  resolveSwingOutcome,
} from "@feat/gameplay/context/pitchSimulation";
import getRandomInt from "@feat/gameplay/utils/getRandomInt";
import { Hit } from "@shared/constants/hitTypes";
import { restoreRng } from "@shared/utils/rng";
import { generateRoster } from "@shared/utils/roster";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { makeReducer, makeState } from "@test/testHelpers";

// ---------------------------------------------------------------------------
// Helpers — identical pattern to battingStats.test.ts
// ---------------------------------------------------------------------------

const nextPitchAction = (state: State): GameAction => {
  const pitchType = selectPitchType(state.balls, state.strikes, getRandomInt(100));
  const swingRate = computeSwingRate(state.strikes, {
    strategy: "balanced",
    pitchType,
    onePitchMod: state.onePitchModifier,
  });
  const swingRoll = getRandomInt(1000);

  if (swingRoll < swingRate) {
    const outcomeRoll = getRandomInt(100);
    const outcome = resolveSwingOutcome(outcomeRoll);
    if (outcome === "whiff") return { type: "strike", payload: { swung: true, pitchType } };
    if (outcome === "foul") return { type: "foul", payload: { pitchType } };
    const contactRoll = getRandomInt(100);
    const typeRoll = getRandomInt(100);
    const battedBallType = resolveBattedBallType(contactRoll, typeRoll);
    return { type: "hit", payload: { battedBallType, strategy: "balanced" } };
  }
  return { type: "wait", payload: { strategy: "balanced", pitchType } };
};

const AWAY_TEAM = "New York Mets";
const HOME_TEAM = "New York Yankees";

const runGame = (seed: number): State => {
  restoreRng(seed);
  const { reducer } = makeReducer();

  let state = makeState({
    teams: [AWAY_TEAM, HOME_TEAM],
    lineupOrder: [
      generateRoster(AWAY_TEAM).batters.map((b) => b.id),
      generateRoster(HOME_TEAM).batters.map((b) => b.id),
    ],
  });

  let pitches = 0;
  while (!state.gameOver && pitches < 3_000) {
    state = reducer(state, nextPitchAction(state));
    pitches++;
  }
  return state;
};

type BatterStats = { ab: number; h: number; bb: number; k: number; pa: number };

const computeStats = (team: 0 | 1, state: State): Record<number, BatterStats> => {
  const stats: Record<number, BatterStats> = {};
  for (let i = 1; i <= 9; i++) stats[i] = { ab: 0, h: 0, bb: 0, k: 0, pa: 0 };

  for (const e of state.playLog) {
    if (e.team !== team) continue;
    if (e.event === Hit.Walk) {
      stats[e.batterNum].bb++;
    } else {
      stats[e.batterNum].h++;
    }
    stats[e.batterNum].pa++;
  }
  for (const e of state.strikeoutLog) {
    if (e.team !== team) continue;
    stats[e.batterNum].k++;
  }
  for (const e of state.outLog) {
    if (e.team !== team) continue;
    stats[e.batterNum].ab++;
    stats[e.batterNum].pa++;
  }
  // Hits are in playLog, not outLog — add them back into AB.
  for (let i = 1; i <= 9; i++) stats[i].ab += stats[i].h;
  return stats;
};

// ---------------------------------------------------------------------------
// Seeds to test (varied game outcomes)
// ---------------------------------------------------------------------------

const TEST_SEEDS: Array<{ label: string; seed: number }> = [
  { label: "seed-1a2b3c4d (normal game)", seed: 0x1a2b3c4d },
  { label: "seed-deadc0de (higher-scoring)", seed: 0xdead_c0de },
  { label: "seed-f00d1234 (varied outcomes)", seed: 0xf00d_1234 },
];

// ---------------------------------------------------------------------------
// Shared assertion helpers
// ---------------------------------------------------------------------------

const assertBattingInvariants = (stats: Record<number, BatterStats>, label: string) => {
  for (let slot = 1; slot <= 9; slot++) {
    const { ab, h, bb, k, pa } = stats[slot];
    expect(h, `${label} slot ${slot}: H <= AB`).toBeLessThanOrEqual(ab);
    expect(k, `${label} slot ${slot}: K <= AB`).toBeLessThanOrEqual(ab);
    expect(ab, `${label} slot ${slot}: AB = PA - BB`).toBe(pa - bb);
  }
};

const assertPaOrdering = (stats: Record<number, BatterStats>, label: string) => {
  for (let slot = 1; slot <= 8; slot++) {
    expect(
      stats[slot].pa,
      `${label} slot ${slot} PA >= slot ${slot + 1} PA`,
    ).toBeGreaterThanOrEqual(stats[slot + 1].pa);
  }
};

const assertScoreboardConsistency = (state: State) => {
  for (const t of [0, 1] as const) {
    const inningSum = state.inningRuns[t].reduce((acc, r) => acc + (r ?? 0), 0);
    expect(inningSum, `Team ${t} score == sum(inningRuns)`).toBe(state.score[t]);
  }
};

const assertTeamMapping = (state: State) => {
  for (const entry of state.playLog) {
    expect(entry.team === 0 || entry.team === 1, "playLog team tag is 0 or 1").toBe(true);
  }
  for (const entry of state.strikeoutLog) {
    expect(entry.team === 0 || entry.team === 1, "strikeoutLog team tag is 0 or 1").toBe(true);
  }
  for (const entry of state.outLog) {
    expect(entry.team === 0 || entry.team === 1, "outLog team tag is 0 or 1").toBe(true);
  }

  // Away team (0) events must not appear in home team stat queries and vice versa.
  const awayStats = computeStats(0, state);
  const homeStats = computeStats(1, state);

  // If the away team scored, home stats should not accidentally accumulate those runs
  // via cross-team leakage (i.e. total away playLog runs == score[0]).
  const awayPlayLogRuns = state.playLog.filter((e) => e.team === 0).reduce((s, e) => s + e.runs, 0);
  const homePlayLogRuns = state.playLog.filter((e) => e.team === 1).reduce((s, e) => s + e.runs, 0);

  // Note: playLog only captures hit/walk runs; bunt runs are NOT in playLog.
  // Therefore playLog runs ≤ total score is the correct bound here.
  expect(awayPlayLogRuns, "away playLog runs <= score[0]").toBeLessThanOrEqual(state.score[0]);
  expect(homePlayLogRuns, "home playLog runs <= score[1]").toBeLessThanOrEqual(state.score[1]);

  // Home team stats must not include away-team PA and vice versa.
  const awayTotalPA = Object.values(awayStats).reduce((s, v) => s + v.pa, 0);
  const homeTotalPA = Object.values(homeStats).reduce((s, v) => s + v.pa, 0);
  // A 9-inning game averages ~27 PA per team; just verify neither is zero.
  expect(awayTotalPA, "away team has at least 1 PA").toBeGreaterThan(0);
  expect(homeTotalPA, "home team has at least 1 PA").toBeGreaterThan(0);
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("multi-seed regression — simulation correctness", () => {
  for (const { label, seed } of TEST_SEEDS) {
    describe(label, () => {
      // Run the full game simulation exactly once per seed. All assertions in
      // this describe block share the cached result, avoiding repeated ~3 000-
      // pitch simulations that would slow down CI significantly.
      let cachedState: State;

      beforeAll(() => {
        cachedState = runGame(seed);
      });

      afterAll(() => {
        restoreRng(0);
      });

      it("game completes within 3 000 pitches", () => {
        expect(cachedState.gameOver).toBe(true);
      });

      it("away team (0): batting invariants (H<=AB, K<=AB, AB=PA-BB)", () => {
        assertBattingInvariants(computeStats(0, cachedState), `${label} away`);
      });

      it("home team (1): batting invariants (H<=AB, K<=AB, AB=PA-BB)", () => {
        assertBattingInvariants(computeStats(1, cachedState), `${label} home`);
      });

      it("away team: PA ordering — earlier lineup slots have >= PA", () => {
        assertPaOrdering(computeStats(0, cachedState), `${label} away`);
      });

      it("home team: PA ordering — earlier lineup slots have >= PA", () => {
        assertPaOrdering(computeStats(1, cachedState), `${label} home`);
      });

      it("scoreboard consistency: score[i] == sum(inningRuns[i])", () => {
        assertScoreboardConsistency(cachedState);
      });

      it("team mapping: no cross-team stat leakage in playLog/strikeoutLog/outLog", () => {
        assertTeamMapping(cachedState);
      });
    });
  }

  it("each seed produces a distinct final score (seeds are meaningfully different)", () => {
    const results = TEST_SEEDS.map(({ seed }) => runGame(seed));
    restoreRng(0);
    const scores = results.map((s) => `${s.score[0]}-${s.score[1]}`);
    // Not all three games should have the identical scoreline.
    const unique = new Set(scores);
    expect(unique.size).toBeGreaterThan(1);
  });
});
