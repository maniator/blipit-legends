/**
 * Deterministic calibration harness for walk-rate and simulation balance validation.
 *
 * Runs 100 seeded full-game simulations programmatically (no browser, no UI) using
 * the same reducer + pitch pipeline as the real game. Validates that aggregate metrics
 * fall within MLB-realistic bounds.
 *
 * This test is intentionally slow (running full games) but is deterministic:
 * the same seeds always produce the same results.
 */
import { selectPitchType } from "@feat/gameplay/constants/pitchTypes";
import {
  makeAiPitchingDecision,
  makeAiStrategyDecision,
  makeAiTacticalDecision,
} from "@feat/gameplay/context/aiManager";
import type { GameAction, LogAction, State } from "@feat/gameplay/context/index";
import { createFreshGameState } from "@feat/gameplay/context/initialState";
import {
  computeFatigueFactor,
  computeSwingRate,
  resolveBattedBallType,
  resolveSwingOutcome,
} from "@feat/gameplay/context/pitchSimulation";
import reducerFactory, { detectDecision } from "@feat/gameplay/context/reducer";
import { ZERO_MODS } from "@feat/gameplay/context/resolvePlayerMods";
import getRandomInt from "@feat/gameplay/utils/getRandomInt";
import { Hit } from "@shared/constants/hitTypes";
import { restoreRng } from "@shared/utils/rng";
import { describe, expect, it } from "vitest";

interface SimStats {
  plateAppearances: number;
  walks: number;
  strikeouts: number;
  hits: number;
  homeRuns: number;
  runsTotal: number;
  starterBattersFaced: number[];
  relievers: number;
}

/**
 * Runs a single game to completion using the game reducer and pitch pipeline.
 * Seeds the global PRNG so results are deterministic for a given seed.
 * Returns aggregate stats for the game.
 */
