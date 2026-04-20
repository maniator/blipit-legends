import * as React from "react";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it } from "vitest";

import HelpPage from "./index";

function renderHelpPage() {
  return render(
    <MemoryRouter initialEntries={["/help"]}>
      <Routes>
        <Route path="/help" element={<HelpPage />} />
        <Route index element={<div data-testid="home-screen" />} />
        <Route path="/" element={<div data-testid="home-screen" />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("HelpPage", () => {
  it("renders the help page", () => {
    renderHelpPage();
    expect(screen.getByTestId("help-page")).toBeInTheDocument();
  });

  it("shows the How to Play heading", () => {
    renderHelpPage();
    expect(screen.getByText(/how to play/i)).toBeInTheDocument();
  });

  it("shows a back button", () => {
    renderHelpPage();
    expect(screen.getByTestId("help-page-back-button")).toBeInTheDocument();
  });

  it("back button navigates back in history", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/", "/help"]}>
        <Routes>
          <Route path="/" element={<div data-testid="home-screen" />} />
          <Route path="/help" element={<HelpPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId("help-page")).toBeInTheDocument();
    await user.click(screen.getByTestId("help-page-back-button"));
    expect(screen.getByTestId("home-screen")).toBeInTheDocument();
  });

  it("shows help content sections", () => {
    renderHelpPage();
    expect(screen.getByText("Basics")).toBeInTheDocument();
    expect(screen.getByText("Game Flow")).toBeInTheDocument();
    // Manager Mode appears as a section header and in body text — use getAllBy
    expect(screen.getAllByText(/manager mode/i).length).toBeGreaterThan(0);
    expect(screen.getByText("Saves")).toBeInTheDocument();
  });

  it("renders all 10 accordion sections", () => {
    renderHelpPage();
    const helpPage = screen.getByTestId("help-page");
    // <details> elements have implicit ARIA role "group" — scope to the container.
    const details = within(helpPage).getAllByRole("group");
    expect(details).toHaveLength(10);
    // Spot-check section titles via <summary> scoped to the container.
    const rawSummaries = Array.from(helpPage.querySelectorAll("summary")).map((s) =>
      s.textContent?.trim(),
    );
    expect(rawSummaries).toContain("Basics");
    expect(rawSummaries).toContain("Game Flow");
    expect(rawSummaries).toContain("Manager Mode");
    expect(rawSummaries).toContain("Hit types");
    expect(rawSummaries).toContain("Saves");
    expect(rawSummaries).toContain("Player Stats");
    expect(rawSummaries).toContain("Reporting issues");
  });

  it("Reporting issues section mentions Contact / Report Bug", () => {
    renderHelpPage();
    expect(screen.getByText(/Contact \/ Report Bug/i)).toBeInTheDocument();
  });

  it("each section has a summary (accordion toggle) and non-empty body content", () => {
    renderHelpPage();
    const helpPage = screen.getByTestId("help-page");
    const details = Array.from(helpPage.querySelectorAll("details"));
    for (const d of details) {
      const summary = d.querySelector("summary");
      expect(summary).toBeTruthy();
      // Body text (everything after the summary) must be non-empty.
      const bodyText = Array.from(d.childNodes)
        .filter((node) => node !== summary)
        .map((node) => node.textContent ?? "")
        .join("")
        .trim();
      expect(bodyText.length).toBeGreaterThan(0);
    }
  });
});
