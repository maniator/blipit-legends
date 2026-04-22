import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_MANAGER_DECISION_VALUES,
  getDefaultDecisionValues,
  sanitizeManagerDecisionValues,
} from "./managerDecisionValues";

describe("sanitizeManagerDecisionValues", () => {
  it("returns defaults when given an empty object", () => {
    const result = sanitizeManagerDecisionValues({});
    expect(result).toEqual(DEFAULT_MANAGER_DECISION_VALUES);
  });

  it("clamps stealMinOfferPct to [65, 85]", () => {
    expect(sanitizeManagerDecisionValues({ stealMinOfferPct: 10 }).stealMinOfferPct).toBe(65);
    expect(sanitizeManagerDecisionValues({ stealMinOfferPct: 999 }).stealMinOfferPct).toBe(85);
    expect(sanitizeManagerDecisionValues({ stealMinOfferPct: 72 }).stealMinOfferPct).toBe(72);
  });

  it("clamps aiStealThreshold to [65, stealMinOfferPct]", () => {
    expect(
      sanitizeManagerDecisionValues({ stealMinOfferPct: 70, aiStealThreshold: 40 })
        .aiStealThreshold,
    ).toBe(65);
    // aiStealThreshold can't exceed stealMinOfferPct
    expect(
      sanitizeManagerDecisionValues({ stealMinOfferPct: 65, aiStealThreshold: 80 })
        .aiStealThreshold,
    ).toBe(65);
    expect(
      sanitizeManagerDecisionValues({ stealMinOfferPct: 75, aiStealThreshold: 70 })
        .aiStealThreshold,
    ).toBe(70);
  });

  it("clamps aiPitchingChangeAggressiveness to [0, 100]", () => {
    expect(
      sanitizeManagerDecisionValues({ aiPitchingChangeAggressiveness: -5 })
        .aiPitchingChangeAggressiveness,
    ).toBe(0);
    expect(
      sanitizeManagerDecisionValues({ aiPitchingChangeAggressiveness: 150 })
        .aiPitchingChangeAggressiveness,
    ).toBe(100);
    expect(
      sanitizeManagerDecisionValues({ aiPitchingChangeAggressiveness: 75 })
        .aiPitchingChangeAggressiveness,
    ).toBe(75);
  });

  it("rounds fractional values to integers", () => {
    expect(sanitizeManagerDecisionValues({ stealMinOfferPct: 72.7 }).stealMinOfferPct).toBe(73);
    expect(
      sanitizeManagerDecisionValues({ aiPitchingChangeAggressiveness: 49.4 })
        .aiPitchingChangeAggressiveness,
    ).toBe(49);
  });

  it("coerces non-boolean booleans to defaults", () => {
    // @ts-expect-error testing runtime resilience
    const result = sanitizeManagerDecisionValues({ buntEnabled: "yes" });
    expect(result.buntEnabled).toBe(DEFAULT_MANAGER_DECISION_VALUES.buntEnabled);
  });

  it("falls back to defaults when numeric fields are NaN or Infinity", () => {
    // NaN passes typeof === "number" but must not leak into threshold comparisons
    // (pct > NaN is always false, which silently disables steal detection)
    const result = sanitizeManagerDecisionValues({
      stealMinOfferPct: NaN,
      aiStealThreshold: Infinity,
      aiPitchingChangeAggressiveness: -Infinity,
    });
    expect(result.stealMinOfferPct).toBe(DEFAULT_MANAGER_DECISION_VALUES.stealMinOfferPct);
    expect(result.aiStealThreshold).toBe(DEFAULT_MANAGER_DECISION_VALUES.aiStealThreshold);
    expect(result.aiPitchingChangeAggressiveness).toBe(
      DEFAULT_MANAGER_DECISION_VALUES.aiPitchingChangeAggressiveness,
    );
  });

  it("accepts valid boolean false for toggles", () => {
    const result = sanitizeManagerDecisionValues({
      stealEnabled: false,
      buntEnabled: false,
      ibbEnabled: false,
      pinchHitterEnabled: false,
      defensiveShiftEnabled: false,
    });
    expect(result.stealEnabled).toBe(false);
    expect(result.buntEnabled).toBe(false);
    expect(result.ibbEnabled).toBe(false);
    expect(result.pinchHitterEnabled).toBe(false);
    expect(result.defensiveShiftEnabled).toBe(false);
  });

  it("preserves all valid fields from a complete object", () => {
    const input = {
      stealMinOfferPct: 73,
      aiStealThreshold: 67,
      stealEnabled: true,
      buntEnabled: true,
      ibbEnabled: false,
      pinchHitterEnabled: true,
      defensiveShiftEnabled: true,
      aiPitchingChangeAggressiveness: 75,
    };
    const result = sanitizeManagerDecisionValues(input);
    expect(result).toEqual(input);
  });

  it("coerces non-boolean stealEnabled to default (true)", () => {
    // @ts-expect-error testing runtime resilience
    const result = sanitizeManagerDecisionValues({ stealEnabled: "no" });
    expect(result.stealEnabled).toBe(DEFAULT_MANAGER_DECISION_VALUES.stealEnabled);
  });
});

