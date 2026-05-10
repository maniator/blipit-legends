import * as React from "react";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import TouchTooltip from "./index";

describe("TouchTooltip", () => {
  it("renders the trigger glyph (defaults to ⓘ) with aria-label and native title; bubble describes when open", async () => {
    render(<TouchTooltip label="hello world" triggerTestId="tt" />);
    const trigger = screen.getByTestId("tt");
    expect(trigger.textContent).toContain("ⓘ");
    expect(trigger.getAttribute("aria-label")).toBe("More info");
    expect(trigger.getAttribute("title")).toBe("hello world");
    // While closed, the bubble is not referenced from the trigger so screen
    // readers do not announce it as part of the button name/description.
    expect(trigger.getAttribute("aria-describedby")).toBeNull();
    // Bubble is in DOM but has the HTML `hidden` attribute while closed.
    const bubble = screen.getByRole("tooltip", { hidden: true });
    expect(bubble).toHaveAttribute("hidden");
    expect(bubble.getAttribute("aria-hidden")).toBe("true");

    // Opening the tooltip wires the trigger to the bubble via aria-describedby
    // and removes the `hidden` attribute.
    await userEvent.click(trigger);
    expect(trigger.getAttribute("aria-describedby")).toBe(bubble.getAttribute("id"));
    expect(bubble.getAttribute("aria-hidden")).toBe("false");
    expect(bubble).not.toHaveAttribute("hidden");
  });

  it("starts closed (aria-expanded=false, hidden attribute present) and opens on click (mobile-tap support)", async () => {
    render(<TouchTooltip label="explain" triggerTestId="tt" />);
    const trigger = screen.getByTestId("tt");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    await userEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    // The bubble (role=tooltip) is in the DOM and contains the label text.
    const bubble = screen.getByRole("tooltip");
    expect(bubble.textContent).toContain("explain");
    expect(bubble).not.toHaveAttribute("hidden");
  });

  it("toggles closed on a second tap on the trigger", async () => {
    render(<TouchTooltip label="explain" triggerTestId="tt" />);
    const trigger = screen.getByTestId("tt");
    await userEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    await userEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("closes when a pointer-down occurs outside the tooltip", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <button data-testid="outside">outside</button>
        <TouchTooltip label="explain" triggerTestId="tt" />
      </div>,
    );
    const trigger = screen.getByTestId("tt");
    await user.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    // Tap outside the wrapper. user.click dispatches a real pointerdown that
    // bubbles to document, which is what our outside-click handler listens for.
    await user.click(screen.getByTestId("outside"));
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("closes when Escape is pressed", async () => {
    render(<TouchTooltip label="explain" triggerTestId="tt" />);
    const trigger = screen.getByTestId("tt");
    await userEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    await userEvent.keyboard("{Escape}");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("renders custom child glyph instead of the default ⓘ", () => {
    render(
      <TouchTooltip label="explain" triggerTestId="tt">
        ❓
      </TouchTooltip>,
    );
    expect(screen.getByTestId("tt").textContent).toContain("❓");
  });

  it("renders the × close button inside the bubble (for touch devices)", async () => {
    render(<TouchTooltip label="explain" triggerTestId="tt" />);
    const trigger = screen.getByTestId("tt");
    await userEvent.click(trigger);
    // The close button is rendered inside the bubble; CSS hides it on non-touch
    // devices but it is always in the DOM when open.
    const closeBtn = screen.getByTestId("touch-tooltip-close");
    expect(closeBtn).toBeInTheDocument();
    expect(closeBtn.getAttribute("aria-label")).toBe("Dismiss tooltip");
  });

  it("closes when the × close button inside the bubble is clicked", async () => {
    render(<TouchTooltip label="explain" triggerTestId="tt" />);
    const trigger = screen.getByTestId("tt");
    await userEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    const closeBtn = screen.getByTestId("touch-tooltip-close");
    await userEvent.click(closeBtn);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("bubble has hidden attribute when closed and lacks it when open", async () => {
    render(<TouchTooltip label="explain" triggerTestId="tt" />);
    const trigger = screen.getByTestId("tt");
    const bubble = screen.getByTestId("touch-tooltip-bubble");

    // Closed — hidden attribute present
    expect(bubble).toHaveAttribute("hidden");

    // Open — hidden attribute removed
    await userEvent.click(trigger);
    expect(bubble).not.toHaveAttribute("hidden");

    // Close again — hidden attribute restored
    await userEvent.click(trigger);
    expect(bubble).toHaveAttribute("hidden");
  });
});
