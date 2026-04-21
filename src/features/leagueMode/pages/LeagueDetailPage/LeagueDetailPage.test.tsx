import * as React from "react";

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock hooks and stores before importing the component.
vi.mock("@feat/leagueMode/hooks/useLeague");
vi.mock("@feat/leagueMode/hooks/useLeagueSeason");
vi.mock("@feat/leagueMode/hooks/useScheduledGames");
vi.mock("@feat/leagueMode/hooks/useLeagueSimulation");
vi.mock("@feat/leagueMode/hooks/useLeagueBoxScore");
vi.mock("@feat/leagueMode/storage/leagueSeasonStore", () => ({
  leagueSeasonStore: { markSeasonActive: vi.fn() },
}));
vi.mock("@feat/customTeams/storage/customTeamStore", () => ({
  CustomTeamStore: { listCustomTeams: vi.fn() },
}));

import { CustomTeamStore } from "@feat/customTeams/storage/customTeamStore";
import { useLeague } from "@feat/leagueMode/hooks/useLeague";
import { useLeagueBoxScore } from "@feat/leagueMode/hooks/useLeagueBoxScore";
import { useLeagueSeason } from "@feat/leagueMode/hooks/useLeagueSeason";
import { useLeagueSimulation } from "@feat/leagueMode/hooks/useLeagueSimulation";
import { useScheduledGames } from "@feat/leagueMode/hooks/useScheduledGames";
import { leagueSeasonStore } from "@feat/leagueMode/storage/leagueSeasonStore";
import type { LeagueRecord, LeagueSeasonRecord } from "@feat/leagueMode/storage/types";

import LeagueDetailPage from "./index";

const makeLeague = (): LeagueRecord => ({
  id: "lg_1",
  name: "Test League",
  teamIds: ["team_a", "team_b"],
  divisionCount: 1,
  activeLeagueSeasonId: "lsn_1",
  status: "active",
  schemaVersion: 0,
  createdAt: 0,
  updatedAt: 0,
});

