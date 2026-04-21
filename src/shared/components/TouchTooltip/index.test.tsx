import * as React from "react";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import TouchTooltip from "./index";

describe("TouchTooltip", () => {
  it("renders the trigger glyph (defaults to ⓘ) with aria-label and native title", () => {
    render(<TouchTooltip label="hello world" triggerTestId="tt" />);
    const trigger = screen.getByTestId("tt");
    expect(trigger.textContent).toContain("ⓘ");
    expect(trigger.getAttribute("aria-label")).toBe("hello world");
    expect(trigger.getAttribute("title")).toBe("hello world");
  });

  it("starts closed (aria-expanded=false) and opens on click (mobile-tap support)", async () => {
    render(<TouchTooltip label="explain" triggerTestId="tt" />);
    const trigger = screen.getByTestId("tt");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    await userEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    // The bubble (role=tooltip) is in the DOM and contains the label text.
    const bubble = screen.getByRole("tooltip");
    expect(bubble.textContent).toBe("explain");
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
});
