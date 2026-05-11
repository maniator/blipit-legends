import { describe, expect, it } from "vitest";

import { validateAllSteps, validateWizardState, validateWizardStep } from "./validateWizardState";
import { makeInitialState } from "./wizardReducer";

describe("validateWizardState", () => {
  it("returns no errors for step 1 (always valid)", () => {
    const state = { ...makeInitialState(), step: 1 as const };
    expect(validateWizardState(state)).toHaveLength(0);
  });

  it("step 2 handpick: errors when fewer than 8 selected", () => {
    const state = {
      ...makeInitialState(),
      step: 2 as const,
      teamMode: "handpick" as const,
      selectedTeamIds: ["a", "b"],
    };
    const errors = validateWizardState(state);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toMatch(/8/);
  });

  it("step 2 handpick: valid when exactly 8 selected", () => {
    const state = {
      ...makeInitialState(),
      step: 2 as const,
      teamMode: "handpick" as const,
      selectedTeamIds: ["a", "b", "c", "d", "e", "f", "g", "h"],
    };
    expect(validateWizardState(state)).toHaveLength(0);
  });

  it("step 2 mixed: errors when 0 selected", () => {
    const state = {
      ...makeInitialState(),
      step: 2 as const,
      teamMode: "mixed" as const,
      selectedTeamIds: [],
    };
    expect(validateWizardState(state).length).toBeGreaterThan(0);
  });

  it("step 2 mixed: errors when all 8 selected (no autogen slots)", () => {
    const state = {
      ...makeInitialState(),
      step: 2 as const,
      teamMode: "mixed" as const,
      selectedTeamIds: ["a", "b", "c", "d", "e", "f", "g", "h"],
    };
    expect(validateWizardState(state).length).toBeGreaterThan(0);
  });

  it("step 2 mixed: valid with 1–6 selected", () => {
    const state = {
      ...makeInitialState(),
      step: 2 as const,
      teamMode: "mixed" as const,
      selectedTeamIds: ["a", "b", "c"],
    };
    expect(validateWizardState(state)).toHaveLength(0);
  });

  it("step 2 allAutogen: always valid", () => {
    const state = {
      ...makeInitialState(),
      step: 2 as const,
      teamMode: "allAutogen" as const,
      selectedTeamIds: [],
    };
    expect(validateWizardState(state)).toHaveLength(0);
  });

  it("step 3: always valid", () => {
    const state = { ...makeInitialState(), step: 3 as const, teamMode: "allAutogen" as const };
    expect(validateWizardState(state)).toHaveLength(0);
  });

  it("step 5: errors when masterSeed is empty", () => {
    const state = {
      ...makeInitialState(),
      step: 5 as const,
      teamMode: "allAutogen" as const,
      masterSeed: "",
    };
    const errors = validateWizardState(state);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toMatch(/seed/i);
  });

  it("step 5: valid when masterSeed is non-empty", () => {
    const state = {
      ...makeInitialState(),
      step: 5 as const,
      teamMode: "allAutogen" as const,
      masterSeed: "abc123",
    };
    expect(validateWizardState(state)).toHaveLength(0);
  });

  it("step 5: errors when masterSeed is whitespace-only", () => {
    const state = { ...makeInitialState(), step: 5 as const, masterSeed: "   " };
    expect(validateWizardState(state).length).toBeGreaterThan(0);
  });
});

describe("validateAllSteps", () => {
  it("returns no errors for a fully valid allAutogen state", () => {
    const state = { ...makeInitialState(), teamMode: "allAutogen" as const, masterSeed: "seed123" };
    expect(validateAllSteps(state)).toHaveLength(0);
  });

  it("returns errors when masterSeed is empty", () => {
    const state = { ...makeInitialState(), masterSeed: "" };
    expect(validateAllSteps(state).length).toBeGreaterThan(0);
  });

  it("returns errors for handpick with wrong count", () => {
    const state = {
      ...makeInitialState(),
      teamMode: "handpick" as const,
      selectedTeamIds: ["a"],
      masterSeed: "seed",
    };
    expect(validateAllSteps(state).length).toBeGreaterThan(0);
  });
});

describe("validateWizardStep", () => {
  it("returns step-2 team selection errors only on team setup step", () => {
    const state = {
      ...makeInitialState(),
      step: 2 as const,
      teamMode: "mixed" as const,
      selectedTeamIds: [],
    };
    const errors = validateWizardStep(state);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/Mixed mode requires/i);
  });

  it("returns seed error only on seed step", () => {
    const state = {
      ...makeInitialState(),
      step: 5 as const,
      masterSeed: "",
    };
    const errors = validateWizardStep(state);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/Master seed/i);
  });

  it("returns managed-team selection error on review step", () => {
    const state = {
      ...makeInitialState(),
      step: 6 as const,
      teamMode: "handpick" as const,
      selectedTeamIds: ["a", "b", "c", "d", "e", "f", "g", "h"],
      userCustomTeamId: null,
    };
    const errors = validateWizardStep(state);
    expect(errors).toContain("Please select which team you will manage.");
  });
});
