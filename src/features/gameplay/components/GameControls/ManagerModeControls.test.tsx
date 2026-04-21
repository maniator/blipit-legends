import * as React from "react";

import { GameContext } from "@feat/gameplay/context/index";
import { DEFAULT_MANAGER_DECISION_VALUES } from "@feat/gameplay/context/managerDecisionValues";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { makeContextValue } from "@test/testHelpers";

vi.mock("@shared/hooks/useTeamWithRoster", () => ({
  useTeamWithRoster: vi.fn().mockReturnValue(null),
}));

import ManagerModeControls from "./ManagerModeControls";

vi.mock("@feat/customTeams/storage/customTeamStore", () => ({
  CustomTeamStore: {
    getCustomTeam: vi.fn().mockResolvedValue(null),
    listCustomTeams: vi.fn().mockResolvedValue([]),
    createCustomTeam: vi.fn().mockResolvedValue("ct_test"),
    updateCustomTeam: vi.fn().mockResolvedValue(undefined),
    deleteCustomTeam: vi.fn().mockResolvedValue(undefined),
    archiveCustomTeam: vi.fn().mockResolvedValue(undefined),
    unarchiveCustomTeam: vi.fn().mockResolvedValue(undefined),
  },
  makeCustomTeamStore: vi.fn(),
}));

const noop = () => {};

/** Wraps the component with a minimal GameContext (needed for SubstitutionButton). */
const renderWithContext = (ui: React.ReactElement) =>
  render(<GameContext.Provider value={makeContextValue()}>{ui}</GameContext.Provider>);

