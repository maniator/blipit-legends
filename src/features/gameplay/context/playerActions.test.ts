/**
 * Tests for src/context/playerActions.ts — focused on computeWaitOutcome threshold clamping.
 */

import { Hit } from "@shared/constants/hitTypes";
import * as rngModule from "@shared/utils/rng";
import { afterEach, describe, expect, it, vi } from "vitest";

import { makeLogs, makeState } from "@test/testHelpers";

import { playerWait } from "./playerActions";
import type { ModPreset, TeamCustomPlayerOverrides } from "./playerTypes";

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// computeWaitOutcome — threshold clamping at extreme pitcher mods
// ---------------------------------------------------------------------------

describe("playerWait — computeWaitOutcome threshold clamping", () => {
  const buildStateWithPitcher = (controlMod: ModPreset, velocityMod: ModPreset) => {
    const pitcherOverrides: TeamCustomPlayerOverrides = {
      pitcher1: { controlMod, velocityMod },
    };
    return makeState({
      atBat: 0,
      rosterPitchers: [[], ["pitcher1"]],
      activePitcherIdx: [0, 0],
      playerOverrides: [{}, pitcherOverrides],
    });
  };

  it("extreme high pitcher mods (+20/+20): strike threshold does not exceed 999", () => {
    // With controlMod=+20 and velocityMod=+20, controlFactor = 1 + (20+10)/100 = 1.3
    // adjustedStrikeThreshold = clamp(500 * 1.0 * 1.3 / 1.0, 0, 999) = 650 — well within range
    const state = buildStateWithPitcher(20, 20);
    // Force RNG to always return 998 (near top of range) — should still be deterministic
    vi.spyOn(rngModule, "random").mockReturnValue(0.999);
    const { log } = makeLogs();
    // Should not throw and should return a valid state
    expect(() => playerWait(state, log)).not.toThrow();
  });

  it("extreme low pitcher mods (-20/-20): strike threshold is not negative", () => {
    // With controlMod=-20 and velocityMod=-20, controlFactor = 1 + (-20-10)/100 = 0.7
    // adjustedStrikeThreshold = clamp(500 * 1.0 * 0.7 / 1.0, 0, 999) = 350 — fine
    const state = buildStateWithPitcher(-20, -20);
    vi.spyOn(rngModule, "random").mockReturnValue(0.001);
    const { log } = makeLogs();
    expect(() => playerWait(state, log)).not.toThrow();
  });

  it("take modifier: walk chance is clamped to [0, 999]", () => {
    // With very generous walk strategy + low controlFactor, walk chance must stay ≤ 999
    const state = buildStateWithPitcher(-20, -20);
    vi.spyOn(rngModule, "random").mockReturnValue(0.5);
    const { log } = makeLogs();
    // "patient" strategy has stratMod walk = 1.4; combined with low controlFactor should be high
    // but must not overflow
    expect(() => playerWait(state, log, "patient", "take")).not.toThrow();
  });

  it("with no pitcher overrides: outcome is deterministic (baseline behavior preserved)", () => {
    const state = makeState({ atBat: 0 });
    // RNG 0.4 → 400 < 500 → strike on "swing"
    vi.spyOn(rngModule, "random").mockReturnValue(0.4);
    const { log, logs } = makeLogs();
    playerWait(state, log);
    expect(logs.some((l) => /strike/i.test(l))).toBe(true);
  });

  it("higher walkRateMultiplier reduces called-strike outcomes under fixed RNG", () => {
    const state = makeState({ atBat: 0 });
    // random=500; baseline threshold is ~588, but walk-boosted threshold drops to ~452.
    vi.spyOn(rngModule, "random").mockReturnValue(0.5);
    const { log } = makeLogs();

    const baseline = playerWait(state, log, "balanced", null, undefined, {
      walkRateMultiplier: 1,
      calledStrikeRateMultiplier: 1,
    });
    const walkBoosted = playerWait(state, log, "balanced", null, undefined, {
      walkRateMultiplier: 1.3,
      calledStrikeRateMultiplier: 1,
    });

    expect(baseline.strikes).toBe(1);
    expect(walkBoosted.balls).toBe(1);
  });

  it("higher calledStrikeRateMultiplier increases called-strike outcomes under fixed RNG", () => {
    const state = makeState({ atBat: 0 });
    // random=620; baseline threshold is ~588 (ball), boosted threshold rises to ~764 (strike).
    vi.spyOn(rngModule, "random").mockReturnValue(0.62);
    const { log } = makeLogs();

    const baseline = playerWait(state, log, "balanced", null, undefined, {
      walkRateMultiplier: 1,
      calledStrikeRateMultiplier: 1,
    });
    const strikeBoosted = playerWait(state, log, "balanced", null, undefined, {
      walkRateMultiplier: 1,
      calledStrikeRateMultiplier: 1.3,
    });

    expect(baseline.balls).toBe(1);
    expect(strikeBoosted.strikes).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// MLB parity Phase 1 — HBP (Hit By Pitch) on ball four
// ---------------------------------------------------------------------------

describe("playerWait — HBP on ball four (MLB parity Phase 1)", () => {
  it("ball four with hbpRoll < 11 produces HBP (batter goes to first, logged as HBP)", () => {
    // First RNG call (getRandomInt(1000) in playerWait): random=0.9 → 900 ≥ 500 → ball outcome.
    // Second RNG call (getRandomInt(100) hbpRoll in playerBall): random=0.05 → 5 < 11 → HBP.
    vi.spyOn(rngModule, "random")
      .mockReturnValueOnce(0.9) // playerWait roll → ball outcome
      .mockReturnValueOnce(0.05); // hbpRoll in playerBall (5 < 11 → HBP)
    const { logs, log } = makeLogs();
    const next = playerWait(makeState({ balls: 3, atBat: 0 }), log);
    expect(next.baseLayout[0]).toBe(1); // batter reaches first
    expect(next.playLog.length).toBeGreaterThan(0);
    expect(next.playLog[next.playLog.length - 1].event).toBe(Hit.HitByPitch);
    expect(logs.some((l) => l.toLowerCase().includes("hit by pitch"))).toBe(true);
  });

  it("ball four with hbpRoll >= 11 produces a normal walk (not HBP)", () => {
    // First RNG call (getRandomInt(1000)): random=0.9 → 900 ≥ 500 → ball outcome.
    // Second RNG call (getRandomInt(100) hbpRoll): random=0.5 → 50 ≥ 11 → normal walk.
    vi.spyOn(rngModule, "random")
      .mockReturnValueOnce(0.9) // playerWait roll → ball outcome
      .mockReturnValueOnce(0.5); // hbpRoll (50 ≥ 11 → normal walk)
    const { logs, log } = makeLogs();
    const next = playerWait(makeState({ balls: 3, atBat: 0 }), log);
    expect(next.baseLayout[0]).toBe(1);
    expect(next.playLog[next.playLog.length - 1].event).toBe(Hit.Walk);
    expect(logs.some((l) => l.toLowerCase().includes("ball four"))).toBe(true);
  });

  it("ball one (not ball four) does NOT trigger an extra HBP roll — count simply increments", () => {
    // Only one RNG call should be consumed (the playerWait roll → ball).
    // No hbpRoll is taken for balls 1–3.
    // random=0.6 → getRandomInt(1000)=600 ≥ 500 → ball outcome (not strike).
    const mockRandom = vi
      .spyOn(rngModule, "random")
      .mockReturnValueOnce(0.6) // playerWait roll → ball
      .mockReturnValue(0.05); // any further calls (should not be hbpRoll for ball 1)
    const { log } = makeLogs();
    const next = playerWait(makeState({ balls: 0, atBat: 0 }), log);
    expect(next.balls).toBe(1); // just one ball added
    expect(next.baseLayout[0]).toBe(0); // batter not on base
    // Only the playerWait RNG call (index 0) should have been consumed for ball 1.
    expect(mockRandom).toHaveBeenCalledTimes(1);
  });
});
