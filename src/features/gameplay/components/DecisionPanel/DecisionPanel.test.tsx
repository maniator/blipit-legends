import * as React from "react";

import type { ContextValue, DecisionType } from "@feat/gameplay/context/index";
import { GameContext } from "@feat/gameplay/context/index";
import { UIPauseContext, UIPauseProvider } from "@shared/contexts/UIPauseContext";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { makeContextValue } from "@test/testHelpers";

import DecisionPanel from ".";

vi.mock("@feat/gameplay/utils/announce", () => ({
  playDecisionChime: vi.fn(),
  setAnnouncementVolume: vi.fn(),
  setAlertVolume: vi.fn(),
  getAnnouncementVolume: vi.fn().mockReturnValue(1),
  getAlertVolume: vi.fn().mockReturnValue(1),
  announce: vi.fn(),
  cancelAnnouncements: vi.fn(),
  isSpeechPending: vi.fn().mockReturnValue(false),
  canAnnounce: vi.fn().mockReturnValue(true),
  setSpeechRate: vi.fn(),
  playVictoryFanfare: vi.fn(),
  play7thInningStretch: vi.fn(),
}));

const renderWithContext = (ui: React.ReactElement, ctx: ContextValue = makeContextValue()) =>
  render(
    <UIPauseProvider>
      <GameContext.Provider value={ctx}>{ui}</GameContext.Provider>
    </UIPauseProvider>,
  );

/**
 * Wraps the panel with a forced UI-pause context value so we can drive the
 * paused state directly without exercising the provider's reducer.
 */
const renderForcedPaused = (
  ui: React.ReactElement,
  ctx: ContextValue,
  paused: boolean,
): ReturnType<typeof render> =>
  render(
    <UIPauseContext.Provider value={{ isPaused: paused, pushPause: () => {}, popPause: () => {} }}>
      <GameContext.Provider value={ctx}>{ui}</GameContext.Provider>
    </UIPauseContext.Provider>,
  );

