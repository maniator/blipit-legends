/**
 * gameSweep.test.ts
 *
 * 100-game simulation sweep (seeds 0–99, decimal) — baseline stats capture.
 *
 * Reports per-game averages for HR, BB, and SB, and compares against 2023 MLB
 * targets (per team per game):
 *   HR/game:  1.08
 *   BB/game:  3.28
 *   SB/game:  0.85
 *
 * Run in isolation with:
 *   npx vitest run --reporter=verbose src/features/gameplay/context/gameSweep.test.ts
 *
 * This file is deliberately skipped in the normal test suite (`describe.skip`)
 * to avoid inflating CI times.  Remove the `.skip` to regenerate baselines.
 */

import { selectPitchType } from "@feat/gameplay/constants/pitchTypes";
import { makeAiStrategyDecision, makeAiTacticalDecision } from "@feat/gameplay/context/aiManager";
import type { GameAction, State } from "@feat/gameplay/context/index";
import type { ManagerDecisionValues } from "@feat/gameplay/context/managerDecisionValues";
import { DEFAULT_MANAGER_DECISION_VALUES } from "@feat/gameplay/context/managerDecisionValues";
import {
  computeSwingRate,
  resolveBattedBallType,
  resolveSwingOutcome,
} from "@feat/gameplay/context/pitchSimulation";
import { detectDecision } from "@feat/gameplay/context/reducer";
import getRandomInt from "@feat/gameplay/utils/getRandomInt";
import { Hit } from "@shared/constants/hitTypes";
import { reinitSeed } from "@shared/utils/rng";
import { generateRoster } from "@shared/utils/roster";
import { describe, expect, it } from "vitest";

import { makeReducer, makeState } from "@test/testHelpers";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GameStats {
  hrs: number;
  bbs: number; // walks (including IBB)
  ibbWalks: number; // intentional walks (subset of bbs)
  sbs: number; // successful stolen bases
  innings: number;
}

// ---------------------------------------------------------------------------
// Pitch resolution (mirrors nextPitchAction in battingStats.test.ts)
// ---------------------------------------------------------------------------

