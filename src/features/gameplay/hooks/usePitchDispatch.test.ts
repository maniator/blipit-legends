import { DEFAULT_MANAGER_DECISION_VALUES } from "@feat/gameplay/context/managerDecisionValues";
import * as rngModule from "@shared/utils/rng";
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { makeState } from "@test/testHelpers";

import { usePitchDispatch } from "./usePitchDispatch";

afterEach(() => vi.restoreAllMocks());

describe("usePitchDispatch", () => {
  it("dispatches set_pending_decision when manager mode and decision available", () => {
    const dispatch = vi.fn();
    // Bunt conditions: inning >= 6, runner on 1st, outs < 2, close game, balls <= 1
    const state = makeState({ baseLayout: [1, 0, 0], outs: 0, atBat: 0, inning: 6, score: [0, 1] });
    vi.spyOn(rngModule, "random").mockReturnValue(0.5);

    const { result } = renderHook(() =>
      usePitchDispatch({
        dispatch,
        currentState: state,
        managerMode: true,
        strategy: "balanced",
        managedTeam: 0,
        skipDecision: false,
        dispatchLog: undefined,
        allTeamPitcherRoles: [{}, {}],
      }),
    );
    act(() => {
      result.current();
    });
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "set_pending_decision" }),
    );
  });

  it("dispatches strike when swing (random < swingRate)", () => {
    const dispatch = vi.fn();
    const state = makeState({ defensiveShiftOffered: true });
    vi.spyOn(rngModule, "random")
      .mockReturnValueOnce(0.0)
      .mockReturnValueOnce(0.001)
      .mockReturnValueOnce(0.5);

    const { result } = renderHook(() =>
      usePitchDispatch({
        dispatch,
        currentState: state,
        managerMode: false,
        strategy: "balanced",
        managedTeam: 0,
        skipDecision: false,
        dispatchLog: undefined,
        allTeamPitcherRoles: [{}, {}],
      }),
    );
    act(() => {
      result.current();
    });
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: expect.stringMatching(/^(strike|foul)$/) }),
    );
  });

  it("dispatches hit when swing produces contact", () => {
    // Mock sequence: pitch type (0→fastball), swing (0.001→1<360→swing),
    // swing outcome (0.9→90≥55→contact), contact roll (0.0→0<25→hard),
    // hit type roll (0.5→50 ≥ 40 and < 75 → line_drive).
    const dispatch = vi.fn();
    const state = makeState({ defensiveShiftOffered: true });
    vi.spyOn(rngModule, "random")
      .mockReturnValueOnce(0.0) // pitch type → fastball
      .mockReturnValueOnce(0.001) // swing roll: 1 < 360 → swing
      .mockReturnValueOnce(0.9) // swing outcome: 90 ≥ 55 → contact
      .mockReturnValueOnce(0.0) // contact quality: 0 < 25 → hard
      .mockReturnValueOnce(0.5); // hit type: 50 → line_drive

    const { result } = renderHook(() =>
      usePitchDispatch({
        dispatch,
        currentState: state,
        managerMode: false,
        strategy: "balanced",
        managedTeam: 0,
        skipDecision: false,
        dispatchLog: undefined,
        allTeamPitcherRoles: [{}, {}],
      }),
    );
    act(() => {
      result.current();
    });
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: "hit" }));
  });

  it("does nothing when gameOver is true", () => {
    const dispatch = vi.fn();
    const state = makeState({ gameOver: true });

    const { result } = renderHook(() =>
      usePitchDispatch({
        dispatch,
        currentState: state,
        managerMode: false,
        strategy: "balanced",
        managedTeam: 0,
        skipDecision: false,
        dispatchLog: undefined,
        allTeamPitcherRoles: [{}, {}],
      }),
    );
    act(() => {
      result.current();
    });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("dispatches hit: hard contact + typeRoll 15-39 → deep_fly", () => {
    // Hard contact (contactRoll=0 < 25) + typeRoll=17 (17 < 40 → deep_fly).
    const dispatch = vi.fn();
    const state = makeState({ defensiveShiftOffered: true });
    vi.spyOn(rngModule, "random")
      .mockReturnValueOnce(0.0) // pitch type → fastball
      .mockReturnValueOnce(0.001) // swing
      .mockReturnValueOnce(0.9) // contact
      .mockReturnValueOnce(0.0) // hard contact (0 < 25)
      .mockReturnValueOnce(0.17); // typeRoll=17: 17 < 40 → deep_fly

    const { result } = renderHook(() =>
      usePitchDispatch({
        dispatch,
        currentState: state,
        managerMode: false,
        strategy: "contact",
        managedTeam: 0,
        skipDecision: false,
        dispatchLog: undefined,
        allTeamPitcherRoles: [{}, {}],
      }),
    );
    act(() => {
      result.current();
    });
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "hit",
        payload: expect.objectContaining({ battedBallType: "deep_fly" }),
      }),
    );
  });

  it("dispatches hit: hard contact + typeRoll 40-74 → line_drive", () => {
    // Hard contact (contactRoll=0 < 25) + typeRoll=50 (40 ≤ 50 < 75 → line_drive).
    const dispatch = vi.fn();
    const state = makeState({ defensiveShiftOffered: true });
    vi.spyOn(rngModule, "random")
      .mockReturnValueOnce(0.0) // pitch type → fastball
      .mockReturnValueOnce(0.001) // swing
      .mockReturnValueOnce(0.9) // contact
      .mockReturnValueOnce(0.0) // hard contact
      .mockReturnValueOnce(0.5); // typeRoll=50: 40 ≤ 50 < 75 → line_drive

    const { result } = renderHook(() =>
      usePitchDispatch({
        dispatch,
        currentState: state,
        managerMode: false,
        strategy: "contact",
        managedTeam: 0,
        skipDecision: false,
        dispatchLog: undefined,
        allTeamPitcherRoles: [{}, {}],
      }),
    );
    act(() => {
      result.current();
    });
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "hit",
        payload: expect.objectContaining({ battedBallType: "line_drive" }),
      }),
    );
  });

  it("dispatches hit: hard contact + typeRoll 15-39 → deep_fly (balanced strategy)", () => {
    // Hard contact (contactRoll=0 < 25) + typeRoll=17 (17 < 40 → deep_fly).
    const dispatch = vi.fn();
    const state = makeState({ defensiveShiftOffered: true });
    vi.spyOn(rngModule, "random")
      .mockReturnValueOnce(0.0) // pitch type → fastball
      .mockReturnValueOnce(0.001) // swing
      .mockReturnValueOnce(0.9) // contact
      .mockReturnValueOnce(0.0) // hard contact (0 < 25)
      .mockReturnValueOnce(0.17); // typeRoll=17: 17 < 40 → deep_fly

    const { result } = renderHook(() =>
      usePitchDispatch({
        dispatch,
        currentState: state,
        managerMode: false,
        strategy: "balanced",
        managedTeam: 0,
        skipDecision: false,
        dispatchLog: undefined,
        allTeamPitcherRoles: [{}, {}],
      }),
    );
    act(() => {
      result.current();
    });
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "hit",
        payload: expect.objectContaining({ battedBallType: "deep_fly" }),
      }),
    );
  });

  it("dispatches hit: hard contact + typeRoll 40-74 → line_drive (balanced strategy)", () => {
    const dispatch = vi.fn();
    const state = makeState({ defensiveShiftOffered: true });
    vi.spyOn(rngModule, "random")
      .mockReturnValueOnce(0.0) // pitch type → fastball
      .mockReturnValueOnce(0.001) // swing
      .mockReturnValueOnce(0.9) // contact
      .mockReturnValueOnce(0.0) // hard contact
      .mockReturnValueOnce(0.5); // typeRoll=50: 40 ≤ 50 < 75 → line_drive

    const { result } = renderHook(() =>
      usePitchDispatch({
        dispatch,
        currentState: state,
        managerMode: false,
        strategy: "balanced",
        managedTeam: 0,
        skipDecision: false,
        dispatchLog: undefined,
        allTeamPitcherRoles: [{}, {}],
      }),
    );
    act(() => {
      result.current();
    });
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "hit",
        payload: expect.objectContaining({ battedBallType: "line_drive" }),
      }),
    );
  });
});