const makeSeason = (status: LeagueSeasonRecord["status"] = "pending"): LeagueSeasonRecord => ({
  id: "lsn_1",
  leagueId: "lg_1",
  seasonNumber: 1,
  status,
  currentGameDay: 1,
  totalGameDays: 5,
  defaultGamesPerTeam: 10,
  seed: "abc123",
  schemaVersion: 0,
  createdAt: 0,
  updatedAt: 0,
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/league/lg_1"]}>
      <Routes>
        <Route path="/league/:leagueId" element={<LeagueDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );

describe("LeagueDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(CustomTeamStore.listCustomTeams).mockResolvedValue([]);
    vi.mocked(leagueSeasonStore.markSeasonActive).mockResolvedValue(undefined);

    vi.mocked(useLeague).mockReturnValue({
      league: makeLeague(),
      isLoading: false,
      error: null,
    });

    vi.mocked(useLeagueSeason).mockReturnValue({
      season: makeSeason("pending"),
      isLoading: false,
      error: null,
    });

    vi.mocked(useScheduledGames).mockReturnValue({
      games: [],
      isLoading: false,
      error: null,
    });

    vi.mocked(useLeagueSimulation).mockReturnValue({
      simulatingDay: false,
      simulateDayError: null,
      handleSimulateDay: vi.fn(),
    });

    vi.mocked(useLeagueBoxScore).mockReturnValue({
      isExpanded: vi.fn().mockReturnValue(false),
      toggleBoxScore: vi.fn(),
      getBoxScore: vi.fn().mockReturnValue(undefined),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the league name", () => {
    renderPage();
    expect(screen.getByText("Test League")).toBeInTheDocument();
  });

  it("shows Start Season button when season status is pending", () => {
    renderPage();
    expect(screen.getByTestId("start-season-button")).toBeInTheDocument();
  });

  /**
   * Regression test for the bug where clicking "Start Season" left all buttons
   * disabled because navigate(0) was used instead of setRefreshKey.
   *
   * After "Start Season" is clicked:
   *  1. markSeasonActive resolves
   *  2. useLeagueSeason is called again with an incremented refreshKey
   *  3. The component re-renders with the active season, showing SimulateDayButton
   */
  it("shows SimulateDayButton after starting the season (season-start bug regression)", async () => {
    // First render: pending season
    renderPage();
    expect(screen.getByTestId("start-season-button")).toBeInTheDocument();

    // After clicking Start Season, mock the hook to return the active season
    // (simulating what happens after the refreshKey increment triggers a re-fetch)
    vi.mocked(useLeagueSeason).mockReturnValue({
      season: makeSeason("active"),
      isLoading: false,
      error: null,
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("start-season-button"));
    });

    // The season hook is called with an incremented refreshKey
    expect(leagueSeasonStore.markSeasonActive).toHaveBeenCalledWith("lsn_1");

    // SimulateDayButton should now appear (was disabled/missing before the fix)
    await waitFor(() => {
      expect(screen.getByTestId("simulate-day-button")).toBeInTheDocument();
    });
  });

  it("shows SimulateDayButton when season is already active", () => {
    vi.mocked(useLeagueSeason).mockReturnValue({
      season: makeSeason("active"),
      isLoading: false,
      error: null,
    });

    renderPage();
    expect(screen.getByTestId("simulate-day-button")).toBeInTheDocument();
  });

  it("shows season-complete badge when season is complete", () => {
    vi.mocked(useLeagueSeason).mockReturnValue({
      season: { ...makeSeason("complete"), championTeamId: "team_a" },
      isLoading: false,
      error: null,
    });

    renderPage();
    expect(screen.getByTestId("season-complete-badge")).toBeInTheDocument();
    expect(screen.getByTestId("champion-banner")).toBeInTheDocument();
  });

  it("shows loading state while data is being fetched", () => {
    vi.mocked(useLeague).mockReturnValue({ league: null, isLoading: true, error: null });
    renderPage();
    expect(screen.getByTestId("league-detail-loading")).toBeInTheDocument();
  });

  it("shows error state when there is a fetch error", () => {
    vi.mocked(useLeague).mockReturnValue({
      league: null,
      isLoading: false,
      error: new Error("Network error"),
    });

    renderPage();
    expect(screen.getByTestId("league-detail-error")).toHaveTextContent("Network error");
  });

  /**
   * Regression test for the display off-by-one bug where `gameDay + 1` caused
   * "Game Day 2" to appear as the first label when the schedule starts at day 1.
   * The fix: ScheduleSection now renders `Game Day {gameDay}` (no +1).
   */
  it("renders Game Day 1 label when the first game is on day 1 (display off-by-one regression)", () => {
    vi.mocked(useLeagueSeason).mockReturnValue({
      season: makeSeason("active"),
      isLoading: false,
      error: null,
    });

    vi.mocked(useScheduledGames).mockReturnValue({
      games: [
        {
          id: "sgame_1",
          leagueSeasonId: "lsn_1",
          gameDay: 1, // 1-indexed: first day
          awayTeamId: "team_a",
          homeTeamId: "team_b",
          status: "scheduled",
          schemaVersion: 0,
        },
      ],
      isLoading: false,
      error: null,
    });

    renderPage();

    // Must show "Game Day 1", NOT "Game Day 2"
    expect(screen.getByText("Game Day 1")).toBeInTheDocument();
    expect(screen.queryByText("Game Day 2")).not.toBeInTheDocument();
  });

  /**
   * Regression test: the Play button for the current game day must be enabled,
   * and Play buttons for future days must be disabled.
   */
  it("enables Play button only for the current game day", () => {
    vi.mocked(useLeagueSeason).mockReturnValue({
      season: makeSeason("active"), // currentGameDay: 1
      isLoading: false,
      error: null,
    });

    vi.mocked(useScheduledGames).mockReturnValue({
      games: [
        {
          id: "sgame_day1",
          leagueSeasonId: "lsn_1",
          gameDay: 1,
          awayTeamId: "team_a",
          homeTeamId: "team_b",
          status: "scheduled",
          schemaVersion: 0,
        },
        {
          id: "sgame_day2",
          leagueSeasonId: "lsn_1",
          gameDay: 2,
          awayTeamId: "team_b",
          homeTeamId: "team_a",
          status: "scheduled",
          schemaVersion: 0,
        },
      ],
      isLoading: false,
      error: null,
    });

    renderPage();

    // Day 1 Play button should be enabled
    const day1Button = screen.getByTestId("play-game-button-sgame_day1");
    expect(day1Button).not.toBeDisabled();

    // Day 2 Play button should be disabled (future day)
    const day2Button = screen.getByTestId("play-game-button-sgame_day2");
    expect(day2Button).toBeDisabled();
  });
});
