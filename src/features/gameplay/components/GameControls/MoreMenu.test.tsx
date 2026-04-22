import * as React from "react";

import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import MoreMenu from "./MoreMenu";

describe("MoreMenu (mobile game-header disclosure)", () => {
  beforeEach(() => {
    // jsdom's matchMedia is undefined by default; provide a minimal stub so
    // styled-components' media-query CSS doesn't throw if it inspects it.
    if (!window.matchMedia) {
      (window as any).matchMedia = (q: string) => ({
        matches: false,
        media: q,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      });
    }
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  const renderMenu = (props: { disabled?: boolean } = {}) =>
    render(
      <MoreMenu disabled={props.disabled}>
        <button type="button" data-testid="first-control">
          First
        </button>
        <button type="button" data-testid="second-control">
          Second
        </button>
      </MoreMenu>,
    );

  it("renders trigger labeled 'More' with aria-expanded=false initially", () => {
    renderMenu();
    const trigger = screen.getByTestId("game-header-more-trigger");
    expect(trigger).toHaveTextContent(/^More/);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveAttribute("aria-controls", "game-header-more");
    expect(trigger).toHaveAttribute("aria-haspopup", "true");
    expect(trigger).toHaveAttribute("aria-label", "More game controls");
  });

  it("renders panel with role=region and correct aria-label", async () => {
    const user = userEvent.setup();
    renderMenu();
    // Open the panel so it's exposed to the accessibility tree.
    await user.click(screen.getByTestId("game-header-more-trigger"));
    const panel = screen.getByRole("region", { name: "Additional game controls" });
    expect(panel).toHaveAttribute("id", "game-header-more");
    expect(panel).toHaveAttribute("data-state", "open");
  });

  it("toggles aria-expanded and label when clicked", async () => {
    const user = userEvent.setup();
    renderMenu();
    const trigger = screen.getByTestId("game-header-more-trigger");
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(trigger).toHaveTextContent(/^Less/);
    const panel = screen.getByTestId("game-header-more-panel");
    expect(panel).toHaveAttribute("data-state", "open");
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveTextContent(/^More/);
  });

  it("moves focus to the first control on open and back to trigger on close", async () => {
    const user = userEvent.setup();
    renderMenu();
    const trigger = screen.getByTestId("game-header-more-trigger");
    await user.click(trigger);
    // requestAnimationFrame is invoked on open — flush it.
    await act(async () => {
      await new Promise((r) => requestAnimationFrame(() => r(undefined)));
    });
    expect(document.activeElement).toBe(screen.getByTestId("first-control"));
    await user.click(trigger);
    expect(document.activeElement).toBe(trigger);
  });

  it("Escape closes the panel", async () => {
    const user = userEvent.setup();
    renderMenu();
    const trigger = screen.getByTestId("game-header-more-trigger");
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("click outside closes the panel", async () => {
    const user = userEvent.setup();
    renderMenu();
    const trigger = screen.getByTestId("game-header-more-trigger");
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    // Dispatch a mousedown on the document body (outside both trigger & panel).
    fireEvent.mouseDown(document.body);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("trigger is aria-disabled while a manager decision is active", async () => {
    const user = userEvent.setup();
    const { rerender } = renderMenu({ disabled: true });
    const trigger = screen.getByTestId("game-header-more-trigger");
    expect(trigger).toHaveAttribute("aria-disabled", "true");
    expect(trigger).toHaveAttribute("title", "Available after the decision");
    // Clicking while disabled does nothing.
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    // When the decision resolves (disabled flips back to false), the panel
    // remains closed but the trigger becomes interactive again.
    rerender(
      <MoreMenu disabled={false}>
        <button type="button" data-testid="first-control">
          First
        </button>
      </MoreMenu>,
    );
    expect(trigger).not.toHaveAttribute("aria-disabled");
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("auto-collapses when disabled flips to true while open", async () => {
    const user = userEvent.setup();
    const { rerender } = renderMenu({ disabled: false });
    const trigger = screen.getByTestId("game-header-more-trigger");
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    rerender(
      <MoreMenu disabled={true}>
        <button type="button" data-testid="first-control">
          First
        </button>
      </MoreMenu>,
    );
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveAttribute("aria-disabled", "true");
  });
});