describe("usePitchDispatch — power strategy hits", () => {
  // power swing rate: computeSwingRate(0, { strategy: "power", pitchType: "fastball" }) = floor(360 * 0.95) = 342
  // Contact path: swing roll 0.001 (1<342), swing outcome 0.9 (90≥55→contact)
  const makeHitState = (contactRoll: number, typeRoll: number) => {
    const state = makeState({ defensiveShiftOffered: true });
    vi.spyOn(rngModule, "random")
      .mockReturnValueOnce(0.0) // pitch type → fastball
      .mockReturnValueOnce(0.001) // swing roll: 1 < 342 → swing
      .mockReturnValueOnce(0.9) // swing outcome: 90 ≥ 55 → contact
      .mockReturnValueOnce(contactRoll / 100) // contact quality roll
      .mockReturnValueOnce(typeRoll / 100); // hit type roll
    return state;
  };

  const dispatchAndGet = (state: ReturnType<typeof makeState>) => {
    const dispatch = vi.fn();
    const { result } = renderHook(() =>
      usePitchDispatch({
        dispatch,
        currentState: state,
        // managerMode=true + managedTeam=atBat: human manages the batting team with "power" strategy.
        // This is required to test human-manager power strategy — when a team is unmanaged
        // the AI picks its own context-aware strategy and ignores the "power" prop.
        managerMode: true,
        strategy: "power",
        managedTeam: 0,
        skipDecision: false,
        dispatchLog: undefined,
        allTeamPitcherRoles: [{}, {}],
      }),
    );
    act(() => {
      result.current();
    });
    return dispatch;
  };

  it("power deep_fly (hard contact, typeRoll < 40)", () => {
    // contactRoll=10 → hard (10 < 25); typeRoll=10 < 40 → deep_fly
    const dispatch = dispatchAndGet(makeHitState(10, 10));
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "hit",
        payload: expect.objectContaining({ battedBallType: "deep_fly" }),
      }),
    );
  });

  it("power deep_fly (hard contact, typeRoll 15–39)", () => {
    // contactRoll=10 → hard; typeRoll=17: 17 < 40 → deep_fly
    const dispatch = dispatchAndGet(makeHitState(10, 17));
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "hit",
        payload: expect.objectContaining({ battedBallType: "deep_fly" }),
      }),
    );
  });

  it("power deep_fly (hard contact, typeRoll 20–39)", () => {
    // contactRoll=10 → hard; typeRoll=33: 33 < 40 → deep_fly
    const dispatch = dispatchAndGet(makeHitState(10, 33));
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "hit",
        payload: expect.objectContaining({ battedBallType: "deep_fly" }),
      }),
    );
  });

  it("power line_drive (hard contact, typeRoll 40–74)", () => {
    // contactRoll=10 → hard; typeRoll=55: 40 ≤ 55 < 75 → line_drive
    const dispatch = dispatchAndGet(makeHitState(10, 55));
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "hit",
        payload: expect.objectContaining({ battedBallType: "line_drive" }),
      }),
    );
  });

  it("power strategy boosts medium contact to deep_fly via powerBoost (typeRoll < 15)", () => {
    // Medium contact (contactRoll=40, 25≤40<60) + power strategy + typeRoll=5 < 15
    // → powerBoost upgrades to deep_fly regardless of original quality.
    const dispatch = dispatchAndGet(makeHitState(40, 5));
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "hit",
        payload: expect.objectContaining({ battedBallType: "deep_fly" }),
      }),
    );
  });
});