function runGame(seed: number): SimStats {
  // Seed the global PRNG so all random() calls (harness + reducer) are deterministic.
  restoreRng(seed);

  const logs: string[] = [];
  const dispatchLog = (action: LogAction) => {
    if (action.type === "log" && action.payload) logs.push(action.payload);
  };

  const gameReducer = reducerFactory(dispatchLog);
  let state: State = createFreshGameState(["Away", "Home"]);

  const dispatch = (action: GameAction): void => {
    state = gameReducer(state, action);
  };

  let maxTicks = 50000; // safety guard against infinite loops

  while (!state.gameOver && maxTicks-- > 0) {
    const pitchingTeamIdx = (1 - state.atBat) as 0 | 1;

    // ── AI pitching change at start of each at-bat ────────────────────────
    if (state.balls === 0 && state.strikes === 0) {
      const aiPitchDecision = makeAiPitchingDecision(state, pitchingTeamIdx, {});
      if (aiPitchDecision.kind === "pitching_change") {
        dispatch({
          type: "make_substitution",
          payload: {
            teamIdx: aiPitchDecision.teamIdx,
            kind: "pitcher",
            pitcherIdx: aiPitchDecision.pitcherIdx,
            reason: aiPitchDecision.reasonText,
          },
        });
      }
    }

    // ── AI batting strategy ───────────────────────────────────────────────
    const aiStrategy = makeAiStrategyDecision(state, state.atBat as 0 | 1);

    // ── AI tactical decisions ─────────────────────────────────────────────
    if (state.suppressNextDecision) {
      dispatch({ type: "clear_suppress_decision" });
      // Fall through to pitch resolution.
    } else {
      const battingDecision = detectDecision(state, aiStrategy, true);
      if (battingDecision) {
        const aiAction = makeAiTacticalDecision(state, battingDecision);
        if (aiAction.kind === "tactical") {
          dispatch({
            type: aiAction.actionType as GameAction["type"],
            payload: aiAction.payload,
          });
          // After a concrete pinch-hit substitution, lock in the strategy.
          if (
            battingDecision.kind === "pinch_hitter" &&
            aiAction.actionType === "make_substitution"
          ) {
            dispatch({ type: "set_pinch_hitter_strategy", payload: "contact" });
          }
          // Actions that replace the pitch — skip pitch resolution for this tick.
          if (["steal_attempt", "bunt_attempt", "intentional_walk"].includes(aiAction.actionType)) {
            continue;
          }
        } else {
          dispatch({ type: "skip_decision" });
        }
      }
    }

    // ── Pitch resolution pipeline (mirrors usePitchDispatch) ─────────────
    const effectiveStrategy = state.pinchHitterStrategy ?? aiStrategy;
    const onePitchMod = state.onePitchModifier;

    // Pitch type selection.
    const pitchType = selectPitchType(state.balls, state.strikes, getRandomInt(100));

    // Batter / pitcher mods.
    const battingTeam = state.atBat as 0 | 1;
    const batterSlotIdx = state.batterIndex[battingTeam];
    const batterId = state.lineupOrder[battingTeam]?.[batterSlotIdx];
    const batterMods = batterId
      ? (state.resolvedMods?.[battingTeam]?.[batterId] ?? ZERO_MODS)
      : ZERO_MODS;

    const pitchingTeam = (1 - (state.atBat as number)) as 0 | 1;
    const activePitcherId =
      state.rosterPitchers?.[pitchingTeam]?.[(state.activePitcherIdx ?? [0, 0])[pitchingTeam]];
    const pitcherMods = activePitcherId
      ? (state.resolvedMods?.[pitchingTeam]?.[activePitcherId] ?? ZERO_MODS)
      : ZERO_MODS;

    const pitcherBattersFaced = (state.pitcherBattersFaced ?? [0, 0])[pitchingTeam];
    const pitcherPitchCount = (state.pitcherPitchCount ?? [0, 0])[pitchingTeam];
    const fatigueFactor = computeFatigueFactor(
      pitcherPitchCount,
      pitcherBattersFaced,
      pitcherMods.staminaMod,
    );

    // Swing vs. take decision.
    const swingRoll = getRandomInt(1000);
    const swingRate = computeSwingRate(state.strikes, {
      strategy: effectiveStrategy,
      batterContactMod: batterMods.contactMod,
      pitchType,
      onePitchMod,
    });

    if (swingRoll < swingRate) {
      const outcomeRoll = getRandomInt(100);
      const swingOutcome = resolveSwingOutcome(outcomeRoll, {
        pitcherVelocityMod: pitcherMods.velocityMod,
        pitcherMovementMod: pitcherMods.movementMod,
        batterContactMod: batterMods.contactMod,
        fatigueFactor,
      });

      if (swingOutcome === "whiff") {
        dispatch({ type: "strike", payload: { swung: true, pitchType } });
      } else if (swingOutcome === "foul") {
        dispatch({ type: "foul", payload: { pitchType } });
      } else {
        const contactRoll = getRandomInt(100);
        const typeRoll = getRandomInt(100);
        const battedBallType = resolveBattedBallType(contactRoll, typeRoll, {
          strategy: effectiveStrategy,
          batterPowerMod: batterMods.powerMod,
          pitcherVelocityMod: pitcherMods.velocityMod,
          pitcherMovementMod: pitcherMods.movementMod,
          fatigueFactor,
        });
        dispatch({ type: "hit", payload: { battedBallType, strategy: effectiveStrategy } });
      }
    } else {
      dispatch({ type: "wait", payload: { strategy: effectiveStrategy, pitchType } });
    }
  }

  // ── Tally stats from game log ─────────────────────────────────────────────
  let walks = 0;
  let hits = 0;
  let homeRuns = 0;
  for (const entry of state.playLog) {
    if (entry.event === Hit.Walk || entry.event === Hit.HitByPitch) walks++;
    else if (
      entry.event === Hit.Single ||
      entry.event === Hit.Double ||
      entry.event === Hit.Triple ||
      entry.event === Hit.Homerun
    ) {
      hits++;
      if (entry.event === Hit.Homerun) homeRuns++;
    }
  }

  const strikeouts = state.strikeoutLog.length;

  // Estimate PA from hits + walks + outs (outLog includes Ks + non-K outs).
  // Use hits + walks + outLog.length as a close proxy for PA.
  const plateAppearances = walks + hits + state.outLog.length;

  // Starter BF: first pitcher entry per team in pitcherGameLog.
  const starterBattersFaced: number[] = [];
  for (let team = 0; team < 2; team++) {
    const log = state.pitcherGameLog[team as 0 | 1];
    if (log.length > 0) {
      starterBattersFaced.push(log[0].battersFaced);
    }
  }

  // Relievers used: all entries after the first for each team.
  const relievers =
    Math.max(0, state.pitcherGameLog[0].length - 1) +
    Math.max(0, state.pitcherGameLog[1].length - 1);

  return {
    plateAppearances,
    walks,
    strikeouts,
    hits,
    homeRuns,
    runsTotal: state.score[0] + state.score[1],
    starterBattersFaced,
    relievers,
  };
}