const nextPitchAction = (state: State, strategy = "balanced" as string): GameAction => {
  const pitchType = selectPitchType(state.balls, state.strikes, getRandomInt(100));
  const swingRate = computeSwingRate(state.strikes, {
    strategy: strategy as import("@feat/gameplay/context/index").Strategy,
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
    const battedBallType = resolveBattedBallType(contactRoll, typeRoll, {
      strategy: strategy as import("@feat/gameplay/context/index").Strategy,
    });
    return { type: "hit", payload: { battedBallType, strategy } };
  }
  return {
    type: "wait",
    payload: {
      strategy,
      pitchType,
    },
  };
};

// ---------------------------------------------------------------------------
// Full game simulation with AI decisions
// ---------------------------------------------------------------------------

const runGameWithAI = (seed: number, decisionValues: ManagerDecisionValues): GameStats => {
  // Use reinitSeed (not restoreRng) so that:
  //  (a) the module-level `seed` identity variable is correctly set, and
  //  (b) the API contract is respected — restoreRng is for mid-game save restore
  //      (expects a captured rngInternalA), not for fresh game initialization.
  reinitSeed(seed.toString(36));
  const { reducer } = makeReducer();

  const awayTeam = "New York Mets";
  const homeTeam = "New York Yankees";
  const awayRoster = generateRoster(awayTeam);
  const homeRoster = generateRoster(homeTeam);

  let state = makeState({
    teams: [awayTeam, homeTeam],
    lineupOrder: [awayRoster.batters.map((b) => b.id), homeRoster.batters.map((b) => b.id)],
    rosterPitchers: [[awayRoster.pitcher.id], [homeRoster.pitcher.id]],
  });

  let sbs = 0;
  let ibbWalks = 0;
  let pitches = 0;
  const MAX_PITCHES = 3_000;

  while (!state.gameOver && pitches < MAX_PITCHES) {
    // --- Handle suppressNextDecision (fires after IBB) ---
    if (state.suppressNextDecision) {
      state = reducer(state, { type: "clear_suppress_decision" });
      continue;
    }

    // --- AI batting-team decisions (steal, bunt, IBB, count mods) ---
    if (!state.gameOver) {
      const battingTeam = state.atBat as 0 | 1;
      const aiStrategy = makeAiStrategyDecision(state, battingTeam);

      // Use aiStealThreshold as the offer gate (same as usePitchDispatch AI path)
      const aiDecisionValues: ManagerDecisionValues = {
        ...decisionValues,
        stealMinOfferPct: decisionValues.aiStealThreshold,
      };
      const decision = detectDecision(state, aiStrategy, true, aiDecisionValues);

      if (decision) {
        const aiAction = makeAiTacticalDecision(state, decision, decisionValues);
        if (aiAction.kind === "tactical") {
          const replacePitch = ["steal_attempt", "bunt_attempt", "intentional_walk"].includes(
            aiAction.actionType,
          );

          if (aiAction.actionType === "steal_attempt") {
            const prevOuts = state.outs;
            state = reducer(state, {
              type: "steal_attempt",
              payload: aiAction.payload,
            });
            // Successful steal: outs didn't increase
            if (state.outs === prevOuts) sbs++;
            pitches++;
            continue;
          }

          if (aiAction.actionType === "intentional_walk") {
            const prevBBs = state.playLog.filter((e) => e.event === Hit.Walk).length;
            state = reducer(state, { type: "intentional_walk" });
            // Count IBBs separately so we can subtract from BB if desired
            const newBBs = state.playLog.filter((e) => e.event === Hit.Walk).length;
            if (newBBs > prevBBs) ibbWalks++;
            pitches++;
            continue;
          }

          if (aiAction.actionType === "bunt_attempt") {
            state = reducer(state, {
              type: "bunt_attempt",
              payload: { strategy: aiStrategy },
            });
            pitches++;
            continue;
          }

          // set_one_pitch_modifier or other non-pitch-replacing decisions
          // (including make_substitution for pinch hitter):
          // Apply the state update, then fall through to pitch.
          if (!replacePitch) {
            state = reducer(state, {
              type: aiAction.actionType as GameAction["type"],
              payload: aiAction.payload,
            });
            // Mirror production: after a pinch-hit substitution, lock the
            // strategy to "contact" so the decision is not re-offered this
            // at-bat (matches the set_pinch_hitter_strategy dispatch in
            // usePitchDispatch after make_substitution).
            if (aiAction.actionType === "make_substitution" && decision.kind === "pinch_hitter") {
              state = reducer(state, {
                type: "set_pinch_hitter_strategy",
                payload: "contact",
              });
            }
            // Fall through — pitch still happens this tick
          }
        } else {
          // AI declined: skip the decision
          state = reducer(state, { type: "skip_decision" });
          // Fall through to pitch
        }
      }
    }

    // --- Normal pitch ---
    const battingTeam = state.atBat as 0 | 1;
    const aiStrategy = makeAiStrategyDecision(state, battingTeam);
    const effectiveStrategy = state.pinchHitterStrategy ?? aiStrategy;
    const action = nextPitchAction(state, effectiveStrategy);
    state = reducer(state, action);
    pitches++;
  }

  // Collect final stats from playLog
  const hrs = state.playLog.filter((e) => e.event === Hit.Homerun).length;
  const bbs = state.playLog.filter((e) => e.event === Hit.Walk).length;

  return {
    hrs,
    bbs,
    ibbWalks,
    sbs,
    innings: state.inning,
  };
};

// ---------------------------------------------------------------------------
// Sweep
// ---------------------------------------------------------------------------

const NUM_GAMES = 100;
const SEEDS = Array.from({ length: NUM_GAMES }, (_, i) => i);

// 2023 MLB targets (per team per game)
const MLB_2023 = { hr: 1.08, bb: 3.28, sb: 0.85 } as const;
const TOLERANCE = 0.1; // within 10%

describe.skip("gameSweep — 100-game baseline (run manually)", () => {
  it("collects HR/BB/SB averages and checks 2023 MLB proximity", () => {
    const results: GameStats[] = [];

    for (const seed of SEEDS) {
      results.push(runGameWithAI(seed, DEFAULT_MANAGER_DECISION_VALUES));
    }

    // Per-game totals = sum across both teams for each game (= total events / #games)
    const avgHR = results.reduce((s, r) => s + r.hrs, 0) / NUM_GAMES;
    const avgBB = results.reduce((s, r) => s + r.bbs, 0) / NUM_GAMES;
    const avgBBnoIBB = results.reduce((s, r) => s + (r.bbs - r.ibbWalks), 0) / NUM_GAMES;
    const avgSB = results.reduce((s, r) => s + r.sbs, 0) / NUM_GAMES;

    // Per-TEAM averages (two teams per game)
    const perTeamHR = avgHR / 2;
    const perTeamBB = avgBB / 2;
    const perTeamBBnoIBB = avgBBnoIBB / 2;
    const perTeamSB = avgSB / 2;

    console.log("\n════════════════════════════════════════════");
    console.log("  GAME SWEEP — 100 games, seeds 0–99");
    console.log("════════════════════════════════════════════");
    console.log(
      `  HR/game (both teams): ${avgHR.toFixed(2)}  | per team: ${perTeamHR.toFixed(2)}  | target: ${MLB_2023.hr}`,
    );
    console.log(
      `  BB/game (both teams): ${avgBB.toFixed(2)}  | per team: ${perTeamBB.toFixed(2)}  | target: ${MLB_2023.bb}  (excl. IBB: ${perTeamBBnoIBB.toFixed(2)})`,
    );
    console.log(
      `  SB/game (both teams): ${avgSB.toFixed(2)}  | per team: ${perTeamSB.toFixed(2)}  | target: ${MLB_2023.sb}`,
    );
    console.log("────────────────────────────────────────────");

    const hrOk = Math.abs(perTeamHR - MLB_2023.hr) / MLB_2023.hr <= TOLERANCE;
    const bbOk = Math.abs(perTeamBB - MLB_2023.bb) / MLB_2023.bb <= TOLERANCE;
    const sbOk = Math.abs(perTeamSB - MLB_2023.sb) / MLB_2023.sb <= TOLERANCE;

    console.log(
      `  HR within 10%: ${hrOk ? "✓" : "✗"} (${(((perTeamHR - MLB_2023.hr) / MLB_2023.hr) * 100).toFixed(1)}% off)`,
    );
    console.log(
      `  BB within 10%: ${bbOk ? "✓" : "✗"} (${(((perTeamBB - MLB_2023.bb) / MLB_2023.bb) * 100).toFixed(1)}% off)`,
    );
    console.log(
      `  SB within 10%: ${sbOk ? "✓" : "✗"} (${(((perTeamSB - MLB_2023.sb) / MLB_2023.sb) * 100).toFixed(1)}% off)`,
    );
    console.log("════════════════════════════════════════════\n");

    // Soft assertions — the test records data; hard failures are intentionally
    // lenient so the sweep always completes and reports numbers.
    expect(perTeamHR).toBeGreaterThan(0);
    expect(perTeamBB).toBeGreaterThan(0);
    expect(perTeamSB).toBeGreaterThanOrEqual(0);
  });
});
