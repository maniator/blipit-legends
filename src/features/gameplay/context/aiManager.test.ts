/**
 * Unit tests for aiManager — AI manager decision engine for unmanaged teams.
 */
import * as rng from "@shared/utils/rng";
import { afterEach, describe, expect, it, vi } from "vitest";

import { makeState } from "@test/testHelpers";

import {
  AI_FATIGUE_THRESHOLD_HIGH,
  AI_FATIGUE_THRESHOLD_MEDIUM,
  findBestReliever,
  isPitcherEligibleForChange,
  makeAiPitchingDecision,
  makeAiStrategyDecision,
  makeAiTacticalDecision,
} from "./aiManager";
import { DEFAULT_MANAGER_DECISION_VALUES } from "./managerDecisionValues";

describe("isPitcherEligibleForChange", () => {
  it("returns false when pitcherIdx === activePitcherIdx", () => {
    expect(isPitcherEligibleForChange("p1", 0, 0, [], "RP")).toBe(false);
  });

  it("returns false when pitcher is in substitutedOut list", () => {
    expect(isPitcherEligibleForChange("p1", 1, 0, ["p1"], "RP")).toBe(false);
  });

  it("returns true for RP role when not active and not subbed out", () => {
    expect(isPitcherEligibleForChange("p2", 1, 0, [], "RP")).toBe(true);
  });

  it("returns true for SP/RP dual role", () => {
    expect(isPitcherEligibleForChange("p2", 1, 0, [], "SP/RP")).toBe(true);
  });

  it("returns false for SP-only role in in-game change", () => {
    expect(isPitcherEligibleForChange("p2", 1, 0, [], "SP")).toBe(false);
  });

  it("returns true when no role set (legacy/stock teams allow any pitcher)", () => {
    expect(isPitcherEligibleForChange("p2", 1, 0, [], undefined)).toBe(true);
  });
});

describe("findBestReliever", () => {
  it("returns -1 when no eligible pitchers exist", () => {
    const idx = findBestReliever(["p1"], 0, [], {});
    expect(idx).toBe(-1);
  });

  it("prefers explicit RP over SP/RP", () => {
    const pitchers = ["sp1", "rp1", "swingman1"];
    const roles = { sp1: "SP", rp1: "RP", swingman1: "SP/RP" };
    const idx = findBestReliever(pitchers, 0, [], roles);
    expect(idx).toBe(1); // rp1 is at index 1
  });

  it("falls back to SP/RP when no pure RP available", () => {
    const pitchers = ["sp1", "swingman1"];
    const roles = { sp1: "SP", swingman1: "SP/RP" };
    const idx = findBestReliever(pitchers, 0, [], roles);
    expect(idx).toBe(1); // swingman1
  });

  it("skips the active pitcher", () => {
    const pitchers = ["rp1", "rp2"];
    const roles = { rp1: "RP", rp2: "RP" };
    const idx = findBestReliever(pitchers, 0, [], roles); // active is index 0 (rp1)
    expect(idx).toBe(1); // rp2
  });

  it("skips substituted-out pitchers", () => {
    const pitchers = ["p1", "p2", "p3"];
    const roles = { p1: "RP", p2: "RP", p3: "RP" };
    const idx = findBestReliever(pitchers, 0, ["p2"], roles);
    // p1 is active (idx 0), p2 is subbed out, so p3 (idx 2) should be chosen
    expect(idx).toBe(2);
  });
});

