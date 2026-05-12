import * as React from "react";

import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Capture the props passed to Game so tests can assert on callbacks.
let capturedGameProps: Record<string, unknown> = {};

vi.mock("@feat/gameplay/components/Game", () => ({
  default: (props: Record<string, unknown>) => {
    capturedGameProps = props;
    return <div data-testid="game-mock" />;
  },
}));
vi.mock("@feat/gameplay/components/GamePageWrapper", () => ({
  default: ({
    children,
  }: {
    children: (onSavingStateChange: (saving: boolean) => void) => React.ReactNode;
  }) => <>{children(() => {})}</>,
}));

vi.mock("@feat/gameplay/components/AppLoadingFallback", () => ({
  default: ({ label }: { label: string }) => <div data-testid="loading-fallback">{label}</div>,
}));

vi.mock("@feat/leagues/utils/buildSeasonGameSetup", () => ({
  buildSeasonGameSetup: vi.fn(),
}));

vi.mock("@storage/db", () => ({
  getDb: vi.fn(),
}));

vi.mock("@feat/gameplay/utils/gameSessionDerive", () => ({
  deriveLeagueSession: vi.fn().mockReturnValue({
    sessionType: "league",
    managerModeAllowed: false,
    disableSave: true,
    seasonGameId: "sg-1",
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

import { buildSeasonGameSetup } from "@feat/leagues/utils/buildSeasonGameSetup";

import { getDb } from "@storage/db";
import type { AppShellOutletContext } from "@storage/types";

import LeagueGamePage from "./index";

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

const mockSetup = {
  homeTeam: "home",
  awayTeam: "away",
  homeTeamLabel: "Home",
  awayTeamLabel: "Away",
  managedTeam: null as null,
  playerOverrides: { away: {}, home: {}, awayOrder: [], homeOrder: [] },
  disableSave: true,
  seasonGameId: "sg-1",
};

type DbOverrides = {
  game?: object | null;
  season?: object | null;
  homeTeam?: object | null;
  awayTeam?: object | null;
};

function makeDb(overrides: DbOverrides = {}) {
  return makeMockDb(overrides);
}

function makeMockDb(overrides: DbOverrides = {}) {
  const gameRecord = {
    id: "sg-1",
    seasonId: "season-1",
    homeSeasonTeamId: "st-home",
    awaySeasonTeamId: "st-away",
    status: "scheduled",
  };

  const seasonRecord = {
    id: "season-1",
    userCustomTeamId: null,
  };

  const homeTeamRecord = {
    id: "st-home",
    customTeamId: "ct-home",
    rosterSnapshot: {},
  };

  const awayTeamRecord = {
    id: "st-away",
    customTeamId: "ct-away",
    rosterSnapshot: {},
  };

  const game = "game" in overrides ? overrides.game : gameRecord;
  const season = "season" in overrides ? overrides.season : seasonRecord;
  const homeTeam = "homeTeam" in overrides ? overrides.homeTeam : homeTeamRecord;
  const awayTeam = "awayTeam" in overrides ? overrides.awayTeam : awayTeamRecord;

  const toDoc = (value: object | null | undefined) => (value ? { toJSON: () => value } : null);

  return {
    seasonGames: {
      findOne: vi.fn(() => ({ exec: vi.fn().mockResolvedValue(toDoc(game)) })),
    },
    seasons: {
      findOne: vi.fn(() => ({ exec: vi.fn().mockResolvedValue(toDoc(season)) })),
    },
    seasonTeams: {
      findOne: vi.fn((query: { selector: { id: string } }) => {
        const id = query.selector.id;
        const value = id === "st-home" ? homeTeam : awayTeam;
        return { exec: vi.fn().mockResolvedValue(toDoc(value as object | null)) };
      }),
    },
  };
}

function renderLeagueGamePage(seasonGameId = "sg-1", ctx = mockCtx) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: `/game/league/${seasonGameId}` }]}>
      <Routes>
        <Route element={<Outlet context={ctx} />}>
          <Route path="/game/league/:seasonGameId" element={<LeagueGamePage />} />
          <Route path="/leagues" element={<div data-testid="leagues-page" />} />
          <Route path="/leagues/:seasonId/schedule" element={<div data-testid="schedule-page" />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("LeagueGamePage", () => {
  beforeEach(() => {
    capturedGameProps = {};
  });

  it("shows loading fallback initially", () => {
    vi.mocked(getDb).mockResolvedValue(makeDb() as never);
    vi.mocked(buildSeasonGameSetup).mockResolvedValue(mockSetup as never);

    renderLeagueGamePage();

    expect(screen.getByTestId("loading-fallback")).toBeInTheDocument();
    expect(screen.getByText("Loading game…")).toBeInTheDocument();
  });

  it("renders Game component after successful data fetch", async () => {
    const db = makeDb();
    vi.mocked(getDb).mockResolvedValue(db as never);
    vi.mocked(buildSeasonGameSetup).mockResolvedValue(mockSetup as never);

    renderLeagueGamePage();

    await waitFor(() => {
      expect(screen.getByTestId("game-mock")).toBeInTheDocument();
    });
  });

  it("shows not-found fallback and redirects to /leagues when game not found", async () => {
    const db = makeDb({ game: null });
    vi.mocked(getDb).mockResolvedValue(db as never);

    renderLeagueGamePage();

    await waitFor(() => {
      expect(screen.getByTestId("leagues-page")).toBeInTheDocument();
    });
  });

  it("shows error fallback when fetch fails", async () => {
    vi.mocked(getDb).mockRejectedValue(new Error("DB failure"));

    renderLeagueGamePage();

    await waitFor(() => {
      expect(screen.getByTestId("loading-fallback")).toBeInTheDocument();
      expect(screen.getByText("DB failure")).toBeInTheDocument();
    });
  });

  it("shows error fallback when season teams not found", async () => {
    const db = makeDb({ homeTeam: null });
    vi.mocked(getDb).mockResolvedValue(db as never);

    renderLeagueGamePage();

    await waitFor(() => {
      expect(screen.getByTestId("loading-fallback")).toBeInTheDocument();
    });
  });

  it("calls buildSeasonGameSetup with managedTeam null when season has no userCustomTeamId", async () => {
    const db = makeDb(); // default: userCustomTeamId: null
    vi.mocked(getDb).mockResolvedValue(db as never);
    vi.mocked(buildSeasonGameSetup).mockResolvedValue(mockSetup as never);

    renderLeagueGamePage("sg-1");

    await waitFor(() => {
      expect(screen.getByTestId("game-mock")).toBeInTheDocument();
    });

    expect(buildSeasonGameSetup).toHaveBeenCalledWith(
      db,
      expect.anything(),
      expect.anything(),
      expect.anything(),
      null,
    );
  });

  it("derives managedTeam from season.userCustomTeamId", async () => {
    const seasonRecord = { id: "season-1", userCustomTeamId: "ct-home" };
    const db = makeDb({ season: seasonRecord });
    vi.mocked(getDb).mockResolvedValue(db as never);
    vi.mocked(buildSeasonGameSetup).mockResolvedValue(mockSetup as never);

    renderLeagueGamePage("sg-1");

    await waitFor(() => {
      expect(screen.getByTestId("game-mock")).toBeInTheDocument();
    });

    expect(buildSeasonGameSetup).toHaveBeenCalledWith(
      db,
      expect.anything(),
      expect.anything(),
      expect.anything(),
      1, // home = index 1
    );
  });

  describe("back navigation", () => {
    it("passes backLabel='← Schedule' to Game", async () => {
      const db = makeDb();
      vi.mocked(getDb).mockResolvedValue(db as never);
      vi.mocked(buildSeasonGameSetup).mockResolvedValue(mockSetup as never);

      renderLeagueGamePage("sg-1");

      await waitFor(() => {
        expect(screen.getByTestId("game-mock")).toBeInTheDocument();
      });

      expect(capturedGameProps.backLabel).toBe("← Schedule");
    });

    it("onBackToHome navigates to /leagues/:seasonId/schedule after fetch", async () => {
      const db = makeDb();
      vi.mocked(getDb).mockResolvedValue(db as never);
      vi.mocked(buildSeasonGameSetup).mockResolvedValue(mockSetup as never);

      renderLeagueGamePage("sg-1");

      await waitFor(() => {
        expect(screen.getByTestId("game-mock")).toBeInTheDocument();
      });

      expect(typeof capturedGameProps.onBackToHome).toBe("function");
      (capturedGameProps.onBackToHome as () => void)();

      await waitFor(() => {
        expect(screen.getByTestId("schedule-page")).toBeInTheDocument();
      });
    });
  });
});
