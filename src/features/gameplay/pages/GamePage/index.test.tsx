import * as React from "react";

import { render, screen } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

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

// Mock the GamePageWrapper component
vi.mock("@feat/gameplay/components/GamePageWrapper", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@feat/gameplay/components/GamePageWrapper")>();
  // Return the actual component so it uses the mocked useBlocker/useBeforeUnload
  return {
    default: actual.default,
  };
});

// Capture the GameSessionContextValue passed to GameSessionProvider so tests can
// assert that managedTeam is correctly seeded from the initial navigation state.
import type { GameSessionContextValue } from "@feat/gameplay/context/index";

let capturedSessionCtx: GameSessionContextValue | null = null;

vi.mock("@feat/gameplay/context/index", async (importOriginal) => {
  const original = await importOriginal<typeof import("@feat/gameplay/context/index")>();
  return {
    ...original,
    GameSessionProvider: ({
      value,
      children,
    }: {
      value: GameSessionContextValue;
      children: React.ReactNode;
    }) => {
      capturedSessionCtx = value;
      return <>{children}</>;
    },
  };
});

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

afterEach(() => {
  capturedSessionCtx = null;
});

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

  describe("session context seeding", () => {
    it("seeds managedTeam from pendingGameSetup so handleStart receives the correct value", () => {
      // When /game is navigated with a pendingGameSetup that has managedTeam: 0,
      // GamePage must seed sessionCtx.managedTeam from the setup — not leave it null.
      // GameInner reads sessionManagedTeam (from context) when calling handleStart,
      // so a null seed silently downgrades manager games to spectator mode.
      renderGamePage("/game", {
        pendingGameSetup: {
          homeTeam: "ct_home",
          awayTeam: "ct_away",
          homeTeamLabel: "Home",
          awayTeamLabel: "Away",
          managedTeam: 0,
          playerOverrides: { away: {}, home: {}, awayOrder: [], homeOrder: [] },
        },
      });
      expect(capturedSessionCtx?.managedTeam).toBe(0);
    });

    it("seeds managedTeam:1 correctly from pendingGameSetup", () => {
      renderGamePage("/game", {
        pendingGameSetup: {
          homeTeam: "ct_home",
          awayTeam: "ct_away",
          homeTeamLabel: "Home",
          awayTeamLabel: "Away",
          managedTeam: 1,
          playerOverrides: { away: {}, home: {}, awayOrder: [], homeOrder: [] },
        },
      });
      expect(capturedSessionCtx?.managedTeam).toBe(1);
    });

    it("seeds managedTeam:null when pendingGameSetup.managedTeam is null (watch mode)", () => {
      renderGamePage("/game", {
        pendingGameSetup: {
          homeTeam: "ct_home",
          awayTeam: "ct_away",
          homeTeamLabel: "Home",
          awayTeamLabel: "Away",
          managedTeam: null,
          playerOverrides: { away: {}, home: {}, awayOrder: [], homeOrder: [] },
        },
      });
      expect(capturedSessionCtx?.managedTeam).toBeNull();
    });

    it("keeps managedTeam null and sessionReady false when no setup or load is present (auto-restore path)", () => {
      renderGamePage("/game");
      expect(capturedSessionCtx?.managedTeam).toBeNull();
      expect(capturedSessionCtx?.sessionReady).toBe(false);
    });

    it("sets sessionReady true when pendingGameSetup is present (scheduler should not wait)", () => {
      renderGamePage("/game", {
        pendingGameSetup: {
          homeTeam: "ct_home",
          awayTeam: "ct_away",
          homeTeamLabel: "Home",
          awayTeamLabel: "Away",
          managedTeam: 0,
          playerOverrides: { away: {}, home: {}, awayOrder: [], homeOrder: [] },
        },
      });
      expect(capturedSessionCtx?.sessionReady).toBe(true);
    });
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
