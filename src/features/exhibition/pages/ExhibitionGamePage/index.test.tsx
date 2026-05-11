import * as React from "react";

import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";

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

function renderExhibitionGamePage(
  initialPath = "/game/exhibition",
  state: unknown = null,
  ctx = mockCtx,
) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: initialPath, state }]}>
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

describe("ExhibitionGamePage", () => {
  it("renders the Game component when pendingGameSetup is in location state", () => {
    renderExhibitionGamePage("/game/exhibition", { pendingGameSetup: minimalSetup });
    expect(screen.getByTestId("game-mock")).toBeInTheDocument();
  });

  it("redirects to /exhibition/new when location state has no pendingGameSetup", () => {
    renderExhibitionGamePage("/game/exhibition", null);
    expect(screen.queryByTestId("game-mock")).not.toBeInTheDocument();
    expect(screen.getByTestId("exhibition-new-page")).toBeInTheDocument();
  });

  it("does not render Game when pendingGameSetup is absent from state object", () => {
    renderExhibitionGamePage("/game/exhibition", {});
    expect(screen.queryByTestId("game-mock")).not.toBeInTheDocument();
  });

  it("renders without crashing when given a valid setup", () => {
    expect(() =>
      renderExhibitionGamePage("/game/exhibition", { pendingGameSetup: minimalSetup }),
    ).not.toThrow();
  });
});