describe("usePitchDispatch — suppressNextDecision", () => {
  it("manager mode: clears suppressNextDecision and still dispatches a pitch in the same tick", () => {
    // After an intentional_walk the reducer sets suppressNextDecision=true.
    // The manager-mode path must clear the flag AND let pitching proceed in the
    // same tick (mirroring the AI-only path) so no dead click is introduced.
    const dispatch = vi.fn();
    vi.spyOn(rngModule, "random").mockReturnValue(0.5);
    const state = makeState({
      atBat: 0,
      balls: 0,
      strikes: 0,
      baseLayout: [0, 0, 0],
      outs: 0,
      suppressNextDecision: true,
      defensiveShiftOffered: true, // already offered, so shift prompt is skipped
    });
    const { result } = renderHook(() =>
      usePitchDispatch({
        dispatch,
        currentState: state,
        managerMode: true,
        strategy: "balanced",
        managedTeam: 0,
        skipDecision: false,
        dispatchLog: undefined,
        allTeamPitcherRoles: [{}, {}],
      }),
    );
    act(() => {
      result.current();
    });
    expect(dispatch).toHaveBeenCalledWith({ type: "clear_suppress_decision" });
    // A normal pitch action must also be dispatched in the same tick.
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: expect.stringMatching(/^(strike|foul|hit|wait)$/) }),
    );
  });

  it("AI-only mode (managerMode=false): clears suppressNextDecision and still dispatches a pitch", () => {
    // After an intentional_walk the reducer sets suppressNextDecision=true.
    // With managerMode=false the human-manager guard never clears it — the AI path must.
    const dispatch = vi.fn();
    vi.spyOn(rngModule, "random").mockReturnValue(0.5);
    const state = makeState({
      suppressNextDecision: true,
      defensiveShiftOffered: true, // skip shift check; focus on suppress clear
    });
    const { result } = renderHook(() =>
      usePitchDispatch({
        dispatch,
        currentState: state,
        managerMode: false,
        strategy: "balanced",
        managedTeam: 0,
        skipDecision: false,
        dispatchLog: undefined,
        allTeamPitcherRoles: [{}, {}],
      }),
    );
    act(() => {
      result.current();
    });
    expect(dispatch).toHaveBeenCalledWith({ type: "clear_suppress_decision" });
    // A normal pitch action must also be dispatched in the same tick.
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: expect.stringMatching(/^(strike|foul|hit|wait)$/) }),
    );
  });
});

