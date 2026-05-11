import * as React from "react";

import {
  DEFAULT_MANAGER_DECISION_VALUES,
  STEAL_PCT_MAX,
} from "@feat/gameplay/context/managerDecisionValues";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import ManagerDecisionValuesPanel from "./ManagerDecisionValuesPanel";

const noop = () => {};

const defaultProps = {
  values: DEFAULT_MANAGER_DECISION_VALUES,
  onChange: noop,
  onReset: noop,
};

describe("ManagerDecisionValuesPanel", () => {
  it("shows '⚙️ Decision Tuning' toggle label in normal mode", () => {
    render(<ManagerDecisionValuesPanel {...defaultProps} />);
    expect(screen.getByTestId("manager-decision-tuning-toggle").textContent).toMatch(
      /Decision Tuning/,
    );
  });

  it("toggle label includes '· defaults' when all values equal defaults", () => {
    render(<ManagerDecisionValuesPanel {...defaultProps} />);
    expect(screen.getByTestId("manager-decision-tuning-toggle").textContent).toContain(
      "· defaults",
    );
  });

  it("toggle label does NOT include '· defaults' when a value differs from defaults", () => {
    const modified = { ...DEFAULT_MANAGER_DECISION_VALUES, aiStealThreshold: 80 };
    render(<ManagerDecisionValuesPanel {...defaultProps} values={modified} />);
    expect(screen.getByTestId("manager-decision-tuning-toggle").textContent).not.toContain(
      "· defaults",
    );
  });

  it("does not show panel until toggle is clicked", () => {
    render(<ManagerDecisionValuesPanel {...defaultProps} />);
    expect(screen.queryByTestId("manager-decision-tuning-panel")).toBeNull();
  });

  it("shows panel after toggle is clicked", async () => {
    render(<ManagerDecisionValuesPanel {...defaultProps} />);
    await userEvent.click(screen.getByTestId("manager-decision-tuning-toggle"));
    expect(screen.getByTestId("manager-decision-tuning-panel")).toBeTruthy();
  });

  it("panel title is 'Manager & AI Decision Values' in normal mode", async () => {
    render(<ManagerDecisionValuesPanel {...defaultProps} />);
    await userEvent.click(screen.getByTestId("manager-decision-tuning-toggle"));
    expect(screen.getByTestId("manager-decision-tuning-panel").textContent).toMatch(
      /Manager & AI Decision Values/,
    );
  });

  it("calls onReset when reset button is clicked (requires confirmation)", async () => {
    const onReset = vi.fn();
    render(<ManagerDecisionValuesPanel {...defaultProps} onReset={onReset} />);
    await userEvent.click(screen.getByTestId("manager-decision-tuning-toggle"));
    await userEvent.click(screen.getByTestId("manager-decision-tuning-reset"));
    expect(onReset).not.toHaveBeenCalled();
    expect(screen.getByTestId("manager-decision-tuning-reset-confirm-row")).toBeTruthy();
    await userEvent.click(screen.getByTestId("manager-decision-tuning-reset-confirm"));
    expect(onReset).toHaveBeenCalledOnce();
  });

  it("renders the Steal attempts toggle (defaults checked) and propagates change", async () => {
    const onChange = vi.fn();
    render(<ManagerDecisionValuesPanel {...defaultProps} onChange={onChange} />);
    await userEvent.click(screen.getByTestId("manager-decision-tuning-toggle"));
    const stealToggle = screen.getByTestId("steal-enabled-toggle") as HTMLInputElement;
    expect(stealToggle.checked).toBe(true);
    await userEvent.click(stealToggle);
    expect(onChange).toHaveBeenCalled();
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(lastCall.stealEnabled).toBe(false);
  });

  it("AI pitching aggressiveness label uses ±4 deadband around default 50 ('Modern')", async () => {
    const renderWithAggressiveness = (val: number) =>
      render(
        <ManagerDecisionValuesPanel
          {...defaultProps}
          values={{ ...DEFAULT_MANAGER_DECISION_VALUES, aiPitchingChangeAggressiveness: val }}
        />,
      );

    let { unmount } = renderWithAggressiveness(46);
    await userEvent.click(screen.getByTestId("manager-decision-tuning-toggle"));
    expect(screen.getByTestId("ai-pitching-aggressiveness-value").textContent).toBe("Modern (46)");
    unmount();

    ({ unmount } = renderWithAggressiveness(50));
    await userEvent.click(screen.getByTestId("manager-decision-tuning-toggle"));
    expect(screen.getByTestId("ai-pitching-aggressiveness-value").textContent).toBe("Modern (50)");
    unmount();

    ({ unmount } = renderWithAggressiveness(54));
    await userEvent.click(screen.getByTestId("manager-decision-tuning-toggle"));
    expect(screen.getByTestId("ai-pitching-aggressiveness-value").textContent).toBe("Modern (54)");
    unmount();

    ({ unmount } = renderWithAggressiveness(45));
    await userEvent.click(screen.getByTestId("manager-decision-tuning-toggle"));
    expect(screen.getByTestId("ai-pitching-aggressiveness-value").textContent).toBe(
      "Old-school (45)",
    );
    unmount();

    ({ unmount } = renderWithAggressiveness(55));
    await userEvent.click(screen.getByTestId("manager-decision-tuning-toggle"));
    expect(screen.getByTestId("ai-pitching-aggressiveness-value").textContent).toBe("Bullpen (55)");
    unmount();
  });

  it("Decision Tuning tooltips are tappable on touch devices", async () => {
    render(<ManagerDecisionValuesPanel {...defaultProps} />);
    await userEvent.click(screen.getByTestId("manager-decision-tuning-toggle"));
    const triggers = screen.getAllByRole("button").filter((b) => b.textContent?.includes("ⓘ"));
    // 8 tooltip rows in normal mode.
    expect(triggers.length).toBe(8);
    const first = triggers[0]!;
    expect(first.getAttribute("aria-expanded")).toBe("false");
    await userEvent.click(first);
    expect(first.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("tooltip").textContent).toMatch(/steal/i);
    await userEvent.click(first);
    expect(first.getAttribute("aria-expanded")).toBe("false");
  });

  describe("spectatorMode", () => {
    it("shows '⚙️ Simulation Style' toggle label", () => {
      render(<ManagerDecisionValuesPanel {...defaultProps} spectatorMode />);
      expect(screen.getByTestId("manager-decision-tuning-toggle").textContent).toMatch(
        /Simulation Style/,
      );
    });

    it("panel title is 'AI Simulation Style'", async () => {
      render(<ManagerDecisionValuesPanel {...defaultProps} spectatorMode />);
      await userEvent.click(screen.getByTestId("manager-decision-tuning-toggle"));
      expect(screen.getByTestId("manager-decision-tuning-panel").textContent).toMatch(
        /AI Simulation Style/,
      );
    });

    it("hides player-facing controls (steal master switch, offer threshold, bunt, IBB, pinch hitter, defensive shift)", async () => {
      render(<ManagerDecisionValuesPanel {...defaultProps} spectatorMode />);
      await userEvent.click(screen.getByTestId("manager-decision-tuning-toggle"));
      expect(screen.queryByTestId("steal-enabled-toggle")).toBeNull();
      expect(screen.queryByTestId("manager-steal-min-pct-slider")).toBeNull();
      expect(screen.queryByTestId("bunt-enabled-toggle")).toBeNull();
      expect(screen.queryByTestId("ibb-enabled-toggle")).toBeNull();
      expect(screen.queryByTestId("pinch-hitter-enabled-toggle")).toBeNull();
      expect(screen.queryByTestId("defensive-shift-enabled-toggle")).toBeNull();
    });

    it("shows AI steal threshold slider (not disabled)", async () => {
      render(<ManagerDecisionValuesPanel {...defaultProps} spectatorMode />);
      await userEvent.click(screen.getByTestId("manager-decision-tuning-toggle"));
      const slider = screen.getByTestId("ai-steal-threshold-slider") as HTMLInputElement;
      expect(slider).toBeTruthy();
      expect(slider.disabled).toBe(false);
      expect(slider.max).toBe(String(STEAL_PCT_MAX));
    });

    it("shows AI pitching aggressiveness slider", async () => {
      render(<ManagerDecisionValuesPanel {...defaultProps} spectatorMode />);
      await userEvent.click(screen.getByTestId("manager-decision-tuning-toggle"));
      expect(screen.getByTestId("ai-pitching-aggressiveness-slider")).toBeTruthy();
    });

    it("reset still works in spectator mode", async () => {
      const onReset = vi.fn();
      render(<ManagerDecisionValuesPanel {...defaultProps} spectatorMode onReset={onReset} />);
      await userEvent.click(screen.getByTestId("manager-decision-tuning-toggle"));
      await userEvent.click(screen.getByTestId("manager-decision-tuning-reset"));
      await userEvent.click(screen.getByTestId("manager-decision-tuning-reset-confirm"));
      expect(onReset).toHaveBeenCalledOnce();
    });
  });
});