describe("makeAiPitchingDecision", () => {
  afterEach(() => vi.restoreAllMocks());

  // Pin random() to 0 so the probabilistic pull always fires in fatigue tests.
  const alwaysPull = () => vi.spyOn(rng, "random").mockReturnValue(0);

  it("returns none when pitcher is not fatigued", () => {
    // Mock random() so any future refactoring that reaches the probabilistic
    // pull path does not make this test non-deterministic.
    alwaysPull();
    const state = makeState({
      pitcherPitchCount: [5, 5],
      pitcherBattersFaced: [2, 2],
      rosterPitchers: [
        ["sp1", "rp1"],
        ["sp1", "rp1"],
      ],
      activePitcherIdx: [0, 0],
      substitutedOut: [[], []],
    });
    const decision = makeAiPitchingDecision(state, 1);
    expect(decision.kind).toBe("none");
  });

  it("returns pitching_change when fatigue is high", () => {
    alwaysPull();
    const state = makeState({
      pitcherPitchCount: [0, AI_FATIGUE_THRESHOLD_HIGH],
      pitcherBattersFaced: [0, 0],
      rosterPitchers: [[], ["sp1", "rp1"]],
      activePitcherIdx: [0, 0],
      substitutedOut: [[], []],
    });
    const decision = makeAiPitchingDecision(state, 1, { sp1: "SP", rp1: "RP" });
    expect(decision.kind).toBe("pitching_change");
    if (decision.kind === "pitching_change") {
      expect(decision.pitcherIdx).toBe(1); // rp1 at index 1
      expect(decision.reason).toBe("pitcher_fatigue_high");
      expect(decision.reasonText).toContain("fatigue");
    }
  });

  it("returns pitching_change in late innings at medium fatigue", () => {
    alwaysPull();
    const state = makeState({
      inning: 7, // inning >= 7 now required for medium fatigue hook (context-aware)
      pitcherPitchCount: [0, AI_FATIGUE_THRESHOLD_MEDIUM],
      pitcherBattersFaced: [0, 0],
      rosterPitchers: [[], ["sp1", "rp1"]],
      activePitcherIdx: [0, 0],
      substitutedOut: [[], []],
    });
    const decision = makeAiPitchingDecision(state, 1, { sp1: "SP", rp1: "RP" });
    expect(decision.kind).toBe("pitching_change");
    if (decision.kind === "pitching_change") {
      expect(decision.reason).toBe("pitcher_fatigue_medium");
    }
  });

  it("returns none at medium fatigue in early innings with no game pressure", () => {
    // Early inning + blowout score + no runners on → no medium-fatigue hook.
    const state = makeState({
      inning: 3,
      score: [5, 0], // comfortable lead (not tight — diff > 2)
      pitcherPitchCount: [0, AI_FATIGUE_THRESHOLD_MEDIUM],
      pitcherBattersFaced: [0, 0],
      rosterPitchers: [[], ["sp1", "rp1"]],
      activePitcherIdx: [0, 0],
      substitutedOut: [[], []],
      baseLayout: [0, 0, 0],
    });
    const decision = makeAiPitchingDecision(state, 1, { sp1: "SP", rp1: "RP" });
    expect(decision.kind).toBe("none");
  });

  it("returns pitching_change at medium fatigue in tight early game", () => {
    alwaysPull();
    // Close game (score ±2) should trigger hook even in early innings.
    const state = makeState({
      inning: 3,
      score: [1, 1], // tied = tight game
      pitcherPitchCount: [0, AI_FATIGUE_THRESHOLD_MEDIUM],
      pitcherBattersFaced: [0, 0],
      rosterPitchers: [[], ["sp1", "rp1"]],
      activePitcherIdx: [0, 0],
      substitutedOut: [[], []],
    });
    const decision = makeAiPitchingDecision(state, 1, { sp1: "SP", rp1: "RP" });
    expect(decision.kind).toBe("pitching_change");
  });

  it("probabilistic skip: returns none when random() exceeds pull probability", () => {
    vi.spyOn(rng, "random").mockReturnValue(1); // above any probability → never pull
    const state = makeState({
      pitcherPitchCount: [0, AI_FATIGUE_THRESHOLD_HIGH],
      pitcherBattersFaced: [0, 0],
      rosterPitchers: [[], ["sp1", "rp1"]],
      activePitcherIdx: [0, 0],
      substitutedOut: [[], []],
    });
    const decision = makeAiPitchingDecision(state, 1, { sp1: "SP", rp1: "RP" });
    expect(decision.kind).toBe("none");
  });

  it("returns none when all relievers are used (no-reentry)", () => {
    const state = makeState({
      pitcherPitchCount: [0, AI_FATIGUE_THRESHOLD_HIGH],
      pitcherBattersFaced: [0, 0],
      rosterPitchers: [[], ["sp1", "rp1"]],
      activePitcherIdx: [0, 0],
      substitutedOut: [[], ["rp1"]], // rp1 was subbed out
    });
    const decision = makeAiPitchingDecision(state, 1, { sp1: "SP", rp1: "RP" });
    // sp1 is SP-only so not eligible, rp1 is subbed out
    expect(decision.kind).toBe("none");
  });

  it("handles missing pitcherPitchCount gracefully (backward compat)", () => {
    // Simulate an older save without the field
    const state = makeState({
      rosterPitchers: [[], ["sp1", "rp1"]],
      activePitcherIdx: [0, 0],
      substitutedOut: [[], []],
    });
    // Delete the field to simulate an older save
    delete (state as unknown as Record<string, unknown>)["pitcherPitchCount"];
    const decision = makeAiPitchingDecision(state as typeof state, 1);
    expect(decision.kind).toBe("none");
  });

  it("prefers reliever with better handedness matchup when candidates are otherwise eligible", () => {
    alwaysPull();
    const state = makeState({
      pitcherPitchCount: [0, AI_FATIGUE_THRESHOLD_HIGH],
      pitcherBattersFaced: [0, 0],
      rosterPitchers: [["unused"], ["sp1", "rpL", "rpR"]],
      activePitcherIdx: [0, 0],
      substitutedOut: [[], []],
      lineupOrder: [["bL"], []],
      batterIndex: [0, 0],
      handednessByTeam: [{ bL: "L" }, { sp1: "R", rpL: "L", rpR: "R" }],
    });

    const decision = makeAiPitchingDecision(state, 1, { sp1: "SP", rpL: "RP", rpR: "RP" });
    expect(decision.kind).toBe("pitching_change");
    if (decision.kind === "pitching_change") {
      // vs L batter, L reliever has the better platoon suppression edge.
      expect(decision.pitcherIdx).toBe(1);
    }
  });
  it("aggressiveness=100 (bullpen-first): does NOT pull a fresh pitcher (0 pitches)", () => {
    alwaysPull();
    // Regression: at aggressiveness=100, highCount=75 which equals computeFatigueFactor's
    // fresh-zone ceiling (pitchesBeyond=0 → fatigueFactor=1.0).  Without the pitch-count
    // gate, a pitcher at 0 pitches has the same fatigueFactor (1.0) as the threshold,
    // and isHighFatigue would be true.  The gate `pitchCount >= highCount` prevents this.
    const state = makeState({
      pitcherPitchCount: [0, 0], // completely fresh starter
      pitcherBattersFaced: [0, 0],
      rosterPitchers: [[], ["sp1", "rp1"]],
      activePitcherIdx: [0, 0],
      substitutedOut: [[], []],
    });
    const decision = makeAiPitchingDecision(state, 1, { sp1: "SP", rp1: "RP" }, 100);
    expect(decision.kind).toBe("none");
  });

  it("aggressiveness=100 (bullpen-first): pulls pitcher at exactly the highCount boundary (75 pitches)", () => {
    alwaysPull();
    // At aggressiveness=100, highCount=75. A pitcher at exactly 75 pitches should
    // trigger the high-fatigue path (pitchCount >= highCount is true at the boundary).
    const state = makeState({
      pitcherPitchCount: [0, 75],
      pitcherBattersFaced: [0, 0],
      rosterPitchers: [[], ["sp1", "rp1"]],
      activePitcherIdx: [0, 0],
      substitutedOut: [[], []],
    });
    const decision = makeAiPitchingDecision(state, 1, { sp1: "SP", rp1: "RP" }, 100);
    expect(decision.kind).toBe("pitching_change");
  });

  it("aggressiveness=100 (bullpen-first): pulls pitcher at lower pitch count", () => {
    alwaysPull();
    // At aggressiveness=100, highCount = round(100 + (50-100)*0.5) = round(75) = 75
    // So 80 pitches should trigger a high-fatigue change.
    const state = makeState({
      pitcherPitchCount: [0, 80],
      pitcherBattersFaced: [0, 0],
      rosterPitchers: [[], ["sp1", "rp1"]],
      activePitcherIdx: [0, 0],
      substitutedOut: [[], []],
    });
    const decision = makeAiPitchingDecision(state, 1, { sp1: "SP", rp1: "RP" }, 100);
    expect(decision.kind).toBe("pitching_change");
  });

  it("aggressiveness=0 (old-school): does not pull at default high pitch count", () => {
    alwaysPull();
    // At aggressiveness=0, highCount = round(100 + 50*0.5) = 125
    // So AI_FATIGUE_THRESHOLD_HIGH (100) pitches should NOT trigger a change.
    const state = makeState({
      pitcherPitchCount: [0, AI_FATIGUE_THRESHOLD_HIGH],
      pitcherBattersFaced: [0, 0],
      rosterPitchers: [[], ["sp1", "rp1"]],
      activePitcherIdx: [0, 0],
      substitutedOut: [[], []],
    });
    const decision = makeAiPitchingDecision(state, 1, { sp1: "SP", rp1: "RP" }, 0);
    expect(decision.kind).toBe("none");
  });
});