describe("usePitchDispatch — AI intentional walk (pitch-replacing)", () => {
  it("dispatches intentional_walk and does NOT dispatch a normal pitch in the same tick", () => {
    // IBB condition: 1st base empty, runner on 2nd, 2 outs, inning 7+, score within 2.
    const dispatch = vi.fn();
    vi.spyOn(rngModule, "random").mockReturnValue(0.5);
    const state = makeState({
      baseLayout: [0, 1, 0],
      outs: 2,
      inning: 7,
      score: [3, 1], // diff = 2, within threshold
      balls: 0,
      strikes: 0,
      suppressNextDecision: false,
      defensiveShiftOffered: true, // skip shift check; focus on IBB
    });
    const { result } = renderHook(() =>
      usePitchDispatch({
        dispatch,
        currentState: state,
        managerMode: false,
        strategy: "balanced",
        managedTeam: 0,
        skipDecision: false,
        dispatchLog: undefined,
        allTeamPitcherRoles: [{}, {}],
      }),
    );
    act(() => {
      result.current();
    });
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: "intentional_walk" }));
    // Must NOT also dispatch a normal pitch action in the same tick.
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: expect.stringMatching(/^(strike|foul|hit|wait)$/) }),
    );
  });
});

describe("usePitchDispatch — AI defensive shift (no dead tick)", () => {
  it("dispatches set_defensive_shift AND a normal pitch in the same tick", () => {
    // AI defensive shift is always applied at 0-0 count when not yet offered.
    // After dispatching the shift, pitching must still proceed in the same tick
    // so no dead click/interval is introduced.
    const dispatch = vi.fn();
    vi.spyOn(rngModule, "random").mockReturnValue(0.5);
    const state = makeState({
      defensiveShiftOffered: false, // shift not yet offered — AI will apply it
      balls: 0,
      strikes: 0,
      atBat: 0, // away team batting; home team (1) is fielding (unmanaged)
    });
    const { result } = renderHook(() =>
      usePitchDispatch({
        dispatch,
        currentState: state,
        managerMode: false,
        strategy: "balanced",
        managedTeam: 0,
        skipDecision: false,
        dispatchLog: undefined,
        allTeamPitcherRoles: [{}, {}],
        decisionValues: { ...DEFAULT_MANAGER_DECISION_VALUES, defensiveShiftEnabled: true },
      }),
    );
    act(() => {
      result.current();
    });
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: "set_defensive_shift" }));
    // A normal pitch must ALSO be dispatched in the same tick (no dead tick).
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: expect.stringMatching(/^(strike|foul|hit|wait)$/) }),
    );
  });
});