describe("DEFAULT_MANAGER_DECISION_VALUES", () => {
  it("has aiStealThreshold <= stealMinOfferPct", () => {
    expect(DEFAULT_MANAGER_DECISION_VALUES.aiStealThreshold).toBeLessThanOrEqual(
      DEFAULT_MANAGER_DECISION_VALUES.stealMinOfferPct,
    );
  });

  it("has stealEnabled = true (steals are allowed by default)", () => {
    expect(DEFAULT_MANAGER_DECISION_VALUES.stealEnabled).toBe(true);
  });

  it("has defensiveShiftEnabled = false (2023 MLB shift ban default)", () => {
    expect(DEFAULT_MANAGER_DECISION_VALUES.defensiveShiftEnabled).toBe(false);
  });

  it("has aiPitchingChangeAggressiveness = 50 (modern MLB average default)", () => {
    expect(DEFAULT_MANAGER_DECISION_VALUES.aiPitchingChangeAggressiveness).toBe(50);
  });
});

describe("getDefaultDecisionValues — A/B experiment flag", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it("returns DEFAULT_MANAGER_DECISION_VALUES (Variant A) when no flag is set", () => {
    // Module is already loaded; _abVariant was read at load time with empty
    // localStorage (no flag). Values should match Variant A.
    const defaults = getDefaultDecisionValues();
    expect(defaults).toEqual(DEFAULT_MANAGER_DECISION_VALUES);
  });

  it("DEFAULT_MANAGER_DECISION_VALUES has buntEnabled = true (Variant A baseline)", () => {
    expect(DEFAULT_MANAGER_DECISION_VALUES.buntEnabled).toBe(true);
  });

  it("DEFAULT_MANAGER_DECISION_VALUES has aiStealThreshold = 67 (Variant A baseline)", () => {
    expect(DEFAULT_MANAGER_DECISION_VALUES.aiStealThreshold).toBe(67);
  });

  it("DEFAULT_MANAGER_DECISION_VALUES has aiPitchingChangeAggressiveness = 50 (Variant A baseline)", () => {
    expect(DEFAULT_MANAGER_DECISION_VALUES.aiPitchingChangeAggressiveness).toBe(50);
  });

  it("Variant B values differ from Variant A on the three changed fields", async () => {
    // Simulate module re-load with Variant B flag set by reimporting with the
    // flag already in localStorage. vi.resetModules() allows a fresh import.
    localStorage.setItem("__blip_ab_decision_variant", "b");
    vi.resetModules();

    const { getDefaultDecisionValues: getDefaultB } = await import("./managerDecisionValues");
    const variantB = getDefaultB();

    // The three Variant B fields differ from the Variant A const.
    expect(variantB.aiStealThreshold).toBe(70);
    expect(variantB.aiPitchingChangeAggressiveness).toBe(60);
    expect(variantB.buntEnabled).toBe(false);

    // All other fields match Variant A.
    expect(variantB.stealMinOfferPct).toBe(DEFAULT_MANAGER_DECISION_VALUES.stealMinOfferPct);
    expect(variantB.stealEnabled).toBe(DEFAULT_MANAGER_DECISION_VALUES.stealEnabled);
    expect(variantB.ibbEnabled).toBe(DEFAULT_MANAGER_DECISION_VALUES.ibbEnabled);
    expect(variantB.pinchHitterEnabled).toBe(DEFAULT_MANAGER_DECISION_VALUES.pinchHitterEnabled);
    expect(variantB.defensiveShiftEnabled).toBe(
      DEFAULT_MANAGER_DECISION_VALUES.defensiveShiftEnabled,
    );
  });
});

