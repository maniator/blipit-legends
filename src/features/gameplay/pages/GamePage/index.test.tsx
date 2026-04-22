import * as React from "react";

import { render, screen } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";

// Provide a controllable useBlocker mock so individual tests can override it.
const mockUseBlocker = vi.fn(
  (): { state: string; proceed: undefined | (() => void); reset: undefined | (() => void) } => ({
    state: "unblocked",
    proceed: undefined,
    reset: undefined,
  }),
);

// Mock useBlocker and useBeforeUnload — these require a data router which is
// not available in MemoryRouter. The GamePage routing logic is what we're
// testing here, not navigation-blocking behaviour.
vi.mock("react-router", async (importOriginal) => {
  const original = await importOriginal<typeof import("react-router")>();
  return {
    ...original,
    useBlocker: (_arg: unknown) => mockUseBlocker(),
    useBeforeUnload: vi.fn(),
  };
});

// Mock the heavy Game component — GamePage is a thin routing adapter
vi.mock("@feat/gameplay/components/Game", () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="game-mock">
      <button
        data-testid="consume-setup"
        onClick={() => typeof props.onConsumeGameSetup === "function" && props.onConsumeGameSetup()}
      />
      <button
        data-testid="consume-load"
        onClick={() =>
          typeof props.onConsumePendingLoad === "function" && props.onConsumePendingLoad()
        }
      />
      <button
        data-testid="new-game"
        onClick={() => typeof props.onNewGame === "function" && props.onNewGame()}
      />
    </div>
  ),
}));

import type { AppShellOutletContext } from "@feat/gameplay/components/AppShell";

import GamePage from "./index";

const mockCtx: AppShellOutletContext = {
  onStartGame: vi.fn(),
  onLoadSave: vi.fn(),
  onGameSessionStarted: vi.fn(),
  onNewGame: vi.fn(),
  onLoadSaves: vi.fn(),
  onManageTeams: vi.fn(),
  onResumeCurrent: vi.fn(),
  onHelp: vi.fn(),
  onBackToHome: vi.fn(),
  onCareerStats: vi.fn(),
  onGameOver: vi.fn(),
  hasActiveSession: false,
};

/** Renders GamePage inside a minimal router with outlet context. */
function renderGamePage(initialPath = "/game", state: unknown = null, ctx = mockCtx) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: initialPath, state }]}>
      <Routes>
        <Route element={<Outlet context={ctx} />}>
          <Route path="/game" element={<GamePage />} />
          <Route path="/exhibition/new" element={<div data-testid="new-game-page" />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("GamePage", () => {
  it("renders the Game component", () => {
    renderGamePage();
    expect(screen.getByTestId("game-mock")).toBeInTheDocument();
  });

  it("clears location.state after capturing it (replace navigate)", () => {
    // Providing non-null state triggers the clear-state effect.
    // We just verify the component doesn't throw.
    expect(() =>
      renderGamePage("/game", { pendingGameSetup: { homeTeam: "A", awayTeam: "B" } }),
    ).not.toThrow();
  });

  it("onConsumeGameSetup clears pendingSetupRef without throwing", () => {
    renderGamePage();
    screen.getByTestId("consume-setup").click();
    // No error = callback ran cleanly
  });

  it("onConsumePendingLoad clears pendingLoadRef without throwing", () => {
    renderGamePage();
    screen.getByTestId("consume-load").click();
  });

  describe("SavingBanner", () => {
    it("is NOT rendered when blocker state is 'unblocked'", () => {
      mockUseBlocker.mockReturnValueOnce({
        state: "unblocked",
        proceed: undefined,
        reset: undefined,
      });
      renderGamePage();
      expect(screen.queryByTestId("saving-stats-banner")).not.toBeInTheDocument();
    });

    it("is rendered when blocker state is 'blocked'", () => {
      mockUseBlocker.mockReturnValueOnce({
        state: "blocked",
        proceed: vi.fn(),
        reset: vi.fn(),
      });
      renderGamePage();
      expect(screen.getByTestId("saving-stats-banner")).toBeInTheDocument();
      expect(screen.getByTestId("saving-stats-banner")).toHaveTextContent("Saving stats");
    });
  });
});
