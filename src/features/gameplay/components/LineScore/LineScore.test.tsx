import * as React from "react";

import type { ContextValue } from "@feat/gameplay/context/index";
import { GameContext } from "@feat/gameplay/context/index";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { makeContextValue } from "@test/testHelpers";

import LineScore from ".";

vi.mock("@shared/hooks/useTeamWithRoster", () => ({
  useTeamWithRoster: vi.fn((teamId: string | undefined) => {
    if (teamId === "ct_linescore_away") {
      return {
        id: "ct_linescore_away",
        name: "Red Sox",
        city: "",
        abbreviation: "RSX",
        schemaVersion: 1,
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
        roster: { schemaVersion: 1, lineup: [], bench: [], pitchers: [] },
        metadata: { archived: false },
      };
    }
    if (teamId === "ct_linescore_home") {
      return {
        id: "ct_linescore_home",
        name: "Yankees",
        city: "",
        abbreviation: "YNK",
        schemaVersion: 1,
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
        roster: { schemaVersion: 1, lineup: [], bench: [], pitchers: [] },
        metadata: { archived: false },
      };
    }
    return null;
  }),
}));

const renderWithContext = (ui: React.ReactElement, ctx: ContextValue = makeContextValue()) =>
  render(<GameContext.Provider value={ctx}>{ui}</GameContext.Provider>);

// ---------------------------------------------------------------------------
// getCellValue — pure logic replicated from LineScore/index.tsx for isolation
// ---------------------------------------------------------------------------
function getCellValue(
  team: 0 | 1,
  n: number,
  inning: number,
  atBat: 0 | 1,
  gameOver: boolean,
  inningRuns: [number[], number[]],
): string | number {
  const hasStarted =
    team === 0
      ? n <= inning
      : n < inning || (n === inning && atBat === 1) || (n === inning && gameOver);
  if (!hasStarted) return "-";
  return inningRuns[team][n - 1] ?? 0;
}

describe("getCellValue — away team (top of inning)", () => {
  it("shows 0 for innings already played with no runs", () => {
    expect(getCellValue(0, 1, 3, 0, false, [[], []])).toBe(0);
  });

  it("shows actual runs for an inning that has been played", () => {
    const runs: [number[], number[]] = [[0, 2, 1], []];
    expect(getCellValue(0, 2, 3, 0, false, runs)).toBe(2);
  });

  it("shows '-' for future innings (away team)", () => {
    expect(getCellValue(0, 5, 3, 0, false, [[], []])).toBe("-");
  });

  it("shows current inning as started (away team bats top)", () => {
    expect(getCellValue(0, 4, 4, 0, false, [[], []])).toBe(0);
  });
});

describe("getCellValue — home team (bottom of inning)", () => {
  it("shows '-' for current inning when it is the top half (away batting)", () => {
    expect(getCellValue(1, 5, 5, 0, false, [[], []])).toBe("-");
  });

  it("shows 0 for current inning when it is the bottom half (home batting)", () => {
    expect(getCellValue(1, 5, 5, 1, false, [[], []])).toBe(0);
  });

  it("shows actual runs for a past inning (home team)", () => {
    const runs: [number[], number[]] = [[], [0, 3, 0]];
    expect(getCellValue(1, 2, 5, 0, false, runs)).toBe(3);
  });

  it("shows '-' for a future inning (home team)", () => {
    expect(getCellValue(1, 8, 5, 0, false, [[], []])).toBe("-");
  });

  it("shows 0 for current inning when gameOver=true (final score visible)", () => {
    expect(getCellValue(1, 9, 9, 0, true, [[], []])).toBe(0);
  });

  it("shows '-' for inning after game-over inning", () => {
    expect(getCellValue(1, 10, 9, 0, true, [[], []])).toBe("-");
  });
});

