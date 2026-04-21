import { describe, expect, it } from "vitest";

import {
  DEFAULT_MANAGER_DECISION_VALUES,
  sanitizeManagerDecisionValues,
} from "./managerDecisionValues";

describe("sanitizeManagerDecisionValues", () => {
  it("returns defaults when given an empty object", () => {
    const result = sanitizeManagerDecisionValues({});
    expect(result).toEqual(DEFAULT_MANAGER_DECISION_VALUES);
  });

  it("clamps stealMinOfferPct to [62, 85]", () => {
    expect(sanitizeManagerDecisionValues({ stealMinOfferPct: 10 }).stealMinOfferPct).toBe(62);
    expect(sanitizeManagerDecisionValues({ stealMinOfferPct: 999 }).stealMinOfferPct).toBe(85);
    expect(sanitizeManagerDecisionValues({ stealMinOfferPct: 72 }).stealMinOfferPct).toBe(72);
  });

  it("clamps aiStealThreshold to [62, stealMinOfferPct]", () => {
    expect(
      sanitizeManagerDecisionValues({ stealMinOfferPct: 70, aiStealThreshold: 40 })
        .aiStealThreshold,
    ).toBe(62);
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
      buntEnabled: false,
      ibbEnabled: false,
      pinchHitterEnabled: false,
      defensiveShiftEnabled: false,
    });
    expect(result.buntEnabled).toBe(false);
    expect(result.ibbEnabled).toBe(false);
    expect(result.pinchHitterEnabled).toBe(false);
    expect(result.defensiveShiftEnabled).toBe(false);
  });

  it("preserves all valid fields from a complete object", () => {
    const input = {
      stealMinOfferPct: 73,
      aiStealThreshold: 65,
      buntEnabled: true,
      ibbEnabled: false,
      pinchHitterEnabled: true,
      defensiveShiftEnabled: true,
      aiPitchingChangeAggressiveness: 75,
    };
    const result = sanitizeManagerDecisionValues(input);
    expect(result).toEqual(input);
  });
});

describe("DEFAULT_MANAGER_DECISION_VALUES", () => {
  it("has aiStealThreshold <= stealMinOfferPct", () => {
    expect(DEFAULT_MANAGER_DECISION_VALUES.aiStealThreshold).toBeLessThanOrEqual(
      DEFAULT_MANAGER_DECISION_VALUES.stealMinOfferPct,
    );
  });

  it("has defensiveShiftEnabled = false (2023 MLB shift ban default)", () => {
    expect(DEFAULT_MANAGER_DECISION_VALUES.defensiveShiftEnabled).toBe(false);
  });

  it("has aiPitchingChangeAggressiveness = 50 (modern MLB average default)", () => {
    expect(DEFAULT_MANAGER_DECISION_VALUES.aiPitchingChangeAggressiveness).toBe(50);
  });
});