describe("DecisionPanel", () => {
  it("renders nothing when pendingDecision is null", () => {
    const { container } = renderWithContext(
      <DecisionPanel strategy="balanced" />,
      makeContextValue({ pendingDecision: null }),
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders steal decision", () => {
    const decision: DecisionType = { kind: "steal", base: 0, successPct: 75 };
    renderWithContext(
      <DecisionPanel strategy="balanced" />,
      makeContextValue({ pendingDecision: decision }),
    );
    expect(screen.getByText(/steal attempt/i)).toBeInTheDocument();
    expect(screen.getByText(/75%/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /yes, steal/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /skip/i })).toBeInTheDocument();
  });

  it("renders steal from 2nd base", () => {
    renderWithContext(
      <DecisionPanel strategy="balanced" />,
      makeContextValue({ pendingDecision: { kind: "steal", base: 1, successPct: 80 } }),
    );
    expect(screen.getByText(/2nd base/i)).toBeInTheDocument();
  });

  it("renders bunt decision", () => {
    renderWithContext(
      <DecisionPanel strategy="balanced" />,
      makeContextValue({ pendingDecision: { kind: "bunt" } }),
    );
    expect(screen.getByText(/sacrifice bunt/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /yes, bunt/i })).toBeInTheDocument();
  });

  it("renders count30 decision", () => {
    renderWithContext(
      <DecisionPanel strategy="balanced" />,
      makeContextValue({ pendingDecision: { kind: "count30" } }),
    );
    expect(screen.getByText(/3-0/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /take/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /swing away/i })).toBeInTheDocument();
  });

  it("renders count02 decision", () => {
    renderWithContext(
      <DecisionPanel strategy="balanced" />,
      makeContextValue({ pendingDecision: { kind: "count02" } }),
    );
    expect(screen.getByText(/0-2/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /protect/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /normal swing/i })).toBeInTheDocument();
  });

  it("renders ibb decision", () => {
    renderWithContext(
      <DecisionPanel strategy="balanced" />,
      makeContextValue({ pendingDecision: { kind: "ibb" } }),
    );
    expect(screen.getByText(/intentional walk/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /yes, walk them/i })).toBeInTheDocument();
  });

  it("shows countdown bar and auto-skip label", () => {
    renderWithContext(
      <DecisionPanel strategy="balanced" />,
      makeContextValue({ pendingDecision: { kind: "bunt" } }),
    );
    expect(screen.getByText(/auto-skip/i)).toBeInTheDocument();
  });

  it("dispatches steal_attempt when Yes clicked", () => {
    const dispatch = vi.fn();
    const decision: DecisionType = { kind: "steal", base: 0, successPct: 80 };
    renderWithContext(
      <DecisionPanel strategy="balanced" />,
      makeContextValue({ pendingDecision: decision, dispatch }),
    );
    fireEvent.click(screen.getByRole("button", { name: /yes, steal/i }));
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: "steal_attempt" }));
  });

  it("dispatches skip_decision when Skip clicked", () => {
    const dispatch = vi.fn();
    renderWithContext(
      <DecisionPanel strategy="balanced" />,
      makeContextValue({ pendingDecision: { kind: "bunt" }, dispatch }),
    );
    fireEvent.click(screen.getByRole("button", { name: /skip/i }));
    expect(dispatch).toHaveBeenCalledWith({ type: "skip_decision" });
  });

  it("dispatches bunt_attempt when bunt Yes clicked", () => {
    const dispatch = vi.fn();
    renderWithContext(
      <DecisionPanel strategy="contact" />,
      makeContextValue({ pendingDecision: { kind: "bunt" }, dispatch }),
    );
    fireEvent.click(screen.getByRole("button", { name: /yes, bunt/i }));
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: "bunt_attempt" }));
  });

  it("dispatches set_one_pitch_modifier: take on count30 Take click", () => {
    const dispatch = vi.fn();
    renderWithContext(
      <DecisionPanel strategy="balanced" />,
      makeContextValue({ pendingDecision: { kind: "count30" }, dispatch }),
    );
    fireEvent.click(screen.getByRole("button", { name: /take/i }));
    expect(dispatch).toHaveBeenCalledWith({ type: "set_one_pitch_modifier", payload: "take" });
  });

  it("dispatches set_one_pitch_modifier: swing on count30 Swing click", () => {
    const dispatch = vi.fn();
    renderWithContext(
      <DecisionPanel strategy="balanced" />,
      makeContextValue({ pendingDecision: { kind: "count30" }, dispatch }),
    );
    fireEvent.click(screen.getByRole("button", { name: /swing away/i }));
    expect(dispatch).toHaveBeenCalledWith({ type: "set_one_pitch_modifier", payload: "swing" });
  });

  it("dispatches set_one_pitch_modifier: protect on count02 Protect click", () => {
    const dispatch = vi.fn();
    renderWithContext(
      <DecisionPanel strategy="balanced" />,
      makeContextValue({ pendingDecision: { kind: "count02" }, dispatch }),
    );
    fireEvent.click(screen.getByRole("button", { name: /protect/i }));
    expect(dispatch).toHaveBeenCalledWith({ type: "set_one_pitch_modifier", payload: "protect" });
  });

  it("dispatches set_one_pitch_modifier: normal on count02 Normal click", () => {
    const dispatch = vi.fn();
    renderWithContext(
      <DecisionPanel strategy="balanced" />,
      makeContextValue({ pendingDecision: { kind: "count02" }, dispatch }),
    );
    fireEvent.click(screen.getByRole("button", { name: /normal swing/i }));
    expect(dispatch).toHaveBeenCalledWith({ type: "set_one_pitch_modifier", payload: "normal" });
  });

  it("dispatches intentional_walk on IBB Yes click", () => {
    const dispatch = vi.fn();
    renderWithContext(
      <DecisionPanel strategy="balanced" />,
      makeContextValue({ pendingDecision: { kind: "ibb" }, dispatch }),
    );
    fireEvent.click(screen.getByRole("button", { name: /yes, walk them/i }));
    expect(dispatch).toHaveBeenCalledWith({ type: "intentional_walk" });
  });

  it("auto-skips after countdown reaches zero", () => {
    vi.useFakeTimers();
    const dispatch = vi.fn();
    renderWithContext(
      <DecisionPanel strategy="balanced" />,
      makeContextValue({ pendingDecision: { kind: "bunt" }, dispatch }),
    );
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(dispatch).toHaveBeenCalledWith({ type: "skip_decision" });
    vi.useRealTimers();
  });
});

