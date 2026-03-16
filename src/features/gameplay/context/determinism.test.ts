/**
 * Determinism tests: verify that the same seed + same playerOverrides + same
 * lineupOrder always produce an identical game result, and that overrides/order
 * are faithfully preserved in state throughout the entire simulation.
 */

import type {
  GameAction,
  LogAction,
  State,
  TeamCustomPlayerOverrides,
} from "@feat/gameplay/context/index";
import { restoreRng } from "@shared/utils/rng";
import { generateRoster } from "@shared/utils/roster";
import { afterEach, describe, expect, it } from "vitest";

import { makeReducer, makeState } from "@test/testHelpers";

// A fixed seed to use across tests — arbitrary but stable.
const FIXED_SEED = 0x12ab34cd;

/**
 * Drives the reducer forward using a repeating pattern of hits and strikeouts
 * until the game ends or `maxSteps` is reached.
 *
 * Each "inning unit" is: single → strikeout×3 → double → strikeout×3 →
 * triple → strikeout×3  (3 outs per half-inning via strikeouts, some base
 * runners via hits to exercise run-scoring and pop-out RNG paths).
 */
const INNING_UNIT: GameAction[] = [
  { type: "hit", payload: { battedBallType: "line_drive", strategy: "balanced" } },
  { type: "strike", payload: { swung: true } },
  { type: "strike", payload: { swung: true } },
  { type: "strike", payload: { swung: true } }, // 1st out
  { type: "hit", payload: { battedBallType: "deep_fly", strategy: "balanced" } },
  { type: "strike", payload: { swung: true } },
  { type: "strike", payload: { swung: true } },
  { type: "strike", payload: { swung: true } }, // 2nd out
  { type: "hit", payload: { battedBallType: "hard_grounder", strategy: "balanced" } },
  { type: "strike", payload: { swung: true } },
  { type: "strike", payload: { swung: true } },
  { type: "strike", payload: { swung: true } }, // 3rd out → half-inning over
];

// 18 half-innings + spare capacity
const FULL_GAME_ACTIONS: GameAction[] = Array.from({ length: 20 }, () => INNING_UNIT).flat();

const runGame = (seed: number, initial: State): State => {
  restoreRng(seed);
  const { reducer } = makeReducer();
  return FULL_GAME_ACTIONS.reduce((state, action) => {
    if (state.gameOver) return state;
    return reducer(state, action);
  }, initial);
};

const metsRoster = generateRoster("New York Mets");
const yankeesRoster = generateRoster("New York Yankees");

const customOverrides: [TeamCustomPlayerOverrides, TeamCustomPlayerOverrides] = [
  { [metsRoster.batters[0].id]: { contactMod: 10, nickname: "Speedy" } },
  { [yankeesRoster.batters[3].id]: { powerMod: -5 } },
];

const customOrder: [string[], string[]] = [
  // Mets: DH leads off, then the rest in reverse
  [
    metsRoster.batters[8].id, // DH
    metsRoster.batters[7].id, // RF
    metsRoster.batters[6].id, // CF
    metsRoster.batters[5].id, // LF
    metsRoster.batters[4].id, // SS
    metsRoster.batters[3].id, // 3B
    metsRoster.batters[2].id, // 2B
    metsRoster.batters[1].id, // 1B
    metsRoster.batters[0].id, // C
  ],
  // Yankees: default order
  yankeesRoster.batters.map((b) => b.id),
];

describe("game determinism with player customizations", () => {
  afterEach(() => {
    // Restore a neutral RNG state so other test files are unaffected.
    restoreRng(0);
  });

  it("produces an identical completed game when run twice with the same seed, overrides, and lineup order", () => {
    const initial = makeState({
      teams: ["New York Mets", "New York Yankees"],
      playerOverrides: customOverrides,
      lineupOrder: customOrder,
    });

    const result1 = runGame(FIXED_SEED, initial);
    const result2 = runGame(FIXED_SEED, initial);

    expect(result1.gameOver).toBe(true);
    expect(result2).toEqual(result1);
  });

  it("produces different scores when run with a different seed", () => {
    const initial = makeState({
      teams: ["New York Mets", "New York Yankees"],
      playerOverrides: customOverrides,
      lineupOrder: customOrder,
    });

    const result1 = runGame(FIXED_SEED, initial);
    const result2 = runGame(FIXED_SEED + 1, initial);

    // With distinct seeds the PRNG sequences diverge; scores should differ.
    // (Both are still completed games.)
    expect(result1.gameOver).toBe(true);
    expect(result2.gameOver).toBe(true);
    expect(result1.score).not.toEqual(result2.score);
  });

  it("preserves playerOverrides in state for the entire game", () => {
    const initial = makeState({
      teams: ["New York Mets", "New York Yankees"],
      playerOverrides: customOverrides,
      lineupOrder: customOrder,
    });

    const result = runGame(FIXED_SEED, initial);

    expect(result.playerOverrides).toEqual(customOverrides);
  });

  it("preserves lineupOrder in state for the entire game", () => {
    const initial = makeState({
      teams: ["New York Mets", "New York Yankees"],
      playerOverrides: customOverrides,
      lineupOrder: customOrder,
    });

    const result = runGame(FIXED_SEED, initial);

    expect(result.lineupOrder).toEqual(customOrder);
  });

  it("two games that share a seed but differ in lineup order produce the same score (v1 — order not yet used in simulation)", () => {
    const defaultOrder: [string[], string[]] = [
      metsRoster.batters.map((b) => b.id),
      yankeesRoster.batters.map((b) => b.id),
    ];

    const initial1 = makeState({
      teams: ["New York Mets", "New York Yankees"],
      playerOverrides: customOverrides,
      lineupOrder: defaultOrder,
    });
    const initial2 = makeState({
      teams: ["New York Mets", "New York Yankees"],
      playerOverrides: customOverrides,
      lineupOrder: customOrder,
    });

    const result1 = runGame(FIXED_SEED, initial1);
    const result2 = runGame(FIXED_SEED, initial2);

    // Scores are identical because lineupOrder is stored but not yet read by
    // the simulation engine (v1). Once the sim consumes lineupOrder this test
    // should be updated to assert divergence.
    expect(result1.score).toEqual(result2.score);

    // Each result still carries its own distinct lineup order.
    expect(result1.lineupOrder).toEqual(defaultOrder);
    expect(result2.lineupOrder).toEqual(customOrder);
  });
});
