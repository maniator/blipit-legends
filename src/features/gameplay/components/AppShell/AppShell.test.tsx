import * as React from "react";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useOutletContext } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@storage/db", () => ({
  getDb: vi.fn().mockResolvedValue({
    completedGames: {
      findOne: vi.fn(() => ({ exec: vi.fn().mockResolvedValue(null) })),
    },
  }),
}));

import type { AppShellOutletContext } from "./index";

/**
 * Inline route elements that consume AppShell's outlet context.
 * These mirror the HomeRoute / TeamsRoute / GameRoute in router.tsx
 * without depending on the full application router.
 */
function HomeRouteEl() {
  const ctx = useOutletContext<AppShellOutletContext>();
  return (
    <div data-testid="home-screen-mock">
      <button onClick={ctx.onNewGame}>New Game</button>
      <button onClick={ctx.onLoadSaves}>Load Saved Game</button>
      <button onClick={ctx.onManageTeams}>Manage Teams</button>
      {ctx.hasActiveSession && (
        <button onClick={ctx.onResumeCurrent} data-testid="resume-current-mock">
          Resume
        </button>
      )}
      <button onClick={ctx.onHelp} data-testid="help-mock">
        Help
      </button>
      <button onClick={ctx.onContact} data-testid="contact-mock">
        Contact
      </button>
      {ctx.hasCareerStats && (
        <button onClick={ctx.onCareerStats} data-testid="career-stats-mock">
          Career Stats
        </button>
      )}
    </div>
  );
}

function TeamsRouteEl() {
  const ctx = useOutletContext<AppShellOutletContext>();
  return (
    <div data-testid="manage-teams-screen-mock">
      <button onClick={ctx.onBackToHome}>Back</button>
    </div>
  );
}

/**
 * Simulates what GamePage does: consumes outlet context callbacks and exposes
 * buttons for test interaction.
 */
function GameRouteEl() {
  const ctx = useOutletContext<AppShellOutletContext>();
  return (
    <div data-testid="game-page-mock">
      <button onClick={ctx.onBackToHome} data-testid="back-to-home-mock">
        Back to Home
      </button>
      <button onClick={ctx.onGameSessionStarted} data-testid="game-session-started-mock">
        Session Started
      </button>
      <button onClick={ctx.onGameOver} data-testid="game-over-mock">
        Game Over
      </button>
    </div>
  );
}

import AppShell from "./index";