describe("Calibration harness — aggregate simulation balance", () => {
  /**
   * Baseline capture: runs 100 seeded games and logs aggregate stats.
   *
   * This test intentionally uses permissive bounds so it passes against both
   * the pre-tuning baseline and the post-tuning target state.  The actual
   * numbers are printed to stdout so they can be recorded in the QA findings
   * document.  Once balance tuning is applied and the post-tuning run is
   * recorded, the bounds below will be tightened to enforce the improvement.
   */
  it("runs 100 seeded games and reports aggregate metrics (baseline capture)", () => {
    const NUM_GAMES = 100;
    let totalPA = 0;
    let totalWalks = 0;
    let totalK = 0;
    let totalHits = 0;
    let totalHR = 0;
    let totalRuns = 0;
    const starterBF: number[] = [];

    for (let seed = 1; seed <= NUM_GAMES; seed++) {
      const stats = runGame(seed);
      totalPA += stats.plateAppearances;
      totalWalks += stats.walks;
      totalK += stats.strikeouts;
      totalHits += stats.hits;
      totalHR += stats.homeRuns;
      totalRuns += stats.runsTotal;
      starterBF.push(...stats.starterBattersFaced);
    }

    const bbPct = (totalWalks / totalPA) * 100;
    const kPct = (totalK / totalPA) * 100;
    const hitPerPA = totalHits / totalPA;
    const hrPerPA = totalHR / totalPA;
    const runsPerGame = totalRuns / NUM_GAMES;
    const avgStarterBF =
      starterBF.length > 0 ? starterBF.reduce((a, b) => a + b, 0) / starterBF.length : 0;

    // Print results for baseline capture — these values go into the QA findings doc.
    console.log(`\n=== Calibration Results (${NUM_GAMES} games, seeds 1–${NUM_GAMES}) ===`);
    console.log(`Total PA:        ${totalPA}`);
    console.log(`BB%:             ${bbPct.toFixed(1)}%`);
    console.log(`K%:              ${kPct.toFixed(1)}%`);
    console.log(`H/PA:            ${hitPerPA.toFixed(3)}`);
    console.log(`HR/PA:           ${hrPerPA.toFixed(3)}`);
    console.log(`Runs/game:       ${runsPerGame.toFixed(1)}`);
    console.log(`Avg starter BF:  ${avgStarterBF.toFixed(1)}`);

    // Post-tuning pass-11 regression bounds (take base 750→220 across 11 passes).
    // Harness uses stock teams (all-balanced, uniform mods) → lower BB% than custom-team browser runs.
    // Stock-team BB% has plateaued at ~5.2–5.4% since pass 7 — the take-base lever primarily moves
    // custom-team BB% (via batter strategy variance) rather than stock teams.
    // Pass-11 harness readings: BB%=5.2%, K%=25.3%, runs/game=11.9.
    // Passes 9–11 applied to close the remaining ~1.5 pp browser gap (10.5% → ~9% target):
    //   pass 9 (370→320), pass 10 (320→270), pass 11 (270→220) at ~0.5 pp per 50-pt reduction.
    // Upper bounds guard against regression to pre-fix state (BB%=15.3%).
    expect(totalPA, "should have processed some plate appearances").toBeGreaterThan(0);
    expect(
      bbPct,
      "BB% should be between 3% and 9% (pass-11 stock-team baseline ~5%)",
    ).toBeGreaterThan(3);
    expect(bbPct, "BB% should be between 3% and 9% (pass-11 stock-team baseline ~5%)").toBeLessThan(
      9,
    );
    expect(
      kPct,
      "K% should be between 20% and 32% (pass-11 stock-team baseline ~25%)",
    ).toBeGreaterThan(20);
    expect(
      kPct,
      "K% should be between 20% and 32% (pass-11 stock-team baseline ~25%)",
    ).toBeLessThan(32);
    expect(
      runsPerGame,
      "runs/game should be between 7 and 15 (pass-11 stock-team baseline ~12)",
    ).toBeGreaterThan(7);
    expect(
      runsPerGame,
      "runs/game should be between 7 and 15 (pass-11 stock-team baseline ~12)",
    ).toBeLessThan(15);
  }, 120_000); // 120s timeout for 100 full-game simulations
});