describe("usePitchDispatch — skip decision", () => {
  it("does NOT re-offer bunt after skip — skipDecision stays set until new batter", () => {
    const dispatch = vi.fn();
    const state = makeState({
      atBat: 0,
      baseLayout: [1, 0, 0],
      outs: 0,
      balls: 0,
      strikes: 0,
      inning: 6,
      score: [0, 1], // close game (bunt conditions)
    });

    // First call with skipDecision=false should offer bunt
    const { result: result1 } = renderHook(() =>
      usePitchDispatch({
        dispatch,
        currentState: state,
        managerMode: true,
        strategy: "balanced",
        managedTeam: 0,
        skipDecision: false,
        dispatchLog: undefined,
        allTeamPitcherRoles: [{}, {}],
      }),
    );
    act(() => {
      result1.current();
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "set_pending_decision",
      payload: { kind: "bunt" },
    });
    dispatch.mockClear();

    // Second call with skipDecision=true should NOT offer bunt
    const { result: result2 } = renderHook(() =>
      usePitchDispatch({
        dispatch,
        currentState: state,
        managerMode: true,
        strategy: "balanced",
        managedTeam: 0,
        skipDecision: true,
        dispatchLog: undefined,
        allTeamPitcherRoles: [{}, {}],
      }),
    );
    act(() => {
      result2.current();
    });
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({
        type: "set_pending_decision",
        payload: expect.objectContaining({ kind: "bunt" }),
      }),
    );
  });
});

describe("usePitchDispatch — AI steal threshold gate (aiStealThreshold)", () => {
  // computeStealSuccessPct for stealing 2nd with balanced strategy and no speed mod:
  //   Math.round(70 * stratMod("balanced","steal")=1.0 * speedFactor=1.0) = 70
  // Human gate (stealMinOfferPct=70): 70 > 70 → false — steal NOT offered to human
  // AI gate   (aiStealThreshold=65): 70 > 65 → true  — AI DOES attempt steal
  it("AI attempts steal when successPct (70) > aiStealThreshold (65) but NOT > stealMinOfferPct (70)", () => {
    const dispatch = vi.fn();
    // Runner on 1st, no runner on 2nd — steal 2nd candidate.
    // defensiveShiftOffered=true so the shift check is skipped cleanly.
    const state = makeState({
      baseLayout: [1, 0, 0],
      outs: 0,
      balls: 0,
      strikes: 0,
      inning: 4,
      score: [0, 0],
      suppressNextDecision: false,
      defensiveShiftOffered: true,
    });

    const { result } = renderHook(() =>
      usePitchDispatch({
        dispatch,
        currentState: state,
        managerMode: false, // both teams AI-managed
        strategy: "balanced",
        managedTeam: 0,
        skipDecision: false,
        dispatchLog: undefined,
        allTeamPitcherRoles: [{}, {}],
        decisionValues: {
          ...DEFAULT_MANAGER_DECISION_VALUES,
          stealMinOfferPct: 70, // human gate: 70 > 70 = false → no human steal offer
          aiStealThreshold: 65, // AI gate:   70 > 65 = true  → AI steals
        },
      }),
    );
    act(() => {
      result.current();
    });
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: "steal_attempt" }));
  });

  it("AI does NOT attempt steal when successPct (70) is NOT > aiStealThreshold (70)", () => {
    const dispatch = vi.fn();
    vi.spyOn(rngModule, "random").mockReturnValue(0.5); // ensure pitch resolves
    const state = makeState({
      baseLayout: [1, 0, 0],
      outs: 0,
      balls: 0,
      strikes: 0,
      inning: 4,
      score: [0, 0],
      suppressNextDecision: false,
      defensiveShiftOffered: true,
    });

    const { result } = renderHook(() =>
      usePitchDispatch({
        dispatch,
        currentState: state,
        managerMode: false,
        strategy: "balanced",
        managedTeam: 0,
        skipDecision: false,
        dispatchLog: undefined,
        allTeamPitcherRoles: [{}, {}],
        decisionValues: {
          ...DEFAULT_MANAGER_DECISION_VALUES,
          stealMinOfferPct: 70,
          aiStealThreshold: 70, // AI gate equals successPct: 70 > 70 = false → no steal
        },
      }),
    );
    act(() => {
      result.current();
    });
    expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: "steal_attempt" }));
    // A normal pitch should still be dispatched.
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: expect.stringMatching(/^(strike|foul|hit|wait)$/) }),
    );
  });
});
