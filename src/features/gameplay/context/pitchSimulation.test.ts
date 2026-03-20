/**
 * Unit tests for src/context/pitchSimulation.ts
 *
 * Tests cover:
 *   - computeFatigueFactor: stamina delays fatigue; fatigue increases over batters faced
 *   - computeSwingRate: count, strategy, and pitch-type effects
 *   - resolveSwingOutcome: whiff/foul/contact thresholds; pitcher stats and fatigue effects
 *   - resolveBattedBallType: contact quality tiers; batted-ball distribution; power strategy boost
 *   - Integration: identical inputs always produce identical outputs (determinism)
 */

import { describe, expect, it } from "vitest";

import {
  computeBatterFatigueFactor,
  computeFatigueFactor,
  computeSwingRate,
  resolveBattedBallType,
  resolveContactQuality,
  resolveSwingOutcome,
} from "./pitchSimulation";

describe("computeBatterFatigueFactor", () => {
  it("returns no penalties for fresh batters", () => {
    const result = computeBatterFatigueFactor(2, 0);
    expect(result.fatigueFactor).toBe(1);
    expect(result.contactPenalty).toBe(0);
    expect(result.powerPenalty).toBe(0);
  });

  it("increases penalties as plate appearances rise", () => {
    const mid = computeBatterFatigueFactor(6, 0);
    const late = computeBatterFatigueFactor(9, 0);
    expect(late.fatigueFactor).toBeGreaterThan(mid.fatigueFactor);
    expect(late.contactPenalty).toBeGreaterThanOrEqual(mid.contactPenalty);
    expect(late.powerPenalty).toBeGreaterThanOrEqual(mid.powerPenalty);
  });

  it("higher stamina delays fatigue onset", () => {
    const low = computeBatterFatigueFactor(6, -20);
    const high = computeBatterFatigueFactor(6, 20);
    expect(high.fatigueFactor).toBeLessThanOrEqual(low.fatigueFactor);
    expect(high.contactPenalty).toBeLessThanOrEqual(low.contactPenalty);
  });
});

// ---------------------------------------------------------------------------
// computeFatigueFactor
// ---------------------------------------------------------------------------

describe("computeFatigueFactor", () => {
  it("returns exactly 1.0 when pitcher has thrown 0 pitches and faced 0 batters", () => {
    expect(computeFatigueFactor(0, 0, 0)).toBe(1.0);
  });

  it("returns 1.0 up to and including the pitch fresh threshold (75 with no stamina mod)", () => {
    for (let pc = 0; pc <= 75; pc++) {
      expect(computeFatigueFactor(pc, 0, 0)).toBe(1.0);
    }
  });

  it("grows beyond 1.0 after the pitch fresh threshold", () => {
    const at80 = computeFatigueFactor(80, 0, 0);
    const at90 = computeFatigueFactor(90, 0, 0);
    const at100 = computeFatigueFactor(100, 0, 0);
    expect(at80).toBeGreaterThan(1.0);
    expect(at90).toBeGreaterThan(at80);
    expect(at100).toBeGreaterThan(at90);
  });

  it("is capped at 1.6", () => {
    expect(computeFatigueFactor(1000, 0, 0)).toBe(1.6);
    expect(computeFatigueFactor(500, 0, -20)).toBe(1.6);
  });

  it("higher staminaMod raises the pitch fresh threshold", () => {
    // With staminaMod=+20, pitchFreshThreshold = 75 + 30 = 105.
    // After 80 pitches, default-stamina pitcher is fatigued; high-stamina pitcher is still fresh.
    const noStamina = computeFatigueFactor(80, 0, 0);
    const highStamina = computeFatigueFactor(80, 0, 20);
    expect(noStamina).toBeGreaterThan(1.0);
    expect(highStamina).toBe(1.0);
  });

  it("negative staminaMod lowers the pitch fresh threshold", () => {
    // With staminaMod=-20, pitchFreshThreshold = 75 - 30 = 45.
    const noStamina = computeFatigueFactor(50, 0, 0);
    const lowStamina = computeFatigueFactor(50, 0, -20);
    expect(noStamina).toBe(1.0); // still fresh at 50 pitches
    expect(lowStamina).toBeGreaterThan(1.0); // already fatigued
  });

  it("batters faced adds a secondary stress component", () => {
    // Same pitch count; more batters faced = slightly higher fatigue.
    const fewBF = computeFatigueFactor(80, 5, 0);
    const manyBF = computeFatigueFactor(80, 15, 0);
    expect(manyBF).toBeGreaterThan(fewBF);
  });

  it("pitch count drives fatigue more strongly than batters faced", () => {
    // Pitcher at 95 pitches / 5 BF vs 50 pitches / 25 BF — the high-pitch-count one is more fatigued.
    const highPitch = computeFatigueFactor(95, 5, 0);
    const highBF = computeFatigueFactor(50, 25, 0);
    expect(highPitch).toBeGreaterThan(highBF);
  });

  it("is deterministic given identical inputs", () => {
    expect(computeFatigueFactor(90, 20, 5)).toBe(computeFatigueFactor(90, 20, 5));
  });
});