describe("makeAiTacticalDecision", () => {
  it("steal: sends runner when successPct meets AI threshold (default 65)", () => {
    const state = makeState({ atBat: 0, score: [0, 0], inning: 5 });
    const result = makeAiTacticalDecision(state, {
      kind: "steal",
      base: 0,
      successPct: 70, // 70 > 65 → steal
    });
    expect(result.kind).toBe("tactical");
    if (result.kind === "tactical") {
      expect(result.actionType).toBe("steal_attempt");
      expect(result.reasonText).toContain("steal");
    }
  });

  it("steal: does NOT send runner when successPct is below threshold", () => {
    const state = makeState({ atBat: 0 });
    const result = makeAiTacticalDecision(state, {
      kind: "steal",
      base: 0,
      successPct: 60, // 60 < 65 → no steal
    });
    expect(result.kind).toBe("none");
  });

  it("steal: respects custom aiStealThreshold from decisionValues", () => {
    const state = makeState({ atBat: 0 });
    // threshold 75: successPct 70 < 75 → no steal
    const resultLow = makeAiTacticalDecision(
      state,
      { kind: "steal", base: 0, successPct: 70 },
      { ...DEFAULT_MANAGER_DECISION_VALUES, aiStealThreshold: 75 },
    );
    expect(resultLow.kind).toBe("none");
    // threshold 60: successPct 61 > 60 → steal (strict > matches detectDecision semantics)
    const resultHigh = makeAiTacticalDecision(
      state,
      { kind: "steal", base: 0, successPct: 61 },
      { ...DEFAULT_MANAGER_DECISION_VALUES, aiStealThreshold: 60 },
    );
    expect(resultHigh.kind).toBe("tactical");
  });

  it("bunt: sacrifices in close late game when behind", () => {
    // atBat=0 means away batting; scoreDiffForTeam = score[0]-score[1] = 1-2 = -1 (trailing)
    const result = makeAiTacticalDecision(
      makeState({ atBat: 0, score: [1, 2], inning: 8, outs: 0 }),
      { kind: "bunt" },
    );
    expect(result.kind).toBe("tactical");
    if (result.kind === "tactical") {
      expect(result.actionType).toBe("bunt_attempt");
    }
  });

  it("bunt: sacrifices in a tied late game", () => {
    // Tied game is the canonical sac-bunt situation — AI must bunt here.
    const result = makeAiTacticalDecision(
      makeState({ atBat: 0, score: [2, 2], inning: 8, outs: 0 }),
      { kind: "bunt" },
    );
    expect(result.kind).toBe("tactical");
    if (result.kind === "tactical") {
      expect(result.actionType).toBe("bunt_attempt");
    }
  });

  it("bunt: does not bunt when team is winning", () => {
    const state = makeState({ atBat: 0, score: [3, 1], inning: 8, outs: 0 });
    const result = makeAiTacticalDecision(state, { kind: "bunt" });
    expect(result.kind).toBe("none");
  });

  it("bunt: does not bunt when team is winning by exactly 1", () => {
    // Ahead by 1 should also NOT bunt — only tied or trailing
    const state = makeState({ atBat: 0, score: [3, 2], inning: 8, outs: 0 });
    const result = makeAiTacticalDecision(state, { kind: "bunt" });
    expect(result.kind).toBe("none");
  });

  it("count30: always takes the pitch", () => {
    const state = makeState({ atBat: 0 });
    const result = makeAiTacticalDecision(state, { kind: "count30" });
    expect(result.kind).toBe("tactical");
    if (result.kind === "tactical") {
      expect(result.actionType).toBe("set_one_pitch_modifier");
      expect(result.payload).toBe("take");
    }
  });

  it("count02: always protects the plate", () => {
    const state = makeState({ atBat: 0 });
    const result = makeAiTacticalDecision(state, { kind: "count02" });
    expect(result.kind).toBe("tactical");
    if (result.kind === "tactical") {
      expect(result.actionType).toBe("set_one_pitch_modifier");
      expect(result.payload).toBe("protect");
    }
  });

  it("ibb: always issues intentional walk", () => {
    const state = makeState({ atBat: 0 });
    const result = makeAiTacticalDecision(state, { kind: "ibb" });
    expect(result.kind).toBe("tactical");
    if (result.kind === "tactical") {
      expect(result.actionType).toBe("intentional_walk");
    }
  });

  it("defensive_shift: always enables shift", () => {
    const state = makeState({ atBat: 0 });
    const result = makeAiTacticalDecision(state, { kind: "defensive_shift" });
    expect(result.kind).toBe("tactical");
    if (result.kind === "tactical") {
      expect(result.actionType).toBe("set_defensive_shift");
      expect(result.payload).toBe(true);
    }
  });

  it("pinch_hitter: dispatches make_substitution when bench candidates are available", () => {
    const state = makeState({ atBat: 0, inning: 8 });
    const result = makeAiTacticalDecision(state, {
      kind: "pinch_hitter",
      candidates: [{ id: "b1", name: "Bench Player", contactMod: 0, powerMod: 0 }],
      teamIdx: 0,
      lineupIdx: 2,
    });
    expect(result.kind).toBe("tactical");
    if (result.kind === "tactical") {
      expect(result.actionType).toBe("make_substitution");
      const payload = result.payload as Record<string, unknown>;
      expect(payload.benchPlayerId).toBe("b1");
      expect(payload.lineupIdx).toBe(2);
      expect(result.reasonText).toContain("Bench Player");
    }
  });

  it("pinch_hitter: selects bench player with highest contact mod (stat-based selection)", () => {
    const state = makeState({ atBat: 0, inning: 8 });
    const result = makeAiTacticalDecision(state, {
      kind: "pinch_hitter",
      candidates: [
        { id: "b1", name: "Average Hitter", contactMod: 0, powerMod: 0 },
        { id: "b2", name: "Contact Hitter", contactMod: 10, powerMod: -5 },
        { id: "b3", name: "Power Hitter", contactMod: -5, powerMod: 20 },
      ],
      teamIdx: 0,
      lineupIdx: 2,
    });
    expect(result.kind).toBe("tactical");
    if (result.kind === "tactical") {
      const payload = result.payload as Record<string, unknown>;
      // b2 has the highest contactMod (10), so should be selected
      expect(payload.benchPlayerId).toBe("b2");
      expect(result.reasonText).toContain("Contact Hitter");
    }
  });

  it("pinch_hitter: prefers fatigue-adjusted best bat when effective mods are provided", () => {
    const state = makeState({ atBat: 0, inning: 8 });
    const result = makeAiTacticalDecision(state, {
      kind: "pinch_hitter",
      candidates: [
        {
          id: "b1",
          name: "Tired Contact Bat",
          contactMod: 10,
          powerMod: 0,
          effectiveContactMod: 2,
          effectivePowerMod: -1,
        },
        {
          id: "b2",
          name: "Fresh Bat",
          contactMod: 7,
          powerMod: 1,
          effectiveContactMod: 7,
          effectivePowerMod: 1,
        },
      ],
      teamIdx: 0,
      lineupIdx: 2,
    });
    expect(result.kind).toBe("tactical");
    if (result.kind === "tactical") {
      const payload = result.payload as Record<string, unknown>;
      expect(payload.benchPlayerId).toBe("b2");
      expect(result.reasonText).toContain("Fresh Bat");
    }
  });

  it("pinch_hitter: falls back to strategy when no bench candidates", () => {
    const state = makeState({ atBat: 0, inning: 8 });
    const result = makeAiTacticalDecision(state, {
      kind: "pinch_hitter",
      candidates: [],
      teamIdx: 0,
      lineupIdx: 0,
    });
    expect(result.kind).toBe("tactical");
    if (result.kind === "tactical") {
      expect(result.actionType).toBe("set_pinch_hitter_strategy");
      expect(result.payload).toBe("contact");
    }
  });
});

