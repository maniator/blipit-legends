import { useGameSessionContext } from "@feat/gameplay/context/index";
import * as announceModule from "@feat/gameplay/utils/announce";
import * as loggerModule from "@shared/utils/logger";
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeGameSessionContext } from "@test/testHelpers";

import { useAutoPlayScheduler } from "./useAutoPlayScheduler";

vi.mock("@feat/gameplay/context/index", async (importOriginal) => {
  const original = await importOriginal<typeof import("@feat/gameplay/context/index")>();
  return {
    ...original,
    useGameSessionContext: vi.fn().mockReturnValue({
      sessionType: "exhibition",
      managerModeAllowed: true,
      disableSave: false,
      seasonGameId: null,
      managedTeam: null,
      sessionReady: true,
    }),
  };
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(useGameSessionContext).mockReturnValue({
    sessionType: "exhibition",
    managerModeAllowed: true,
    disableSave: false,
    seasonGameId: null,
    managedTeam: null,
    sessionReady: true,
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const makeSnap = (overrides: { gameOver?: boolean } = {}) => ({
  strikes: 0,
  balls: 0,
  baseLayout: [0, 0, 0] as [number, number, number],
  outs: 0,
  inning: 1,
  score: [0, 0] as [number, number],
  atBat: 0,
  pendingDecision: null,
  gameOver: false,
  onePitchModifier: null,
  teams: ["Away", "Home"] as [string, string],
  suppressNextDecision: false,
  pinchHitterStrategy: null,
  defensiveShift: false,
  defensiveShiftOffered: false,
  ...overrides,
});

/**
 * Helper that invokes useAutoPlayScheduler with the standard options object signature.
 */
const renderScheduler = ({
  gameStarted = false,
  pendingDecision = null as Parameters<typeof useAutoPlayScheduler>[0]["pendingDecision"],
  managerMode = false,
  gameOver = false,
  muted = false,
  speed = 700,
  paused = false,
  handlePitch = vi.fn(),
  inning = 1,
  atBat = 0 as 0 | 1 | null,
} = {}) =>
  renderHook((props) => useAutoPlayScheduler(props), {
    initialProps: {
      gameStarted,
      pendingDecision,
      managerMode,
      gameOver,
      muted,
      speed,
      paused,
      handlePitch,
      inning,
      atBat,
    },
  });

describe("useAutoPlayScheduler", () => {
  it("does not call handleClick when game has not started", () => {
    const handleClick = vi.fn();
    renderScheduler({ gameStarted: false, handlePitch: handleClick });
    vi.advanceTimersByTime(2000);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it("pauses when pendingDecision is set and managerMode is true", () => {
    const handleClick = vi.fn();
    renderScheduler({
      gameStarted: true,
      pendingDecision: { kind: "bunt" as const },
      managerMode: true,
      handlePitch: handleClick,
    });
    vi.advanceTimersByTime(2000);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it("does not call handleClick when gameOver is true", () => {
    const handleClick = vi.fn();
    vi.spyOn(announceModule, "isSpeechPending").mockReturnValue(false);
    renderScheduler({
      gameStarted: true,
      gameOver: true,
      muted: true,
      speed: 100,
      handlePitch: handleClick,
    });
    vi.advanceTimersByTime(500);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it("calls handleClick after speed delay when game has started", () => {
    const handleClick = vi.fn();
    vi.spyOn(announceModule, "isSpeechPending").mockReturnValue(false);
    renderScheduler({
      gameStarted: true,
      muted: true,
      speed: 100,
      handlePitch: handleClick,
    });
    vi.advanceTimersByTime(150);
    expect(handleClick).toHaveBeenCalled();
  });

  it("polls when speech is pending (not muted) then calls handleClick once speech clears", () => {
    const handleClick = vi.fn();
    vi.spyOn(announceModule, "isSpeechPending")
      .mockReturnValueOnce(true) // first tick: still speaking
      .mockReturnValue(false); // second tick: done

    renderScheduler({
      gameStarted: true,
      muted: false, // NOT muted → speech check applies
      speed: 100,
      handlePitch: handleClick,
    });
    vi.advanceTimersByTime(100);
    expect(handleClick).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("adds 1500ms pause at half-inning transition when muted", () => {
    const handleClick = vi.fn();
    vi.spyOn(announceModule, "isSpeechPending").mockReturnValue(false);

    const { rerender } = renderScheduler({
      gameStarted: true,
      muted: true,
      speed: 100,
      handlePitch: handleClick,
      inning: 1,
      atBat: 0,
    });

    // Trigger half-inning transition by changing atBat
    rerender({
      gameStarted: true,
      muted: true,
      speed: 100,
      paused: false,
      handlePitch: handleClick,
      inning: 1,
      atBat: 1,
      pendingDecision: null,
      managerMode: false,
      gameOver: false,
    });

    vi.advanceTimersByTime(100);
    expect(handleClick).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1500);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // Bug regression: scheduler must restart after loading a new game when the
  // previous game was already over.
  // -------------------------------------------------------------------------

  it("restarts and calls handleClick when gameOver flips false→true→false (load over finished game)", () => {
    const handleClick = vi.fn();
    vi.spyOn(announceModule, "isSpeechPending").mockReturnValue(false);

    const { rerender } = renderScheduler({
      gameStarted: true,
      gameOver: false,
      muted: true,
      speed: 100,
      handlePitch: handleClick,
    });

    // Advance until the first pitch fires (game in progress).
    vi.advanceTimersByTime(150);
    const callsAfterFirstGame = handleClick.mock.calls.length;
    expect(callsAfterFirstGame).toBeGreaterThan(0);

    // Game ends — scheduler should stop.
    rerender({
      gameStarted: true,
      gameOver: true,
      pendingDecision: null,
      managerMode: false,
      muted: true,
      speed: 100,
      paused: false,
      handlePitch: handleClick,
      inning: 9,
      atBat: 1,
    });
    handleClick.mockClear();
    vi.advanceTimersByTime(500);
    // No further calls while game is over.
    expect(handleClick).not.toHaveBeenCalled();

    // Load a new in-progress save → gameOver flips back to false.
    rerender({
      gameStarted: true,
      gameOver: false,
      pendingDecision: null,
      managerMode: false,
      muted: true,
      speed: 100,
      paused: false,
      handlePitch: handleClick,
      inning: 1,
      atBat: 0,
    });

    // Scheduler must restart and fire pitches.
    vi.advanceTimersByTime(200);
    expect(handleClick).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Bug regression: stale gameStateRef.gameOver must NOT permanently kill the
  // timer chain (same-component restore scenario — modal load or in-place restore).
  // -------------------------------------------------------------------------

  it("does not permanently stop when gameOver prop is false (restore scenario)", () => {
    const handleClick = vi.fn();
    vi.spyOn(announceModule, "isSpeechPending").mockReturnValue(false);

    // Effect-level guard says game is in progress (gameOver prop is false)
    renderScheduler({
      gameStarted: true,
      gameOver: false,
      muted: true,
      speed: 100,
      handlePitch: handleClick,
    });

    // The timer chain fires normally
    vi.advanceTimersByTime(300);
    expect(handleClick).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Bug regression: an exception in handleClick must not kill the autoplay chain.
  // -------------------------------------------------------------------------

  it("continues scheduling after handleClick throws an exception", () => {
    const logErrorSpy = vi.spyOn(loggerModule.appLog, "error").mockImplementation(() => {});
    vi.spyOn(announceModule, "isSpeechPending").mockReturnValue(false);

    let callCount = 0;
    const handleClick = vi.fn(() => {
      callCount++;
      if (callCount === 1) throw new Error("simulated pitch handler crash");
    });

    renderScheduler({
      gameStarted: true,
      muted: true,
      speed: 100,
      handlePitch: handleClick,
    });

    // First tick fires at 100ms: handleClick throws — scheduler must log and continue.
    vi.advanceTimersByTime(100);
    expect(handleClick).toHaveBeenCalledTimes(1);
    expect(logErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("[autoplay]"),
      expect.any(Error),
    );

    // Second tick fires at 200ms: scheduler is still alive and fires again.
    vi.advanceTimersByTime(100);
    expect(handleClick).toHaveBeenCalledTimes(2);

    logErrorSpy.mockRestore();
  });

  // -------------------------------------------------------------------------
  // Instant mode (speed === 0) — must skip speech gating and inning pauses.
  // -------------------------------------------------------------------------

  it("fires immediately (no speech gate) in Instant mode (speed=0) even when speech is pending", () => {
    const handleClick = vi.fn();
    vi.spyOn(announceModule, "isSpeechPending").mockReturnValue(true); // speech "pending"
    renderScheduler({
      gameStarted: true,
      muted: false, // NOT muted, but instant mode should skip speech gating
      speed: 0, // SPEED_INSTANT
      handlePitch: handleClick,
    });
    // Even with speech pending, instant mode fires on next tick (delay=0)
    vi.advanceTimersByTime(10);
    expect(handleClick).toHaveBeenCalled();
  });

  it("instant mode skips inning pause at half-inning transition", () => {
    const handleClick = vi.fn();
    vi.spyOn(announceModule, "isSpeechPending").mockReturnValue(false);

    const { rerender } = renderScheduler({
      gameStarted: true,
      muted: true,
      speed: 0, // SPEED_INSTANT
      handlePitch: handleClick,
      inning: 1,
      atBat: 0 as 0 | 1,
    });

    // Advance past the initial tick so the scheduler fires at least once.
    vi.advanceTimersByTime(10);
    handleClick.mockClear();

    // Trigger half-inning transition.
    rerender({
      gameStarted: true,
      muted: true,
      speed: 0,
      paused: false,
      handlePitch: handleClick,
      inning: 1,
      atBat: 1 as 0 | 1,
      pendingDecision: null,
      managerMode: false,
      gameOver: false,
    });

    // With instant mode, should fire immediately even at half-inning boundary — no 1500ms pause.
    vi.advanceTimersByTime(1);
    expect(handleClick).toHaveBeenCalled();
  });

  it("does not call handlePitch when sessionReady=false", () => {
    vi.mocked(useGameSessionContext).mockReturnValueOnce(
      makeGameSessionContext({ sessionReady: false }),
    );

    const handleClick = vi.fn();
    vi.spyOn(announceModule, "isSpeechPending").mockReturnValue(false);
    renderScheduler({ gameStarted: true, muted: true, speed: 100, handlePitch: handleClick });
    vi.advanceTimersByTime(500);
    expect(handleClick).not.toHaveBeenCalled();
  });
});

describe("paused parameter", () => {
  it("does not call handlePitch when paused=true even after speed interval elapses", () => {
    const handlePitch = vi.fn();
    vi.spyOn(announceModule, "isSpeechPending").mockReturnValue(false);
    renderScheduler({
      gameStarted: true,
      muted: true,
      speed: 100,
      paused: true,
      handlePitch,
    });
    vi.advanceTimersByTime(500);
    expect(handlePitch).not.toHaveBeenCalled();
  });

  it("resumes calling handlePitch when paused flips from true to false", () => {
    const handlePitch = vi.fn();
    vi.spyOn(announceModule, "isSpeechPending").mockReturnValue(false);
    const { rerender } = renderScheduler({
      gameStarted: true,
      muted: true,
      speed: 100,
      paused: true,
      handlePitch,
    });
    vi.advanceTimersByTime(500);
    expect(handlePitch).not.toHaveBeenCalled();

    rerender({
      gameStarted: true,
      muted: true,
      speed: 100,
      paused: false,
      handlePitch,
      pendingDecision: null,
      managerMode: false,
      gameOver: false,
      inning: 1,
      atBat: 0,
    });

    vi.advanceTimersByTime(200);
    expect(handlePitch).toHaveBeenCalled();
  });
});