describe("ManagerModeControls", () => {
  const defaultProps = {
    managerMode: false,
    strategy: "balanced" as const,
    managedTeam: 0 as const,
    teams: ["Yankees", "Red Sox"],
    notifPermission: "granted" as NotificationPermission,
    decisionValues: DEFAULT_MANAGER_DECISION_VALUES,
    onManagerModeChange: noop,
    onStrategyChange: noop,
    onManagedTeamChange: noop,
    onRequestNotifPermission: noop,
    onDecisionValuesChange: noop,
    onDecisionValuesReset: noop,
  };

  it("renders Manager Mode checkbox", () => {
    render(<ManagerModeControls {...defaultProps} />);
    expect(screen.getByRole("checkbox")).toBeTruthy();
    expect(screen.getByText(/manager mode/i)).toBeTruthy();
  });

  it("does not show team/strategy selects when managerMode is false", () => {
    render(<ManagerModeControls {...defaultProps} managerMode={false} />);
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("shows team and strategy selects when managerMode is true", () => {
    render(<ManagerModeControls {...defaultProps} managerMode={true} />);
    expect(screen.getAllByRole("combobox").length).toBe(2);
  });

  it("renders team names in the team selector", () => {
    render(<ManagerModeControls {...defaultProps} managerMode={true} />);
    expect(screen.getByText("Yankees")).toBeTruthy();
    expect(screen.getByText("Red Sox")).toBeTruthy();
  });

  it("renders all 5 strategy options", () => {
    render(<ManagerModeControls {...defaultProps} managerMode={true} />);
    ["balanced", "aggressive", "patient", "contact", "power"].forEach((s) =>
      expect(screen.getByText(new RegExp(s, "i"))).toBeTruthy(),
    );
  });

  it("calls onManagerModeChange when checkbox toggled", async () => {
    const onChange = vi.fn();
    render(<ManagerModeControls {...defaultProps} onManagerModeChange={onChange} />);
    await userEvent.click(screen.getByRole("checkbox"));
    expect(onChange).toHaveBeenCalledOnce();
  });

  it("shows 🔔 on badge when notifPermission is granted", () => {
    render(<ManagerModeControls {...defaultProps} managerMode={true} notifPermission="granted" />);
    expect(screen.getByText(/🔔 on/)).toBeTruthy();
  });

  it("shows blocked badge when notifPermission is denied", () => {
    render(<ManagerModeControls {...defaultProps} managerMode={true} notifPermission="denied" />);
    expect(screen.getByText(/blocked/i)).toBeTruthy();
  });

  it("shows click-to-enable badge when notifPermission is default", () => {
    render(<ManagerModeControls {...defaultProps} managerMode={true} notifPermission="default" />);
    expect(screen.getByText(/click to enable/i)).toBeTruthy();
  });

  it("calls onRequestNotifPermission when click-to-enable badge is clicked", async () => {
    const onRequest = vi.fn();
    render(
      <ManagerModeControls
        {...defaultProps}
        managerMode={true}
        notifPermission="default"
        onRequestNotifPermission={onRequest}
      />,
    );
    await userEvent.click(screen.getByText(/click to enable/i));
    expect(onRequest).toHaveBeenCalledOnce();
  });

  it("does not show notification badge when notifPermission is unavailable", () => {
    render(
      <ManagerModeControls {...defaultProps} managerMode={true} notifPermission="unavailable" />,
    );
    expect(screen.queryByText(/🔔 on/)).toBeNull();
    expect(screen.queryByText(/blocked/)).toBeNull();
    expect(screen.queryByText(/click to enable/)).toBeNull();
  });

  it("shows substitution button when managerMode is true, gameStarted is true, and gameOver is false", () => {
    renderWithContext(
      <ManagerModeControls
        {...defaultProps}
        managerMode={true}
        gameStarted={true}
        gameOver={false}
      />,
    );
    expect(screen.getByRole("button", { name: /substitution/i })).toBeTruthy();
  });

  it("hides substitution button when gameStarted is false", () => {
    renderWithContext(
      <ManagerModeControls
        {...defaultProps}
        managerMode={true}
        gameStarted={false}
        gameOver={false}
      />,
    );
    expect(screen.queryByRole("button", { name: /substitution/i })).toBeNull();
  });

  it("hides substitution button when gameOver is true", () => {
    renderWithContext(
      <ManagerModeControls
        {...defaultProps}
        managerMode={true}
        gameStarted={true}
        gameOver={true}
      />,
    );
    expect(screen.queryByRole("button", { name: /substitution/i })).toBeNull();
  });

  it("hides substitution button when managerMode is false", () => {
    renderWithContext(
      <ManagerModeControls
        {...defaultProps}
        managerMode={false}
        gameStarted={true}
        gameOver={false}
      />,
    );
    expect(screen.queryByRole("button", { name: /substitution/i })).toBeNull();
  });

  it("shows Decision Tuning toggle when managerMode is true", () => {
    render(<ManagerModeControls {...defaultProps} managerMode={true} />);
    expect(screen.getByTestId("manager-decision-tuning-toggle")).toBeTruthy();
  });

  it("shows Decision Tuning toggle even when managerMode is false (panel is always accessible)", () => {
    render(<ManagerModeControls {...defaultProps} managerMode={false} />);
    expect(screen.getByTestId("manager-decision-tuning-toggle")).toBeTruthy();
  });

  it("does not show Decision Tuning panel until toggle is clicked", () => {
    render(<ManagerModeControls {...defaultProps} managerMode={true} />);
    expect(screen.queryByTestId("manager-decision-tuning-panel")).toBeNull();
  });

  it("shows Decision Tuning panel after toggle is clicked", async () => {
    render(<ManagerModeControls {...defaultProps} managerMode={true} />);
    await userEvent.click(screen.getByTestId("manager-decision-tuning-toggle"));
    expect(screen.getByTestId("manager-decision-tuning-panel")).toBeTruthy();
  });

  it("calls onDecisionValuesReset when reset button is clicked", async () => {
    const onReset = vi.fn();
    render(
      <ManagerModeControls {...defaultProps} managerMode={true} onDecisionValuesReset={onReset} />,
    );
    await userEvent.click(screen.getByTestId("manager-decision-tuning-toggle"));
    await userEvent.click(screen.getByTestId("manager-decision-tuning-reset"));
    expect(onReset).toHaveBeenCalledOnce();
  });

  it("renders the Steal attempts toggle (defaults checked) and propagates change", async () => {
    const onChange = vi.fn();
    render(
      <ManagerModeControls
        {...defaultProps}
        managerMode={true}
        onDecisionValuesChange={onChange}
      />,
    );
    await userEvent.click(screen.getByTestId("manager-decision-tuning-toggle"));
    const stealToggle = screen.getByTestId("steal-enabled-toggle") as HTMLInputElement;
    expect(stealToggle.checked).toBe(true);
    await userEvent.click(stealToggle);
    expect(onChange).toHaveBeenCalled();
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(lastCall.stealEnabled).toBe(false);
  });

  it("AI pitching aggressiveness label uses ±4 deadband around default 50 ('Modern')", async () => {
    // Anything within ±4 of the default 50 reads as "Modern" so small slider
    // nudges don't flip the label between Modern / Old-school / Bullpen.
    const renderWithAggressiveness = (val: number) =>
      render(
        <ManagerModeControls
          {...defaultProps}
          managerMode={true}
          decisionValues={{
            ...DEFAULT_MANAGER_DECISION_VALUES,
            aiPitchingChangeAggressiveness: val,
          }}
        />,
      );

    // Lower edge of the deadband (46): label should read "Modern (46)".
    let { unmount } = renderWithAggressiveness(46);
    await userEvent.click(screen.getByTestId("manager-decision-tuning-toggle"));
    expect(screen.getByTestId("ai-pitching-aggressiveness-value").textContent).toBe("Modern (46)");
    unmount();

    // Default (50): label should read "Modern (50)".
    ({ unmount } = renderWithAggressiveness(50));
    await userEvent.click(screen.getByTestId("manager-decision-tuning-toggle"));
    expect(screen.getByTestId("ai-pitching-aggressiveness-value").textContent).toBe("Modern (50)");
    unmount();

    // Upper edge of the deadband (54): still "Modern".
    ({ unmount } = renderWithAggressiveness(54));
    await userEvent.click(screen.getByTestId("manager-decision-tuning-toggle"));
    expect(screen.getByTestId("ai-pitching-aggressiveness-value").textContent).toBe("Modern (54)");
    unmount();

    // Just below the deadband (45): switches to "Old-school".
    ({ unmount } = renderWithAggressiveness(45));
    await userEvent.click(screen.getByTestId("manager-decision-tuning-toggle"));
    expect(screen.getByTestId("ai-pitching-aggressiveness-value").textContent).toBe(
      "Old-school (45)",
    );
    unmount();

    // Just above the deadband (55): switches to "Bullpen".
    ({ unmount } = renderWithAggressiveness(55));
    await userEvent.click(screen.getByTestId("manager-decision-tuning-toggle"));
    expect(screen.getByTestId("ai-pitching-aggressiveness-value").textContent).toBe("Bullpen (55)");
    unmount();
  });

  it("Decision Tuning tooltips are tappable on touch devices (no native title-attribute reliance)", async () => {
    // Regression test for: native `<span title="…">` tooltips do not display on
    // touch devices (no hover state). The Decision Tuning panel uses
    // <TouchTooltip> instead so the explanations are reachable on a Pixel 8a
    // and other phones via tap.
    render(<ManagerModeControls {...defaultProps} managerMode={true} />);
    await userEvent.click(screen.getByTestId("manager-decision-tuning-toggle"));

    // Find every tooltip trigger inside the panel — they're the only buttons
    // with the ⓘ glyph as content.
    const triggers = screen.getAllByRole("button").filter((b) => b.textContent?.includes("ⓘ"));
    // 8 tooltip rows in the panel.
    expect(triggers.length).toBe(8);

    // Pick the first one and tap it — the role=tooltip bubble must appear.
    const first = triggers[0]!;
    expect(first.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("tooltip")).toBeNull();
    await userEvent.click(first);
    expect(first.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("tooltip").textContent).toMatch(/steal/i);

    // Tap again to dismiss.
    await userEvent.click(first);
    expect(first.getAttribute("aria-expanded")).toBe("false");
  });
});