describe("sanitizeManagerDecisionValues", () => {
  it("returns defaults when given an empty object", () => {
    const result = sanitizeManagerDecisionValues({});
    expect(result).toEqual(DEFAULT_MANAGER_DECISION_VALUES);
  });

  it("clamps stealMinOfferPct to [65, 85]", () => {
    expect(sanitizeManagerDecisionValues({ stealMinOfferPct: 10 }).stealMinOfferPct).toBe(65);
    expect(sanitizeManagerDecisionValues({ stealMinOfferPct: 999 }).stealMinOfferPct).toBe(85);
    expect(sanitizeManagerDecisionValues({ stealMinOfferPct: 72 }).stealMinOfferPct).toBe(72);
  });

  it("clamps aiStealThreshold to [65, stealMinOfferPct]", () => {
    expect(
      sanitizeManagerDecisionValues({ stealMinOfferPct: 70, aiStealThreshold: 40 })
        .aiStealThreshold,
    ).toBe(65);
    // aiStealThreshold can't exceed stealMinOfferPct
    expect(
      sanitizeManagerDecisionValues({ stealMinOfferPct: 65, aiStealThreshold: 80 })
        .aiStealThreshold,
    ).toBe(65);
    expect(
      sanitizeManagerDecisionValues({ stealMinOfferPct: 75, aiStealThreshold: 70 })
        .aiStealThreshold,
    ).toBe(70);
  });

  it("clamps aiPitchingChangeAggressiveness to [0, 100]", () => {
    expect(
      sanitizeManagerDecisionValues({ aiPitchingChangeAggressiveness: -5 })
        .aiPitchingChangeAggressiveness,
    ).toBe(0);
    expect(
      sanitizeManagerDecisionValues({ aiPitchingChangeAggressiveness: 150 })
        .aiPitchingChangeAggressiveness,
    ).toBe(100);
    expect(
      sanitizeManagerDecisionValues({ aiPitchingChangeAggressiveness: 75 })
        .aiPitchingChangeAggressiveness,
    ).toBe(75);
  });

  it("rounds fractional values to integers", () => {
    expect(sanitizeManagerDecisionValues({ stealMinOfferPct: 72.7 }).stealMinOfferPct).toBe(73);
    expect(
      sanitizeManagerDecisionValues({ aiPitchingChangeAggressiveness: 49.4 })
        .aiPitchingChangeAggressiveness,
    ).toBe(49);
  });

  it("coerces non-boolean booleans to defaults", () => {
    // @ts-expect-error testing runtime resilience
    const result = sanitizeManagerDecisionValues({ buntEnabled: "yes" });
    expect(result.buntEnabled).toBe(DEFAULT_MANAGER_DECISION_VALUES.buntEnabled);
  });

  it("falls back to defaults when numeric fields are NaN or Infinity", () => {
    // NaN passes typeof === "number" but must not leak into threshold comparisons
    // (pct > NaN is always false, which silently disables steal detection)
    const result = sanitizeManagerDecisionValues({
      stealMinOfferPct: NaN,
      aiStealThreshold: Infinity,
      aiPitchingChangeAggressiveness: -Infinity,
    });
    expect(result.stealMinOfferPct).toBe(DEFAULT_MANAGER_DECISION_VALUES.stealMinOfferPct);
    expect(result.aiStealThreshold).toBe(DEFAULT_MANAGER_DECISION_VALUES.aiStealThreshold);
    expect(result.aiPitchingChangeAggressiveness).toBe(
      DEFAULT_MANAGER_DECISION_VALUES.aiPitchingChangeAggressiveness,
    );
  });

  it("accepts valid boolean false for toggles", () => {
    const result = sanitizeManagerDecisionValues({
      stealEnabled: false,
      buntEnabled: false,
      ibbEnabled: false,
      pinchHitterEnabled: false,
      defensiveShiftEnabled: false,
    });
    expect(result.stealEnabled).toBe(false);
    expect(result.buntEnabled).toBe(false);
    expect(result.ibbEnabled).toBe(false);
    expect(result.pinchHitterEnabled).toBe(false);
    expect(result.defensiveShiftEnabled).toBe(false);
  });

  it("preserves all valid fields from a complete object", () => {
    const input = {
      stealMinOfferPct: 73,
      aiStealThreshold: 67,
      stealEnabled: true,
      buntEnabled: true,
      ibbEnabled: false,
      pinchHitterEnabled: true,
      defensiveShiftEnabled: true,
      aiPitchingChangeAggressiveness: 75,
    };
    const result = sanitizeManagerDecisionValues(input);
    expect(result).toEqual(input);
  });

  it("coerces non-boolean stealEnabled to default (true)", () => {
    // @ts-expect-error testing runtime resilience
    const result = sanitizeManagerDecisionValues({ stealEnabled: "no" });
    expect(result.stealEnabled).toBe(DEFAULT_MANAGER_DECISION_VALUES.stealEnabled);
  });
});

describe("DEFAULT_MANAGER_DECISION_VALUES", () => {
  it("has aiStealThreshold <= stealMinOfferPct", () => {
    expect(DEFAULT_MANAGER_DECISION_VALUES.aiStealThreshold).toBeLessThanOrEqual(
      DEFAULT_MANAGER_DECISION_VALUES.stealMinOfferPct,
    );
  });

  it("has stealEnabled = true (steals are allowed by default)", () => {
    expect(DEFAULT_MANAGER_DECISION_VALUES.stealEnabled).toBe(true);
  });

  it("has defensiveShiftEnabled = false (2023 MLB shift ban default)", () => {
    expect(DEFAULT_MANAGER_DECISION_VALUES.defensiveShiftEnabled).toBe(false);
  });

  it("has aiPitchingChangeAggressiveness = 50 (modern MLB average default)", () => {
    expect(DEFAULT_MANAGER_DECISION_VALUES.aiPitchingChangeAggressiveness).toBe(50);
  });
});