describe("makeAiStrategyDecision", () => {
  it("returns 'power' when down 2+ runs in inning 7+", () => {
    const state = makeState({ score: [3, 1], atBat: 1, inning: 8 }); // home batting, trailing 3-1
    expect(makeAiStrategyDecision(state, 1)).toBe("power");
  });

  it("returns 'aggressive' when down exactly 1 in inning 7+", () => {
    const state = makeState({ score: [2, 1], atBat: 1, inning: 7 });
    expect(makeAiStrategyDecision(state, 1)).toBe("aggressive");
  });

  it("returns 'balanced' when leading by 3+ (no longer 'patient' — breaks walk-farming loop)", () => {
    const state = makeState({ score: [0, 4], atBat: 1, inning: 3 });
    expect(makeAiStrategyDecision(state, 1)).toBe("balanced");
  });

  it("returns 'aggressive' with 2 outs in close late-game", () => {
    const state = makeState({ score: [2, 2], atBat: 0, inning: 8, outs: 2 });
    expect(makeAiStrategyDecision(state, 0)).toBe("aggressive");
  });

  it("returns 'contact' with runners in scoring position early", () => {
    const state = makeState({ score: [0, 0], atBat: 0, inning: 3, baseLayout: [0, 1, 0] });
    expect(makeAiStrategyDecision(state, 0)).toBe("contact");
  });

  it("returns 'balanced' by default", () => {
    const state = makeState({ score: [0, 0], atBat: 0, inning: 2 });
    expect(makeAiStrategyDecision(state, 0)).toBe("balanced");
  });
});