/** Renders AppShell inside MemoryRouter with proper child routes at the given initial path. */
function renderAppShell(initialPath = "/") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/" element={<AppShell />}>
          <Route index element={<HomeRouteEl />} />
          <Route path="game" element={<GameRouteEl />} />
          <Route path="teams/*" element={<TeamsRouteEl />} />
          <Route path="exhibition/new" element={<div data-testid="exhibition-mock" />} />
          <Route path="saves" element={<div data-testid="saves-mock" />} />
          <Route path="help" element={<div data-testid="help-page-mock" />} />
          <Route path="contact" element={<div data-testid="contact-page-mock" />} />
          <Route path="stats" element={<div data-testid="stats-page-mock" />} />
          <Route path="league" element={<div data-testid="league-page-mock" />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("AppShell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("does NOT show Career Stats on home when no completed games exist", () => {
    renderAppShell("/");
    expect(screen.queryByTestId("career-stats-mock")).not.toBeInTheDocument();
  });

  it("does NOT call getDb when the initial route is not /", async () => {
    const { getDb } = await import("@storage/db");
    renderAppShell("/game");
    // Allow any microtasks to flush
    await new Promise((r) => setTimeout(r, 0));
    expect(getDb).not.toHaveBeenCalled();
  });

  it("shows Career Stats on home when completed games exist", async () => {
    const { getDb } = await import("@storage/db");
    vi.mocked(getDb).mockResolvedValueOnce({
      completedGames: {
        findOne: vi.fn(() => ({ exec: vi.fn().mockResolvedValue({ id: "g1" }) })),
      },
    } as never);

    renderAppShell("/");
    expect(await screen.findByTestId("career-stats-mock")).toBeInTheDocument();
  });

  it("shows Career Stats after game over and navigates to /stats when clicked", async () => {
    const user = userEvent.setup();
    renderAppShell("/game");
    await user.click(screen.getByTestId("game-over-mock"));
    await user.click(screen.getByTestId("back-to-home-mock"));
    await user.click(await screen.findByTestId("career-stats-mock"));
    expect(screen.getByTestId("stats-page-mock")).toBeInTheDocument();
  });

  it("renders the Home screen by default", () => {
    renderAppShell("/");
    expect(screen.getByTestId("home-screen-mock")).toBeInTheDocument();
    expect(screen.queryByTestId("manage-teams-screen-mock")).not.toBeInTheDocument();
  });

  it("clicking New Game navigates away from home", async () => {
    const user = userEvent.setup();
    renderAppShell("/");
    await user.click(screen.getByRole("button", { name: /new game/i }));
    // Home screen disappears; we're on /exhibition/new
    expect(screen.queryByTestId("home-screen-mock")).not.toBeInTheDocument();
  });

  it("clicking Load Saved Game navigates to /saves (not /game)", async () => {
    const user = userEvent.setup();
    renderAppShell("/");
    await user.click(screen.getByRole("button", { name: /load saved game/i }));
    // GamePage must NOT be visible (saves page, not game)
    expect(screen.queryByTestId("game-page-mock")).not.toBeInTheDocument();
    // Home screen disappears
    expect(screen.queryByTestId("home-screen-mock")).not.toBeInTheDocument();
  });

  it("clicking Manage Teams transitions to the Manage Teams screen", async () => {
    const user = userEvent.setup();
    renderAppShell("/");
    await user.click(screen.getByRole("button", { name: /manage teams/i }));
    expect(screen.getByTestId("manage-teams-screen-mock")).toBeInTheDocument();
    expect(screen.queryByTestId("home-screen-mock")).not.toBeInTheDocument();
  });

  it("/teams/new path shows the Manage Teams screen", () => {
    renderAppShell("/teams/new");
    expect(screen.getByTestId("manage-teams-screen-mock")).toBeInTheDocument();
    expect(screen.queryByTestId("home-screen-mock")).not.toBeInTheDocument();
  });

  it("/teams/:id/edit path shows the Manage Teams screen", () => {
    renderAppShell("/teams/some-team-id/edit");
    expect(screen.getByTestId("manage-teams-screen-mock")).toBeInTheDocument();
    expect(screen.queryByTestId("home-screen-mock")).not.toBeInTheDocument();
  });

  it("GamePage renders at /game route", () => {
    renderAppShell("/game");
    expect(screen.getByTestId("game-page-mock")).toBeInTheDocument();
    expect(screen.queryByTestId("home-screen-mock")).not.toBeInTheDocument();
  });

  it("GamePage receives onBackToHome callback via outlet context", () => {
    renderAppShell("/game");
    expect(screen.getByTestId("back-to-home-mock")).toBeInTheDocument();
  });

  it("onBackToHome from GamePage routes back to the Home screen", async () => {
    const user = userEvent.setup();
    renderAppShell("/game");
    await user.click(screen.getByTestId("back-to-home-mock"));
    expect(screen.getByTestId("home-screen-mock")).toBeInTheDocument();
    // GamePage is unmounted — it is a real route element now
    expect(screen.queryByTestId("game-page-mock")).not.toBeInTheDocument();
  });

  it("Resume button does NOT appear after visiting game route without starting a session", async () => {
    const user = userEvent.setup();
    renderAppShell("/game");
    await user.click(screen.getByTestId("back-to-home-mock"));
    // Back to home — but no game session was actually started
    expect(screen.queryByTestId("resume-current-mock")).not.toBeInTheDocument();
  });

  it("Resume button appears after onGameSessionStarted fires", async () => {
    const user = userEvent.setup();
    renderAppShell("/game");
    // Simulate GamePage reporting a real game started via outlet context
    await user.click(screen.getByTestId("game-session-started-mock"));
    await user.click(screen.getByTestId("back-to-home-mock"));
    expect(screen.getByTestId("resume-current-mock")).toBeInTheDocument();
  });

  it("clicking Resume navigates back to game screen", async () => {
    const user = userEvent.setup();
    renderAppShell("/game");
    await user.click(screen.getByTestId("game-session-started-mock"));
    await user.click(screen.getByTestId("back-to-home-mock"));
    await user.click(screen.getByTestId("resume-current-mock"));
    expect(screen.getByTestId("game-page-mock")).toBeInTheDocument();
    expect(screen.queryByTestId("home-screen-mock")).not.toBeInTheDocument();
  });

  it("clicking Help navigates away from home (to /help)", async () => {
    const user = userEvent.setup();
    renderAppShell("/");
    await user.click(screen.getByTestId("help-mock"));
    expect(screen.queryByTestId("home-screen-mock")).not.toBeInTheDocument();
  });

  it("clicking Contact navigates away from home (to /contact)", async () => {
    const user = userEvent.setup();
    renderAppShell("/");
    await user.click(screen.getByTestId("contact-mock"));
    expect(screen.getByTestId("contact-page-mock")).toBeInTheDocument();
    expect(screen.queryByTestId("home-screen-mock")).not.toBeInTheDocument();
  });

  // Volume bar tests
  it("renders the volume bar on the home route", () => {
    renderAppShell("/");
    expect(screen.getByTestId("app-volume-bar")).toBeInTheDocument();
  });

  it("renders the volume bar on the /saves route", () => {
    renderAppShell("/saves");
    expect(screen.getByTestId("app-volume-bar")).toBeInTheDocument();
  });

  it("renders the volume bar on the /help route", () => {
    renderAppShell("/help");
    expect(screen.getByTestId("app-volume-bar")).toBeInTheDocument();
  });

  it("does NOT render the volume bar on the /game route", () => {
    renderAppShell("/game");
    expect(screen.queryByTestId("app-volume-bar")).not.toBeInTheDocument();
  });

  it("volume bar contains announcement and music volume sliders", () => {
    renderAppShell("/");
    expect(screen.getByRole("slider", { name: /announcement volume/i })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: /music volume/i })).toBeInTheDocument();
  });

  // Nav bar — Leagues link tests
  it("renders the Leagues nav link on the home route", () => {
    renderAppShell("/");
    expect(screen.getByTestId("nav-league-link")).toBeInTheDocument();
  });

  it("renders the Leagues nav link on non-game routes", () => {
    renderAppShell("/saves");
    expect(screen.getByTestId("nav-league-link")).toBeInTheDocument();
  });

  it("does NOT render the Leagues nav link on the /game route", () => {
    renderAppShell("/game");
    expect(screen.queryByTestId("nav-league-link")).not.toBeInTheDocument();
  });

  it("clicking the Leagues nav link navigates to /league", async () => {
    const user = userEvent.setup();
    renderAppShell("/");
    await user.click(screen.getByTestId("nav-league-link"));
    expect(screen.getByTestId("league-page-mock")).toBeInTheDocument();
    expect(screen.queryByTestId("home-screen-mock")).not.toBeInTheDocument();
  });
});
