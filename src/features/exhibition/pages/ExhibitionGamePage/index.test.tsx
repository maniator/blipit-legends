import * as React from "react";

import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

// Mock useBlocker and useBeforeUnload — these require a data router which is
// not available in MemoryRouter.
vi.mock("react-router", async (importOriginal) => {
  const original = await importOriginal<typeof import("react-router")>();
  return {
    ...original,
    Navigate: original.Navigate,
    useBlocker: vi.fn(() => ({ state: "unblocked", proceed: undefined, reset: undefined })),
    useBeforeUnload: vi.fn(),
  };
});

// Mock the heavy Game component — ExhibitionGamePage is a thin routing adapter.
// Expose onSessionRestored so tests can simulate RxDB auto-restore completing.
let capturedOnSessionRestored: ((managedTeam: 0 | 1 | null) => void) | undefined;
vi.mock("@feat/gameplay/components/Game", () => ({
  default: ({ onSessionRestored }: { onSessionRestored?: (managedTeam: 0 | 1 | null) => void }) => {
    capturedOnSessionRestored = onSessionRestored;
    return <div data-testid="game-mock" />;
  },
}));

// Mock the GamePageWrapper component
vi.mock("@feat/gameplay/components/GamePageWrapper", () => ({
  default: ({
    children,
  }: {
    children: (onSavingStateChange: (saving: boolean) => void) => React.ReactNode;
  }) => <>{children(() => {})}</>,
}));

vi.mock("@feat/gameplay/context/index", async (importOriginal) => {
  const original = await importOriginal<typeof import("@feat/gameplay/context/index")>();
  return {
    ...original,
    GameSessionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

import type { AppShellOutletContext } from "@feat/gameplay/components/AppShell";

import ExhibitionGamePage from "./index";

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

function renderExhibitionGamePage(initialPath = "/game/exhibition", ctx = mockCtx) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: initialPath }]}>
      <Routes>
        <Route element={<Outlet context={ctx} />}>
          <Route path="/game/exhibition" element={<ExhibitionGamePage />} />
          <Route path="/exhibition/new" element={<div data-testid="exhibition-new-page" />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

const minimalSetup = {
  homeTeam: "team-home",
  awayTeam: "team-away",
  homeTeamLabel: "Home Team",
  awayTeamLabel: "Away Team",
  managedTeam: null as null,
  playerOverrides: {
    away: {},
    home: {},
    awayOrder: [],
    homeOrder: [],
  },
};

afterEach(() => {
  sessionStorage.clear();
  capturedOnSessionRestored = undefined;
});

describe("ExhibitionGamePage", () => {
  it("renders the Game component when pendingGameSetup is in sessionStorage", () => {
    sessionStorage.setItem("pendingExhibitionSetup", JSON.stringify(minimalSetup));
    renderExhibitionGamePage();
    expect(screen.getByTestId("game-mock")).toBeInTheDocument();
  });

  it("renders the Game component even when sessionStorage has no pendingGameSetup (auto-restore path)", () => {
    // No entry in sessionStorage — simulates page refresh or deep-link.
    // The component should NOT redirect; instead it renders <Game> and lets
    // GameInner attempt auto-restore from RxDB.
    renderExhibitionGamePage();
    expect(screen.getByTestId("game-mock")).toBeInTheDocument();
  });

  it("renders without crashing when given a valid setup", () => {
    sessionStorage.setItem("pendingExhibitionSetup", JSON.stringify(minimalSetup));
    expect(() => renderExhibitionGamePage()).not.toThrow();
  });

  it("exposes onSessionRestored to Game for RxDB auto-restore completion", () => {
    renderExhibitionGamePage();
    // Simulate GameInner calling onSessionRestored after auto-restoring from RxDB.
    expect(capturedOnSessionRestored).toBeDefined();
    act(() => {
      capturedOnSessionRestored!(1);
    });
    // If we get here without throwing, the session context update succeeded.
    expect(screen.getByTestId("game-mock")).toBeInTheDocument();
  });
});
