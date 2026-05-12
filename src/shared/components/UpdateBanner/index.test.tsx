import * as React from "react";

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import UpdateBanner from "./index";

describe("UpdateBanner", () => {
  const onDismiss = vi.fn();
  const onReload = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the update warning message", () => {
    render(<UpdateBanner onDismiss={onDismiss} onReload={onReload} />);
    expect(screen.getByTestId("update-banner")).toBeInTheDocument();
    expect(
      screen.getByText(/new version of BlipIt Baseball Legends is available/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/unexpected game behavior/i)).toBeInTheDocument();
  });

  it("has role=alert for screen-reader accessibility", () => {
    render(<UpdateBanner onDismiss={onDismiss} onReload={onReload} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("calls onReload when the Reload button is clicked", () => {
    render(<UpdateBanner onDismiss={onDismiss} onReload={onReload} />);
    fireEvent.click(screen.getByRole("button", { name: /reload app/i }));
    expect(onReload).toHaveBeenCalledOnce();
  });

  it("calls onDismiss when the dismiss button is clicked", () => {
    render(<UpdateBanner onDismiss={onDismiss} onReload={onReload} />);
    fireEvent.click(screen.getByRole("button", { name: /dismiss update notice/i }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("does not call onReload when dismiss is clicked", () => {
    render(<UpdateBanner onDismiss={onDismiss} onReload={onReload} />);
    fireEvent.click(screen.getByRole("button", { name: /dismiss update notice/i }));
    expect(onReload).not.toHaveBeenCalled();
  });

  it("does not call onDismiss when reload is clicked", () => {
    render(<UpdateBanner onDismiss={onDismiss} onReload={onReload} />);
    fireEvent.click(screen.getByRole("button", { name: /reload app/i }));
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("reload button has aria-label so screen readers skip the emoji — regression for missing aria-label", () => {
    render(<UpdateBanner onDismiss={onDismiss} onReload={onReload} />);
    const btn = screen.getByRole("button", { name: "Reload app" });
    expect(btn.getAttribute("aria-label")).toBe("Reload app");
  });

  it("reload emoji is aria-hidden so screen readers do not announce it — regression for missing aria-hidden", () => {
    render(<UpdateBanner onDismiss={onDismiss} onReload={onReload} />);
    const btn = screen.getByRole("button", { name: "Reload app" });
    const emojiSpan = btn.querySelector("span[aria-hidden]");
    expect(emojiSpan).toBeTruthy();
    expect(emojiSpan!.getAttribute("aria-hidden")).toBe("true");
    expect(emojiSpan!.textContent).toBe("🔄");
  });

  it("warning emoji in message is aria-hidden so screen readers do not announce it", () => {
    render(<UpdateBanner onDismiss={onDismiss} onReload={onReload} />);
    const message = document.querySelector("p");
    const emojiSpan = message?.querySelector("span[aria-hidden]");
    expect(emojiSpan).toBeTruthy();
    expect(emojiSpan!.getAttribute("aria-hidden")).toBe("true");
    expect(emojiSpan!.textContent).toMatch(/⚠️/);
  });
});