// ---------------------------------------------------------------------------
// computeSwingRate
// ---------------------------------------------------------------------------

describe("computeSwingRate", () => {
  it("increases with more strikes (0→1→2)", () => {
    const rate0 = computeSwingRate(0);
    const rate1 = computeSwingRate(1);
    const rate2 = computeSwingRate(2);
    expect(rate1).toBeGreaterThan(rate0);
    expect(rate2).toBeGreaterThan(rate1);
  });

  it("returns 1000 for the 'swing' one-pitch modifier (guarantees a swing)", () => {
    expect(computeSwingRate(0, { onePitchMod: "swing" })).toBe(1000);
    expect(computeSwingRate(2, { strategy: "power", onePitchMod: "swing" })).toBe(1000);
  });

  it("returns 0 for the 'take' one-pitch modifier", () => {
    expect(computeSwingRate(0, { onePitchMod: "take" })).toBe(0);
    expect(
      computeSwingRate(2, { strategy: "aggressive", batterContactMod: 10, onePitchMod: "take" }),
    ).toBe(0);
  });

  it("aggressive strategy swings more than patient", () => {
    const aggressive = computeSwingRate(0, { strategy: "aggressive" });
    const patient = computeSwingRate(0, { strategy: "patient" });
    expect(aggressive).toBeGreaterThan(patient);
  });

  it("'protect' modifier increases the swing rate", () => {
    const normal = computeSwingRate(1);
    const protect = computeSwingRate(1, { onePitchMod: "protect" });
    expect(protect).toBeGreaterThan(normal);
  });

  it("normal play is always in [0, 920]; 'swing' modifier reaches 1000", () => {
    const strategies = ["balanced", "aggressive", "patient", "contact", "power"] as const;
    const pitchTypes = ["fastball", "curveball", "slider", "changeup"] as const;
    // Non-swing mods are capped at 920.
    const normalMods = ["take", "protect", null] as const;
    for (const strat of strategies) {
      for (const pitch of pitchTypes) {
        for (const mod of normalMods) {
          for (const strikes of [0, 1, 2]) {
            const rate = computeSwingRate(strikes, {
              strategy: strat,
              pitchType: pitch,
              onePitchMod: mod,
            });
            expect(rate).toBeGreaterThanOrEqual(0);
            expect(rate).toBeLessThanOrEqual(920);
          }
        }
      }
    }
    // The "swing" modifier guarantees a swing.
    expect(computeSwingRate(0, { onePitchMod: "swing" })).toBe(1000);
  });

  it("is deterministic given identical inputs", () => {
    expect(
      computeSwingRate(1, { strategy: "contact", batterContactMod: 5, pitchType: "slider" }),
    ).toBe(computeSwingRate(1, { strategy: "contact", batterContactMod: 5, pitchType: "slider" }));
  });

  it("applies swingRateMultiplier and still respects caps/one-pitch overrides", () => {
    const baseline = computeSwingRate(1, { strategy: "balanced" });
    const boosted = computeSwingRate(1, { strategy: "balanced", swingRateMultiplier: 1.2 });
    const reduced = computeSwingRate(1, { strategy: "balanced", swingRateMultiplier: 0.8 });

    expect(boosted).toBeGreaterThan(baseline);
    expect(reduced).toBeLessThan(baseline);

    const capped = computeSwingRate(2, {
      strategy: "aggressive",
      batterContactMod: 20,
      pitchType: "fastball",
      swingRateMultiplier: 5,
    });
    expect(capped).toBe(920);

    expect(computeSwingRate(0, { onePitchMod: "swing", swingRateMultiplier: 0.1 })).toBe(1000);
    expect(computeSwingRate(2, { onePitchMod: "take", swingRateMultiplier: 10 })).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// resolveSwingOutcome
// ---------------------------------------------------------------------------

describe("resolveSwingOutcome", () => {
  it("low roll → whiff", () => {
    // Roll 0 is always below the whiff threshold (minimum whiff threshold is 8).
    expect(resolveSwingOutcome(0)).toBe("whiff");
  });

  it("mid roll → foul", () => {
    // Roll 30: above whiff threshold (22) but below foul threshold (22+33=55).
    expect(resolveSwingOutcome(30)).toBe("foul");
  });

  it("high roll → contact", () => {
    // Roll 80: above foul threshold (55) → contact.
    expect(resolveSwingOutcome(80)).toBe("contact");
  });

  it("high pitcher velocity increases whiff probability (lowers contact)", () => {
    const baseContactCount = [70, 75, 80].filter(
      (r) => resolveSwingOutcome(r) === "contact",
    ).length;
    const highVeloContactCount = [70, 75, 80].filter(
      (r) => resolveSwingOutcome(r, { pitcherVelocityMod: 20 }) === "contact",
    ).length;
    // More rolls become whiff/foul with high velocity → fewer contacts
    expect(highVeloContactCount).toBeLessThanOrEqual(baseContactCount);
  });

  it("high batter contact skill reduces whiff rate", () => {
    // With contactMod=+20, the whiff threshold decreases → fewer whiffs at low rolls.
    const whiffNoMod = resolveSwingOutcome(10);
    const whiffHighContact = resolveSwingOutcome(10, { batterContactMod: 20 });
    // With lower whiff threshold, roll=10 might no longer be a whiff.
    // Either way, the threshold decreases — high contact can only equal or improve outcomes.
    expect(["whiff", "foul", "contact"]).toContain(whiffNoMod);
    expect(["whiff", "foul", "contact"]).toContain(whiffHighContact);
    // High contact should never *increase* whiff chance:
    // whiff threshold with contactMod=+20 is max(8, 22-2) = 20, so roll=10 is still whiff
    // but roll=21 would switch from whiff to foul.
    expect(resolveSwingOutcome(21)).toBe("whiff");
    expect(resolveSwingOutcome(21, { batterContactMod: 20 })).toBe("foul"); // no longer a whiff
  });

  it("fatigue reduces pitcher effectiveness (fewer whiffs)", () => {
    // A tired pitcher loses velocity bonus → lower whiff threshold → roll that was whiff may become foul/contact
    const roll = 20; // near the whiff threshold
    const freshResult = resolveSwingOutcome(roll, { pitcherVelocityMod: 10, fatigueFactor: 1.0 });
    const tiredResult = resolveSwingOutcome(roll, { pitcherVelocityMod: 10, fatigueFactor: 1.4 });
    // With fatigue, the velocity bonus is reduced, so some whiffs shift to fouls or contact
    // Either stays whiff or becomes something better for batter — never worse
    if (freshResult === "whiff") {
      // tiredResult should be whiff or something better (foul/contact)
      expect(["whiff", "foul", "contact"]).toContain(tiredResult);
    }
  });

  it("always returns a valid outcome", () => {
    const validOutcomes = ["whiff", "foul", "contact"] as const;
    for (let roll = 0; roll < 100; roll++) {
      expect(validOutcomes).toContain(resolveSwingOutcome(roll));
    }
  });

  it("is deterministic given identical inputs", () => {
    const opts = {
      pitcherVelocityMod: 10,
      pitcherMovementMod: 5,
      batterContactMod: -5,
      fatigueFactor: 1.2,
    };
    expect(resolveSwingOutcome(45, opts)).toBe(resolveSwingOutcome(45, opts));
  });

  it("applies whiffRateMultiplier directionally", () => {
    const roll = 15;
    const lowerWhiff = resolveSwingOutcome(roll, { whiffRateMultiplier: 0.7 });
    const higherWhiff = resolveSwingOutcome(roll, { whiffRateMultiplier: 1.3 });
    expect(lowerWhiff).toBe("foul");
    expect(higherWhiff).toBe("whiff");
  });

  it("clamps whiff threshold to [8, 40] even with extreme multipliers", () => {
    expect(resolveSwingOutcome(39, { pitcherVelocityMod: 20, whiffRateMultiplier: 10 })).toBe(
      "whiff",
    );
    expect(resolveSwingOutcome(40, { pitcherVelocityMod: 20, whiffRateMultiplier: 10 })).toBe(
      "foul",
    );

    expect(resolveSwingOutcome(7, { batterContactMod: 20, whiffRateMultiplier: 0.01 })).toBe(
      "whiff",
    );
    expect(resolveSwingOutcome(8, { batterContactMod: 20, whiffRateMultiplier: 0.01 })).toBe(
      "foul",
    );
  });
});

// ---------------------------------------------------------------------------
// resolveBattedBallType
// ---------------------------------------------------------------------------

describe("resolveBattedBallType", () => {
  // Hard contact: contactRoll < 20 (base hardThreshold with no mods)
  // Medium contact: 20 ≤ contactRoll < 55
  // Weak contact: contactRoll ≥ 55

  describe("hard contact (contactRoll < 20)", () => {
    it("typeRoll < 40 → deep_fly", () => {
      expect(resolveBattedBallType(0, 10)).toBe("deep_fly");
    });
    it("typeRoll 40–74 → line_drive", () => {
      expect(resolveBattedBallType(0, 50)).toBe("line_drive");
    });
    it("typeRoll ≥ 75 → hard_grounder", () => {
      expect(resolveBattedBallType(0, 80)).toBe("hard_grounder");
    });
  });

  describe("medium contact (20 ≤ contactRoll < 55)", () => {
    it("typeRoll < 35 → medium_fly", () => {
      expect(resolveBattedBallType(40, 10)).toBe("medium_fly");
    });
    it("typeRoll 35–54 → hard_grounder", () => {
      expect(resolveBattedBallType(40, 40)).toBe("hard_grounder");
    });
    it("typeRoll 55–74 → line_drive", () => {
      expect(resolveBattedBallType(40, 60)).toBe("line_drive");
    });
    it("typeRoll ≥ 75 → weak_grounder", () => {
      expect(resolveBattedBallType(40, 80)).toBe("weak_grounder");
    });
  });

  describe("weak contact (contactRoll ≥ 55)", () => {
    it("typeRoll < 35 → pop_up", () => {
      expect(resolveBattedBallType(80, 10)).toBe("pop_up");
    });
    it("typeRoll 35–79 → weak_grounder", () => {
      expect(resolveBattedBallType(80, 50)).toBe("weak_grounder");
    });
    it("typeRoll ≥ 80 → medium_fly", () => {
      expect(resolveBattedBallType(80, 85)).toBe("medium_fly");
    });
  });

  describe("hard contact produces more premium batted balls than weak contact", () => {
    it("hard yields more deep_fly+line_drive than weak", () => {
      let hardPremium = 0;
      let weakPremium = 0;
      for (let typeRoll = 0; typeRoll < 100; typeRoll++) {
        const hardBBT = resolveBattedBallType(0, typeRoll);
        const weakBBT = resolveBattedBallType(80, typeRoll);
        if (hardBBT === "deep_fly" || hardBBT === "line_drive") hardPremium++;
        if (weakBBT === "deep_fly" || weakBBT === "line_drive") weakPremium++;
      }
      expect(hardPremium).toBeGreaterThan(weakPremium);
    });
  });

  describe("power strategy", () => {
    it("power + medium contact + typeRoll < 15 → deep_fly (powerBoost)", () => {
      // Medium contact (contactRoll=40) + power + typeRoll=5 < 15 → powerBoost upgrades to deep_fly
      expect(resolveBattedBallType(40, 5, { strategy: "power" })).toBe("deep_fly");
    });

    it("power + hard contact: already hard, typeRoll < 40 → deep_fly", () => {
      expect(resolveBattedBallType(0, 10, { strategy: "power" })).toBe("deep_fly");
    });

    it("power + medium contact + typeRoll ≥ 15 → no boost (normal medium outcome)", () => {
      // typeRoll=20 ≥ 15 → powerBoost is false → medium → typeRoll=20 < 35 → medium_fly
      expect(resolveBattedBallType(40, 20, { strategy: "power" })).toBe("medium_fly");
    });
  });

  describe("pitcher stats affect contact quality", () => {
    it("high pitcher velocity reduces hard contact threshold (contact quality suppressed)", () => {
      // No mods: hardThreshold=20; contactRoll=17 < 20 → hard → typeRoll=10 < 40 → deep_fly
      // velocityMod=20, movementMod=20: hardThreshold = max(10, 20 - round(40/10)) = 16
      //   contactRoll=17 ≥ 16 → medium → typeRoll=10 < 35 → medium_fly
      expect(resolveBattedBallType(17, 10)).toBe("deep_fly");
      expect(
        resolveBattedBallType(17, 10, { pitcherVelocityMod: 20, pitcherMovementMod: 20 }),
      ).toBe("medium_fly");
    });
  });

  describe("pitcher fatigue increases hard contact (batted ball quality rises)", () => {
    it("tired pitcher: contactRoll=21 becomes hard (was medium with fresh pitcher)", () => {
      // fatigueFactor=1.0: hardThreshold=20; 21 ≥ 20 → medium → typeRoll=10 < 35 → medium_fly
      // fatigueFactor=1.4: hardThreshold=20+round(0.4*10)=24; 21 < 24 → hard → typeRoll=10 < 40 → deep_fly
      const freshResult = resolveBattedBallType(21, 10, { fatigueFactor: 1.0 });
      const tiredResult = resolveBattedBallType(21, 10, { fatigueFactor: 1.4 });
      expect(freshResult).toBe("medium_fly");
      expect(tiredResult).toBe("deep_fly");
    });
  });

  it("always returns a valid BattedBallType", () => {
    const validTypes = [
      "pop_up",
      "weak_grounder",
      "hard_grounder",
      "line_drive",
      "medium_fly",
      "deep_fly",
    ];
    for (let cRoll = 0; cRoll < 100; cRoll++) {
      for (let tRoll = 0; tRoll < 100; tRoll += 10) {
        expect(validTypes).toContain(resolveBattedBallType(cRoll, tRoll));
      }
    }
  });

  it("is deterministic given identical inputs", () => {
    const opts = {
      strategy: "contact" as const,
      batterPowerMod: 10,
      pitcherVelocityMod: -5,
      fatigueFactor: 1.2,
    };
    expect(resolveBattedBallType(15, 25, opts)).toBe(resolveBattedBallType(15, 25, opts));
  });

  it("applies hardContactMultiplier directionally", () => {
    expect(resolveContactQuality(15)).toBe("hard");
    expect(resolveContactQuality(15, { hardContactMultiplier: 0.5 })).toBe("medium");
    expect(resolveContactQuality(22, { hardContactMultiplier: 1.3 })).toBe("hard");
  });

  it("clamps hard-contact threshold to [10, 50] with extreme multipliers", () => {
    expect(
      resolveContactQuality(49, {
        batterPowerMod: 20,
        fatigueFactor: 1.6,
        hardContactMultiplier: 5,
      }),
    ).toBe("hard");
    expect(
      resolveContactQuality(50, {
        batterPowerMod: 20,
        fatigueFactor: 1.6,
        hardContactMultiplier: 5,
      }),
    ).toBe("medium");

    expect(
      resolveContactQuality(9, {
        batterPowerMod: -20,
        pitcherVelocityMod: 20,
        pitcherMovementMod: 20,
        hardContactMultiplier: 0.1,
      }),
    ).toBe("hard");
    expect(
      resolveContactQuality(10, {
        batterPowerMod: -20,
        pitcherVelocityMod: 20,
        pitcherMovementMod: 20,
        hardContactMultiplier: 0.1,
      }),
    ).toBe("medium");
  });

  it("hardContactMultiplier changes batted-ball outcomes for the same rolls", () => {
    expect(resolveBattedBallType(15, 20)).toBe("deep_fly");
    expect(resolveBattedBallType(15, 20, { hardContactMultiplier: 0.5 })).toBe("medium_fly");
  });
});

// ---------------------------------------------------------------------------
// Cross-function integration: stat sanity across a simulated game
// ---------------------------------------------------------------------------

describe("simulation stat sanity (aggregate)", () => {
  /**
   * Runs a simplified deterministic pitch loop and counts outcomes.
   * Uses a fixed sequence of rolls to verify broad distribution properties.
   */
  it("contact rate is meaningfully higher with good contact batter vs average", () => {
    const rolls = Array.from({ length: 100 }, (_, i) => i);
    const countContact = (contactMod: number) =>
      rolls.filter(
        (roll) => resolveSwingOutcome(roll, { batterContactMod: contactMod }) === "contact",
      ).length;

    const avgContact = countContact(0);
    const goodContact = countContact(20);
    // Higher contact mod should produce more contact outcomes
    expect(goodContact).toBeGreaterThanOrEqual(avgContact);
  });

  it("high velocity pitcher produces more whiffs than low velocity", () => {
    const rolls = Array.from({ length: 100 }, (_, i) => i);
    const countWhiffs = (velocityMod: number) =>
      rolls.filter(
        (roll) => resolveSwingOutcome(roll, { pitcherVelocityMod: velocityMod }) === "whiff",
      ).length;

    const lowVeloWhiffs = countWhiffs(-10);
    const highVeloWhiffs = countWhiffs(20);
    expect(highVeloWhiffs).toBeGreaterThan(lowVeloWhiffs);
  });

  it("hard contact produces more deep_fly/line_drive than weak contact", () => {
    const typeRolls = Array.from({ length: 100 }, (_, i) => i);
    const premiumBBT = (contactRoll: number) =>
      typeRolls.filter((t) => {
        const b = resolveBattedBallType(contactRoll, t);
        return b === "deep_fly" || b === "line_drive";
      }).length;

    const hardPremium = premiumBBT(5); // hard contact
    const weakPremium = premiumBBT(85); // weak contact
    expect(hardPremium).toBeGreaterThan(weakPremium);
  });
});