describe("getCellValue — extra innings", () => {
  it("shows runs scored in inning 10 (extra innings)", () => {
    const runs: [number[], number[]] = [
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ];
    expect(getCellValue(0, 10, 10, 0, false, runs)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// LineScore component
// ---------------------------------------------------------------------------
describe("LineScore", () => {
  it("shows both team names", () => {
    renderWithContext(
      <LineScore />,
      makeContextValue({ teams: ["ct_linescore_away", "ct_linescore_home"] }),
    );
    // Each team name is rendered in two spans (mobile label + full label) for
    // responsive CSS toggling — use getAllByText to handle both occurrences.
    expect(screen.getAllByText("Red Sox").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Yankees").length).toBeGreaterThanOrEqual(1);
  });

  it("shows fallback for unknown custom team IDs", () => {
    // Unknown ct_* IDs — component renders without crashing; empty labels are the fallback.
    renderWithContext(
      <LineScore />,
      makeContextValue({ teams: ["ct_unknown_away", "ct_unknown_home"] }),
    );
    expect(screen.getByTestId("scoreboard")).toBeInTheDocument();
  });

  it("shows R (runs) totals for each team", () => {
    renderWithContext(<LineScore />, makeContextValue({ score: [4, 2] }));
    const values = screen.getAllByText(/^[0-9]+$/).map((c) => c.textContent);
    expect(values).toContain("4");
    expect(values).toContain("2");
  });

  it("shows FINAL banner when gameOver is true", () => {
    renderWithContext(<LineScore />, makeContextValue({ gameOver: true }));
    expect(screen.getByTestId("game-over-banner")).toBeInTheDocument();
  });

  it("does not show FINAL banner when game is in progress", () => {
    renderWithContext(<LineScore />, makeContextValue({ gameOver: false }));
    expect(screen.queryByTestId("game-over-banner")).not.toBeInTheDocument();
  });

  it("renders BSO dot groups (B / S / O labels)", () => {
    renderWithContext(<LineScore />, makeContextValue({ balls: 2, strikes: 1, outs: 1 }));
    expect(screen.getByText("B")).toBeInTheDocument();
    expect(screen.getByText("S")).toBeInTheDocument();
    expect(screen.getByText("O")).toBeInTheDocument();
  });

  it("shows inning numbers in header row", () => {
    renderWithContext(<LineScore />, makeContextValue({ inning: 3 }));
    expect(screen.getAllByText("1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("3").length).toBeGreaterThan(0);
  });

  it("shows only 9 inning columns when game ends after regulation play", () => {
    renderWithContext(<LineScore />, makeContextValue({ inning: 10, atBat: 0, gameOver: true }));
    expect(screen.queryByText("10")).not.toBeInTheDocument();
    expect(screen.getByText("9")).toBeInTheDocument();
  });

  it("shows 9 inning columns for a walk-off win in the bottom of the 9th", () => {
    // Walk-off: atBat === 1, inning === 9 — no increment happened, so no adjustment needed.
    renderWithContext(<LineScore />, makeContextValue({ inning: 9, atBat: 1, gameOver: true }));
    expect(screen.getByText("9")).toBeInTheDocument();
    expect(screen.queryByText("10")).not.toBeInTheDocument();
  });

  it("shows 10 inning columns for a real extra-inning game in progress", () => {
    renderWithContext(<LineScore />, makeContextValue({ inning: 10, atBat: 0, gameOver: false }));
    expect(screen.getAllByText("10").length).toBeGreaterThan(0);
  });

  it("shows only 10 inning columns when extra-inning game ends after the 10th inning", () => {
    renderWithContext(<LineScore />, makeContextValue({ inning: 11, atBat: 0, gameOver: true }));
    expect(screen.queryByText("11")).not.toBeInTheDocument();
    expect(screen.getAllByText("10").length).toBeGreaterThan(0);
  });

  it("shows EXTRA INNINGS banner when inning > 9 and game is in progress", () => {
    renderWithContext(<LineScore />, makeContextValue({ inning: 10, gameOver: false }));
    expect(screen.getByText("EXTRA INNINGS")).toBeInTheDocument();
  });

  it("does not show EXTRA INNINGS banner when gameOver is true", () => {
    renderWithContext(<LineScore />, makeContextValue({ inning: 10, gameOver: true }));
    expect(screen.queryByText("EXTRA INNINGS")).not.toBeInTheDocument();
  });

  it("does not show EXTRA INNINGS banner in inning 9 or earlier", () => {
    renderWithContext(<LineScore />, makeContextValue({ inning: 9, gameOver: false }));
    expect(screen.queryByText("EXTRA INNINGS")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// F5 BSO accessibility (Story 6.1)
// ---------------------------------------------------------------------------
describe("LineScore — BSO accessibility (F5)", () => {
  it("renders BSO status container with role=status, aria-live=polite, aria-atomic=true", () => {
    renderWithContext(<LineScore />, makeContextValue({ balls: 2, strikes: 1, outs: 0 }));
    const status = document.querySelector('[role="status"]');
    expect(status).toBeInTheDocument();
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveAttribute("aria-atomic", "true");
  });

  it("computes plural aria-label correctly for balls > 1, strikes > 1, outs > 1", () => {
    renderWithContext(<LineScore />, makeContextValue({ balls: 3, strikes: 2, outs: 1 }));
    const status = document.querySelector('[role="status"]');
    expect(status).toHaveAttribute("aria-label", "Count: 3 balls, 2 strikes, 1 out");
  });

  it("computes singular aria-label for balls=1, strikes=1, outs=1", () => {
    renderWithContext(<LineScore />, makeContextValue({ balls: 1, strikes: 1, outs: 1 }));
    const status = document.querySelector('[role="status"]');
    expect(status).toHaveAttribute("aria-label", "Count: 1 ball, 1 strike, 1 out");
  });

  it("renders visible count label with aria-hidden=true", () => {
    renderWithContext(<LineScore />, makeContextValue({ balls: 2, strikes: 1, outs: 0 }));
    const labels = document.querySelectorAll('[aria-hidden="true"]');
    const countLabel = Array.from(labels).find((el) => el.textContent?.includes("B "));
    expect(countLabel).toBeTruthy();
  });

  it("count label reflects current ball/strike/out values", () => {
    renderWithContext(<LineScore />, makeContextValue({ balls: 3, strikes: 0, outs: 2 }));
    const labels = document.querySelectorAll('[aria-hidden="true"]');
    const countLabel = Array.from(labels).find((el) => el.textContent?.includes("B "));
    expect(countLabel?.textContent).toContain("B 3");
    expect(countLabel?.textContent).toContain("S 0");
    expect(countLabel?.textContent).toContain("O 2");
  });
});
