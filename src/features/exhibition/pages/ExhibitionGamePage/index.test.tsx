import * as React from "react";

import { render, screen } from "@testing-library/react";
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
vi.mock("@feat/gameplay/components/Game", () => ({
  default: () => <div data-testid="game-mock" />,
}));

// GameSessionProvider reads from context; mock it so tests don't need a real provider.
vi.mock("@feat/gameplay/utils/gameSessionDerive", () => ({
  deriveExhibitionSession: vi.fn().mockReturnValue({
    sessionType: "exhibition",
    managerModeAllowed: true,
    disableSave: false,
    seasonGameId: null,
    managedTeam: null,
    sessionReady: true,
  }),
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
  hasActiveSession: false,
  hasCareerStats: false,
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
});

describe("ExhibitionGamePage", () => {
  it("renders the Game component when pendingGameSetup is in sessionStorage", () => {
    sessionStorage.setItem("pendingExhibitionSetup", JSON.stringify(minimalSetup));
    renderExhibitionGamePage();
    expect(screen.getByTestId("game-mock")).toBeInTheDocument();
  });

  it("redirects to /exhibition/new when sessionStorage has no pendingGameSetup", () => {
    renderExhibitionGamePage();
    expect(screen.queryByTestId("game-mock")).not.toBeInTheDocument();
    expect(screen.getByTestId("exhibition-new-page")).toBeInTheDocument();
  });

  it("renders without crashing when given a valid setup", () => {
    sessionStorage.setItem("pendingExhibitionSetup", JSON.stringify(minimalSetup));
    expect(() => renderExhibitionGamePage()).not.toThrow();
  });
});