describe("DecisionPanel — service worker notification paths", () => {
  const mockNotifs = [{ close: vi.fn() }];
  const mockReg = {
    showNotification: vi.fn().mockResolvedValue(undefined),
    getNotifications: vi.fn().mockResolvedValue(mockNotifs),
  };
  const mockSW = {
    ready: Promise.resolve(mockReg),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };

  beforeAll(() => {
    Object.defineProperty(navigator, "serviceWorker", {
      value: mockSW,
      writable: true,
      configurable: true,
    });
  });

  afterAll(() => {
    Object.defineProperty(navigator, "serviceWorker", {
      value: undefined,
      writable: true,
      configurable: true,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockSW.ready = Promise.resolve(mockReg) as unknown as typeof mockSW.ready;
  });

  const getRegisteredMessageHandler = (): ((e: MessageEvent) => void) => {
    const found = mockSW.addEventListener.mock.calls.find(([event]) => event === "message");
    if (!found)
      throw new Error("No 'message' event handler was registered on navigator.serviceWorker");
    return found[1] as (e: MessageEvent) => void;
  };

  it("registers service worker message listener on mount", () => {
    renderWithContext(
      <DecisionPanel strategy="balanced" />,
      makeContextValue({ pendingDecision: null }),
    );
    expect(mockSW.addEventListener).toHaveBeenCalledWith("message", expect.any(Function));
  });

  it("removes service worker message listener on unmount", () => {
    const { unmount } = renderWithContext(
      <DecisionPanel strategy="balanced" />,
      makeContextValue({ pendingDecision: null }),
    );
    unmount();
    expect(mockSW.removeEventListener).toHaveBeenCalledWith("message", expect.any(Function));
  });

  it("calls showNotification via SW when pendingDecision is set", async () => {
    await act(async () => {
      renderWithContext(
        <DecisionPanel strategy="balanced" />,
        makeContextValue({ pendingDecision: { kind: "bunt" } }),
      );
    });
    expect(mockReg.showNotification).toHaveBeenCalledWith(
      expect.stringContaining("Manager"),
      expect.objectContaining({ tag: "manager-decision" }),
    );
  });

  it("handles steal SW notification action", () => {
    const dispatch = vi.fn();
    const decision: DecisionType = { kind: "steal", base: 0, successPct: 80 };
    renderWithContext(
      <DecisionPanel strategy="balanced" />,
      makeContextValue({ pendingDecision: decision, dispatch }),
    );
    const handler = getRegisteredMessageHandler();
    act(() => {
      handler({
        data: {
          type: "NOTIFICATION_ACTION",
          action: "steal",
          payload: { base: 0, successPct: 80 },
        },
      } as MessageEvent);
    });
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: "steal_attempt" }));
  });

  it("handles bunt SW notification action", () => {
    const dispatch = vi.fn();
    renderWithContext(
      <DecisionPanel strategy="balanced" />,
      makeContextValue({ pendingDecision: { kind: "bunt" }, dispatch }),
    );
    const handler = getRegisteredMessageHandler();
    act(() => {
      handler({
        data: { type: "NOTIFICATION_ACTION", action: "bunt", payload: {} },
      } as MessageEvent);
    });
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: "bunt_attempt" }));
  });

  it("handles take/swing/protect/normal/ibb/skip SW actions", () => {
    const dispatch = vi.fn();
    renderWithContext(
      <DecisionPanel strategy="balanced" />,
      makeContextValue({ pendingDecision: { kind: "count30" }, dispatch }),
    );
    const handler = getRegisteredMessageHandler();
    const cases = [
      { action: "take", expected: { type: "set_one_pitch_modifier", payload: "take" } },
      { action: "swing", expected: { type: "set_one_pitch_modifier", payload: "swing" } },
      { action: "protect", expected: { type: "set_one_pitch_modifier", payload: "protect" } },
      { action: "normal", expected: { type: "set_one_pitch_modifier", payload: "normal" } },
      { action: "ibb", expected: { type: "intentional_walk" } },
      { action: "skip", expected: { type: "skip_decision" } },
    ];
    for (const { action, expected } of cases) {
      dispatch.mockClear();
      act(() => {
        handler({ data: { type: "NOTIFICATION_ACTION", action, payload: {} } } as MessageEvent);
      });
      expect(dispatch).toHaveBeenCalledWith(expected);
    }
  });

  it("ignores unknown SW notification action (focus)", () => {
    const dispatch = vi.fn();
    renderWithContext(
      <DecisionPanel strategy="balanced" />,
      makeContextValue({ pendingDecision: { kind: "bunt" }, dispatch }),
    );
    const handler = getRegisteredMessageHandler();
    act(() => {
      handler({
        data: { type: "NOTIFICATION_ACTION", action: "focus", payload: {} },
      } as MessageEvent);
    });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("ignores non-NOTIFICATION_ACTION messages", () => {
    const dispatch = vi.fn();
    renderWithContext(
      <DecisionPanel strategy="balanced" />,
      makeContextValue({ pendingDecision: { kind: "bunt" }, dispatch }),
    );
    const handler = getRegisteredMessageHandler();
    act(() => {
      handler({ data: { type: "SOME_OTHER_MESSAGE", action: "skip" } } as MessageEvent);
    });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("handles ph_* and shift_on SW notification actions", () => {
    const dispatch = vi.fn();
    renderWithContext(
      <DecisionPanel strategy="balanced" />,
      makeContextValue({
        pendingDecision: { kind: "pinch_hitter", candidates: [], teamIdx: 0, lineupIdx: 0 },
        dispatch,
      }),
    );
    const handler = getRegisteredMessageHandler();
    const cases = [
      { action: "ph_contact", expected: { type: "set_pinch_hitter_strategy", payload: "contact" } },
      { action: "ph_patient", expected: { type: "set_pinch_hitter_strategy", payload: "patient" } },
      { action: "ph_power", expected: { type: "set_pinch_hitter_strategy", payload: "power" } },
      {
        action: "ph_aggressive",
        expected: { type: "set_pinch_hitter_strategy", payload: "aggressive" },
      },
      {
        action: "ph_balanced",
        expected: { type: "set_pinch_hitter_strategy", payload: "balanced" },
      },
      { action: "shift_on", expected: { type: "set_defensive_shift", payload: true } },
    ];
    for (const { action, expected } of cases) {
      dispatch.mockClear();
      act(() => {
        handler({ data: { type: "NOTIFICATION_ACTION", action, payload: {} } } as MessageEvent);
      });
      expect(dispatch).toHaveBeenCalledWith(expected);
    }
  });

  it("handles shift_off SW notification action", () => {
    const dispatch = vi.fn();
    renderWithContext(
      <DecisionPanel strategy="balanced" />,
      makeContextValue({ pendingDecision: { kind: "defensive_shift" }, dispatch }),
    );
    const handler = getRegisteredMessageHandler();
    act(() => {
      handler({
        data: { type: "NOTIFICATION_ACTION", action: "shift_off", payload: {} },
      } as MessageEvent);
    });
    expect(dispatch).toHaveBeenCalledWith({ type: "set_defensive_shift", payload: false });
  });

  it("re-sends notification on visibilitychange when tab becomes hidden", async () => {
    await act(async () => {
      renderWithContext(
        <DecisionPanel strategy="balanced" />,
        makeContextValue({ pendingDecision: { kind: "bunt" } }),
      );
    });
    mockReg.showNotification.mockClear();
    // Simulate the tab becoming hidden
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    // Give the SW promise time to settle
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    Object.defineProperty(document, "hidden", { value: false, configurable: true });
    expect(mockReg.showNotification).toHaveBeenCalled();
  });
});

describe("DecisionPanel — closes notification", () => {
  const mockNotifs = [{ close: vi.fn() }];
  const mockReg = {
    showNotification: vi.fn().mockResolvedValue(undefined),
    getNotifications: vi.fn().mockResolvedValue(mockNotifs),
  };
  const mockSW = {
    ready: Promise.resolve(mockReg),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };

  beforeAll(() => {
    Object.defineProperty(navigator, "serviceWorker", {
      value: mockSW,
      writable: true,
      configurable: true,
    });
  });

  afterAll(() => {
    Object.defineProperty(navigator, "serviceWorker", {
      value: undefined,
      writable: true,
      configurable: true,
    });
  });

  it("closes notification when decision is resolved (pendingDecision → null)", async () => {
    const { rerender } = renderWithContext(
      <DecisionPanel strategy="balanced" />,
      makeContextValue({ pendingDecision: { kind: "bunt" } }),
    );
    await act(async () => {
      rerender(
        <GameContext.Provider value={makeContextValue({ pendingDecision: null })}>
          <DecisionPanel strategy="balanced" />
        </GameContext.Provider>,
      );
    });
    expect(mockReg.getNotifications).toHaveBeenCalled();
  });
});

describe("DecisionPanel — UI pause (Saves modal open)", () => {
  // The previous SW describes leave navigator.serviceWorker = undefined.
  // Stub it locally so DecisionPanel's mount effect (which expects an event
  // emitter when the property exists) does not throw — the stub is a no-op
  // because these tests do not exercise SW notification paths.
  const swStub = {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    ready: Promise.resolve({
      showNotification: vi.fn().mockResolvedValue(undefined),
      getNotifications: vi.fn().mockResolvedValue([]),
    }),
  };
  beforeAll(() => {
    Object.defineProperty(navigator, "serviceWorker", {
      value: swStub,
      writable: true,
      configurable: true,
    });
  });
  afterAll(() => {
    Object.defineProperty(navigator, "serviceWorker", {
      value: undefined,
      writable: true,
      configurable: true,
    });
  });
  it("renders Paused pill with status role + microcopy when paused", () => {
    renderForcedPaused(
      <DecisionPanel strategy="balanced" />,
      makeContextValue({ pendingDecision: { kind: "bunt" } }),
      true,
    );
    const pill = screen.getByTestId("decision-panel-pause-pill");
    expect(pill).toHaveTextContent(/paused while saves is open/i);
    expect(pill).toHaveAttribute("role", "status");
    expect(pill).toHaveAttribute("aria-live", "polite");
  });

  it("does NOT render the pause pill when not paused", () => {
    renderWithContext(
      <DecisionPanel strategy="balanced" />,
      makeContextValue({ pendingDecision: { kind: "bunt" } }),
    );
    expect(screen.queryByTestId("decision-panel-pause-pill")).toBeNull();
  });

  it("marks decision action buttons as aria-disabled (NOT disabled) when paused", () => {
    renderForcedPaused(
      <DecisionPanel strategy="balanced" />,
      makeContextValue({ pendingDecision: { kind: "bunt" } }),
      true,
    );
    const yesBtn = screen.getByRole("button", { name: /yes, bunt/i });
    const skipBtn = screen.getByRole("button", { name: /skip/i });
    expect(yesBtn).toHaveAttribute("aria-disabled", "true");
    expect(skipBtn).toHaveAttribute("aria-disabled", "true");
    // Native disabled must NOT be set so focus return survives modal close.
    expect(yesBtn).not.toBeDisabled();
    expect(skipBtn).not.toBeDisabled();
  });

  it("links countdown progressbar aria-describedby to pause pill when paused", () => {
    renderForcedPaused(
      <DecisionPanel strategy="balanced" />,
      makeContextValue({ pendingDecision: { kind: "bunt" } }),
      true,
    );
    const bar = screen.getByRole("progressbar", { name: /auto-skip countdown/i });
    expect(bar).toHaveAttribute("aria-describedby", "decision-panel-pause-pill");
  });

  it("does not set aria-describedby on countdown when not paused", () => {
    renderWithContext(
      <DecisionPanel strategy="balanced" />,
      makeContextValue({ pendingDecision: { kind: "bunt" } }),
    );
    const bar = screen.getByRole("progressbar", { name: /auto-skip countdown/i });
    expect(bar).not.toHaveAttribute("aria-describedby");
  });

  it("freezes countdown — does NOT decrement and does NOT auto-skip while paused", () => {
    vi.useFakeTimers();
    const dispatch = vi.fn();
    renderForcedPaused(
      <DecisionPanel strategy="balanced" />,
      makeContextValue({ pendingDecision: { kind: "bunt" }, dispatch }),
      true,
    );
    // Advance well past the auto-skip timeout.
    act(() => {
      vi.advanceTimersByTime(15000);
    });
    // The countdown label must still show the initial value.
    expect(screen.getByText(/auto-skip 10s/i)).toBeInTheDocument();
    // Auto-skip MUST NOT fire while paused.
    expect(dispatch).not.toHaveBeenCalledWith({ type: "skip_decision" });
    vi.useRealTimers();
  });

  it("resumes countdown from the same remaining seconds after pause is released", () => {
    vi.useFakeTimers();
    const dispatch = vi.fn();
    // Pre-build the game context value once; passing a new reference on every
    // render would re-trigger DecisionPanel's pendingDecision effect and reset
    // the countdown back to 10s, masking the actual freeze/resume behavior.
    const ctx = makeContextValue({ pendingDecision: { kind: "bunt" }, dispatch });

    const Harness: React.FC<{ paused: boolean }> = ({ paused }) => (
      <UIPauseContext.Provider
        value={{ isPaused: paused, pushPause: () => {}, popPause: () => {} }}
      >
        <GameContext.Provider value={ctx}>
          <DecisionPanel strategy="balanced" />
        </GameContext.Provider>
      </UIPauseContext.Provider>
    );

    const { rerender } = render(<Harness paused={false} />);
    // Tick 3 seconds — countdown should drop to 7s.
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByText(/auto-skip 7s/i)).toBeInTheDocument();

    // Pause and advance 5 seconds — value must remain at 7s.
    rerender(<Harness paused={true} />);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByText(/auto-skip 7s/i)).toBeInTheDocument();
    expect(dispatch).not.toHaveBeenCalledWith({ type: "skip_decision" });

    // Resume — countdown must continue from 7s, not from 10s and not from
    // a "catch-up" that would skew determinism.
    rerender(<Harness paused={false} />);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText(/auto-skip 6s/i)).toBeInTheDocument();
    vi.useRealTimers();
  });
});
