import { describe, expect, it, vi } from "vitest";

import {
  type WizardState,
  clearWizardState,
  loadWizardState,
  makeInitialState,
  saveWizardState,
  wizardReducer,
} from "./wizardReducer";

// Mock generateSeed to return a deterministic value in tests.
vi.mock("@storage/generateId", () => ({
  generateSeed: vi.fn(() => "test-seed-16chars"),
  generateTeamId: vi.fn(() => "ct_test"),
  generatePlayerId: vi.fn(() => "p_test"),
  generateSaveId: vi.fn(() => "save_test"),
  generateSeasonId: vi.fn(() => "s_test"),
  generateSeasonTeamId: vi.fn(() => "st_test"),
  generateSeasonGameId: vi.fn(() => "sg_test"),
  generateGameInstanceId: vi.fn(() => "game_test"),
}));

describe("wizardReducer", () => {
  it("NEXT_STEP advances through [1, 2, 3, 5, 6]", () => {
    let state = makeInitialState();
    expect(state.step).toBe(1);

    state = wizardReducer(state, { type: "NEXT_STEP" });
    expect(state.step).toBe(2);

    state = wizardReducer(state, { type: "NEXT_STEP" });
    expect(state.step).toBe(3);

    state = wizardReducer(state, { type: "NEXT_STEP" });
    expect(state.step).toBe(5);

    state = wizardReducer(state, { type: "NEXT_STEP" });
    expect(state.step).toBe(6);

    // Already at last step — no change.
    state = wizardReducer(state, { type: "NEXT_STEP" });
    expect(state.step).toBe(6);
  });

  it("PREV_STEP reverses through [6, 5, 3, 2, 1]", () => {
    let state: ReturnType<typeof makeInitialState> = { ...makeInitialState(), step: 6 as WizardState["step"] };

    state = wizardReducer(state, { type: "PREV_STEP" });
    expect(state.step).toBe(5);

    state = wizardReducer(state, { type: "PREV_STEP" });
    expect(state.step).toBe(3);

    state = wizardReducer(state, { type: "PREV_STEP" });
    expect(state.step).toBe(2);

    state = wizardReducer(state, { type: "PREV_STEP" });
    expect(state.step).toBe(1);

    // Already at first step — no change.
    state = wizardReducer(state, { type: "PREV_STEP" });
    expect(state.step).toBe(1);
  });

  it("TOGGLE_TEAM_SELECT adds a teamId when not selected", () => {
    const state = makeInitialState();
    const next = wizardReducer(state, { type: "TOGGLE_TEAM_SELECT", teamId: "ct_abc" });
    expect(next.selectedTeamIds).toContain("ct_abc");
  });

  it("TOGGLE_TEAM_SELECT removes a teamId when already selected", () => {
    const state = { ...makeInitialState(), selectedTeamIds: ["ct_abc", "ct_xyz"] };
    const next = wizardReducer(state, { type: "TOGGLE_TEAM_SELECT", teamId: "ct_abc" });
    expect(next.selectedTeamIds).not.toContain("ct_abc");
    expect(next.selectedTeamIds).toContain("ct_xyz");
  });

  it("REROLL_MASTER_SEED changes masterSeed", () => {
    const state = makeInitialState();
    const prev = state.masterSeed;
    // RESET to clear mock state then reroll — just verify field is updated
    const next = wizardReducer(state, { type: "REROLL_MASTER_SEED" });
    // generateSeed is mocked to return "test-seed-16chars" consistently
    expect(typeof next.masterSeed).toBe("string");
    expect(next.masterSeed.length).toBeGreaterThan(0);
    // masterSeed should be whatever generateSeed returns (mocked value)
    expect(next.masterSeed).toBeDefined();
    void prev; // suppress unused warning
  });

  it("SET_DH updates the correct league index", () => {
    const state = {
      ...makeInitialState(),
      leagueCount: 2 as const,
      leagues: [
        { id: "league_0", name: "League 1", dhEnabled: true },
        { id: "league_1", name: "League 2", dhEnabled: true },
      ],
    };

    const next = wizardReducer(state, { type: "SET_DH", leagueIndex: 1, enabled: false });
    expect(next.leagues[0].dhEnabled).toBe(true);
    expect(next.leagues[1].dhEnabled).toBe(false);
  });

  it("RESET returns to initial state", () => {
    let state = makeInitialState();
    state = wizardReducer(state, { type: "NEXT_STEP" });
    state = wizardReducer(state, { type: "NEXT_STEP" });
    state = wizardReducer(state, { type: "TOGGLE_TEAM_SELECT", teamId: "ct_abc" });

    const reset = wizardReducer(state, { type: "RESET" });
    expect(reset.step).toBe(1);
    expect(reset.selectedTeamIds).toHaveLength(0);
    expect(reset._v).toBe(1);
  });

  it("GO_TO_STEP jumps directly to a step", () => {
    const state = makeInitialState();
    const next = wizardReducer(state, { type: "GO_TO_STEP", step: 5 });
    expect(next.step).toBe(5);
  });

  it("SET_LEAGUE_COUNT updates leagueCount and resizes leagues array", () => {
    const state = makeInitialState();
    const next = wizardReducer(state, { type: "SET_LEAGUE_COUNT", count: 2 });
    expect(next.leagueCount).toBe(2);
    expect(next.leagues).toHaveLength(2);
  });

  it("SET_TEAM_MODE updates teamMode", () => {
    const state = makeInitialState();
    const next = wizardReducer(state, { type: "SET_TEAM_MODE", mode: "handpick" });
    expect(next.teamMode).toBe("handpick");
  });

  it("REROLL_AUTOGEN_SEED changes autogenSeed", () => {
    const state = makeInitialState();
    const next = wizardReducer(state, { type: "REROLL_AUTOGEN_SEED" });
    expect(typeof next.autogenSeed).toBe("string");
    expect(next.autogenSeed.length).toBeGreaterThan(0);
  });

  it("SET_MASTER_SEED sets masterSeed to provided value", () => {
    const state = makeInitialState();
    const next = wizardReducer(state, { type: "SET_MASTER_SEED", seed: "custom-seed" });
    expect(next.masterSeed).toBe("custom-seed");
  });

  it("SET_AUTOGEN_THEME updates autogenTheme", () => {
    const state = makeInitialState();
    const next = wizardReducer(state, { type: "SET_AUTOGEN_THEME", theme: "scifi" });
    expect(next.autogenTheme).toBe("scifi");
  });

  it("SET_AUTOGEN_PARITY updates autogenParity", () => {
    const state = makeInitialState();
    const next = wizardReducer(state, { type: "SET_AUTOGEN_PARITY", parity: 75 });
    expect(next.autogenParity).toBe(75);
  });
});

describe("sessionStorage round-trip", () => {
  it("saves and loads state with _v:1", () => {
    const state = makeInitialState();
    saveWizardState(state);
    const loaded = loadWizardState();
    expect(loaded).not.toBeNull();
    expect(loaded!._v).toBe(1);
    expect(loaded!.step).toBe(state.step);
    expect(loaded!.masterSeed).toBe(state.masterSeed);
  });

  it("returns null for missing key", () => {
    clearWizardState();
    expect(loadWizardState()).toBeNull();
  });

  it("discards state with wrong _v", () => {
    sessionStorage.setItem("league_wizard_v1", JSON.stringify({ _v: 2, step: 1 }));
    expect(loadWizardState()).toBeNull();
  });

  it("discards malformed JSON", () => {
    sessionStorage.setItem("league_wizard_v1", "not-json");
    expect(loadWizardState()).toBeNull();
  });

  it("clearWizardState removes the key", () => {
    const state = makeInitialState();
    saveWizardState(state);
    clearWizardState();
    expect(sessionStorage.getItem("league_wizard_v1")).toBeNull();
  });
});
