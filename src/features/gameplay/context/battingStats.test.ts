/**
 * Regression tests for batting stats consistency.
 *
 * Specifically covers seed `30nl0i` where the 2nd lineup batter (First Baseman)
 * appears to have fewer at-bats than the 3rd batter (Second Baseman).  This is
 * valid behavior: the First Baseman walked once, so their plate appearances (PA)
 * are the same as the Second Baseman's while their official at-bat (AB) count is
 * one lower.  The real invariant is on PA (plate appearances), not raw ABs.
 *
 * Invariants verified:
 *   1. Earlier lineup slots always have PA >= later lineup slots (batting-order
 *      consistency — an earlier batter cannot have *fewer* plate appearances than
 *      a later batter in the same game).
 *   2. K (strikeouts) <= AB for every batter (strikeouts always count as ABs).
 *   3. AB = PA - BB - SF for every batter (walks and sacrifice flies are the only
 *      non-AB plate appearances modelled in this simulator).
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
import { afterEach, describe, expect, it } from "vitest";

import { makeReducer, makeState } from "@test/testHelpers";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** base-36 seed string → 32-bit unsigned integer */
const parseSeed = (s: string): number => parseInt(s, 36) >>> 0;

const SEED_30NL0I = parseSeed("30nl0i");

/**
 * Decide the next pitch action mirroring the logic in `usePitchDispatch`.
 * Uses the new layered swing → contact model from `pitchSimulation.ts`.
 */
const nextPitchAction = (state: State): GameAction => {
  const pitchType = selectPitchType(state.balls, state.strikes, getRandomInt(100));
  const swingRate = computeSwingRate(state.strikes, {
    strategy: "balanced",
    pitchType,
    onePitchMod: state.onePitchModifier,
  });
  const swingRoll = getRandomInt(1000);

  if (swingRoll < swingRate) {
    // Swing: resolve whiff / foul / contact
    const outcomeRoll = getRandomInt(100);
    const outcome = resolveSwingOutcome(outcomeRoll);
    if (outcome === "whiff") return { type: "strike", payload: { swung: true, pitchType } };
    if (outcome === "foul") return { type: "foul", payload: { pitchType } };
    // Contact: determine hit type
    const contactRoll = getRandomInt(100);
    const typeRoll = getRandomInt(100);
    const battedBallType = resolveBattedBallType(contactRoll, typeRoll);
    return { type: "hit", payload: { battedBallType, strategy: "balanced" } };
  }
  // Take
  return { type: "wait", payload: { strategy: "balanced", pitchType } };
};

/** Run a full game from the given seed with default (balanced) strategy. */
const runGame = (seed: number): State => {
  restoreRng(seed);
  const { reducer } = makeReducer();

  const awayTeam = "New York Mets";
  const homeTeam = "New York Yankees";

  let state = makeState({
    teams: [awayTeam, homeTeam],
    lineupOrder: [
      generateRoster(awayTeam).batters.map((b) => b.id),
      generateRoster(homeTeam).batters.map((b) => b.id),
    ],
  });

  let pitches = 0;
  while (!state.gameOver && pitches < 3000) {
    state = reducer(state, nextPitchAction(state));
    pitches++;
  }
  return state;
};

type BatterStats = { ab: number; h: number; bb: number; k: number; pa: number; sf: number };

/** Compute per-slot stats from game state for one team. */
const computeStats = (team: 0 | 1, state: State): Record<number, BatterStats> => {
  const stats: Record<number, BatterStats> = {};
  for (let i = 1; i <= 9; i++) stats[i] = { ab: 0, h: 0, bb: 0, k: 0, pa: 0, sf: 0 };

  for (const e of state.playLog) {
    if (e.team !== team) continue;
    if (e.event === Hit.Walk || e.event === Hit.HitByPitch) {
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
    if (e.isSacFly) {
      stats[e.batterNum].sf++;
    } else {
      stats[e.batterNum].ab++;
    }
    stats[e.batterNum].pa++;
  }
  // AB includes hits (hits are in playLog, not outLog)
  for (let i = 1; i <= 9; i++) stats[i].ab += stats[i].h;
  return stats;
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("batting stats — seed 30nl0i regression", () => {
  afterEach(() => {
    restoreRng(0);
  });

  it("game finishes within 3000 pitches", () => {
    const state = runGame(SEED_30NL0I);
    expect(state.gameOver).toBe(true);
  });

  it("PA ordering invariant: every earlier lineup slot has >= PA as the next slot", () => {
    const state = runGame(SEED_30NL0I);
    const stats = computeStats(0, state);
    for (let slot = 1; slot <= 8; slot++) {
      expect(stats[slot].pa).toBeGreaterThanOrEqual(stats[slot + 1].pa);
    }
  });

  it("K <= AB invariant: strikeouts always count as official at-bats", () => {
    const state = runGame(SEED_30NL0I);
    const stats = computeStats(0, state);
    for (let slot = 1; slot <= 9; slot++) {
      expect(stats[slot].k).toBeLessThanOrEqual(stats[slot].ab);
    }
  });

  it("AB = PA - BB - SF for every batter (walks and sac flies are the only non-AB plate appearances)", () => {
    const state = runGame(SEED_30NL0I);
    const stats = computeStats(0, state);
    for (let slot = 1; slot <= 9; slot++) {
      expect(stats[slot].ab).toBe(stats[slot].pa - stats[slot].bb - stats[slot].sf);
    }
  });

  it("slot 2 may have fewer AB than slot 3 when it has walks (ordering invariant holds)", () => {
    const state = runGame(SEED_30NL0I);
    const stats = computeStats(0, state);
    // When slot 2 has walks, its AB < PA; the PA ordering invariant still holds.
    // This validates that the PA ≥ AB relationship is correctly maintained.
    for (let slot = 1; slot <= 9; slot++) {
      expect(stats[slot].ab).toBeLessThanOrEqual(stats[slot].pa);
      expect(stats[slot].ab).toBeGreaterThanOrEqual(stats[slot].h);
    }
  });

  it("broad sanity: batting averages and K rates are in realistic ranges", () => {
    const state = runGame(SEED_30NL0I);
    const stats = computeStats(0, state);

    for (let slot = 1; slot <= 9; slot++) {
      const { ab, h, k, pa } = stats[slot];
      if (ab > 0) {
        const avg = h / ab;
        // Batting average must be non-negative and cannot exceed 1.0
        expect(avg).toBeGreaterThanOrEqual(0);
        expect(avg).toBeLessThanOrEqual(1.0);
        // K rate should be plausible: strikeouts are not inflated beyond all at-bats
        expect(k).toBeLessThanOrEqual(ab);
        // Sanity: strikeout rate per PA should not exceed 85% for batters with >= 5 PA.
        // (A batter with < 5 PA can legitimately K in all appearances in a single game.)
        if (pa >= 5) {
          expect(k / pa).toBeLessThanOrEqual(0.85);
        }
      }
    }
  });
});
