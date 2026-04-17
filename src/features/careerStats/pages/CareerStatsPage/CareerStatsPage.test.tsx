import * as React from "react";

import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock RxDB getDb so no real DB is needed.
vi.mock("@storage/db", () => ({
  getDb: vi.fn().mockResolvedValue({
    completedGames: { find: vi.fn(() => ({ exec: vi.fn().mockResolvedValue([]) })) },
  }),
}));

vi.mock("@shared/hooks/useCustomTeams", () => ({
  useCustomTeams: vi.fn(() => ({ teams: [], loading: false })),
}));

const mockNavigate = vi.fn();
vi.mock("react-router", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-router")>();
  return {
    ...mod,
    useNavigate: vi.fn(() => mockNavigate),
  };
});

vi.mock("@feat/careerStats/storage/gameHistoryStore", () => ({
  MIN_AB_FOR_AVG_LEADER: 20,
  MIN_OUTS_FOR_ERA_LEADER: 30,
  GameHistoryStore: {
    getTeamCareerBattingStats: vi.fn().mockResolvedValue([]),
    getTeamCareerPitchingStats: vi.fn().mockResolvedValue([]),
    getTeamCareerSummary: vi.fn().mockResolvedValue({
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      ties: 0,
      winPct: 0,
      runsScored: 0,
      runsAllowed: 0,
      runDiff: 0,
      rsPerGame: 0,
      raPerGame: 0,
      streak: "-",
      last10: { wins: 0, losses: 0, ties: 0 },
    }),
    getTeamBattingLeaders: vi
      .fn()
      .mockResolvedValue({ hrLeader: null, avgLeader: null, rbiLeader: null }),
    getTeamPitchingLeaders: vi
      .fn()
      .mockResolvedValue({ eraLeader: null, savesLeader: null, strikeoutsLeader: null }),
  },
}));

import { GameHistoryStore } from "@feat/careerStats/storage/gameHistoryStore";
import { useCustomTeams } from "@shared/hooks/useCustomTeams";

import type { TeamWithRoster } from "@storage/types";

import CareerStatsPage from "./index";

/**
 * Creates a minimal valid TeamWithRoster for test mocks.
 * All required fields are filled with safe defaults.
 */
function makeTeamDoc(
  id: string,
  name: string,
  opts: { city?: string; abbreviation?: string } = {},
): TeamWithRoster {
  return {
    id,
    name,
    nameLowercase: name.toLowerCase(),
    schemaVersion: 1,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    roster: { schemaVersion: 1, lineup: [], bench: [], pitchers: [] },
    metadata: { archived: false },
    ...opts,
  };
}

function renderPage(initialEntry = "/stats/team1") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/stats" element={<CareerStatsPage />} />
        <Route path="/stats/:teamId" element={<CareerStatsPage />} />
        <Route path="/" element={<div data-testid="home-screen" />} />
        <Route
          path="/stats/:teamId/players/:playerId"
          element={<div data-testid="player-page" />}
        />
        <Route path="/teams/:teamId/edit" element={<div data-testid="team-editor-page" />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("CareerStatsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useCustomTeams).mockReturnValue({
      teams: [],
      loading: false,
      createTeam: vi.fn(),
      updateTeam: vi.fn(),
      deleteTeam: vi.fn(),
      refresh: vi.fn(),
    });
    vi.mocked(GameHistoryStore.getTeamCareerBattingStats).mockResolvedValue([]);
    vi.mocked(GameHistoryStore.getTeamCareerPitchingStats).mockResolvedValue([]);
  });

  it("renders the career stats page", async () => {
    await act(async () => {
      renderPage();
    });
    expect(screen.getByTestId("career-stats-page")).toBeInTheDocument();
  });

  it("shows the Career Stats heading", async () => {
    await act(async () => {
      renderPage();
    });
    expect(screen.getByRole("heading", { name: /career stats/i })).toBeInTheDocument();
  });

  it("has batting and pitching tab buttons (when a team exists)", async () => {
    vi.mocked(useCustomTeams).mockReturnValue({
      teams: [makeTeamDoc("t1", "Test Team")],
      loading: false,
      createTeam: vi.fn(),
      updateTeam: vi.fn(),
      deleteTeam: vi.fn(),
      refresh: vi.fn(),
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("career-stats-batting-tab")).toBeInTheDocument();
    });
    expect(screen.getByTestId("career-stats-pitching-tab")).toBeInTheDocument();
  });

  it("has a team selector (when a team exists)", async () => {
    vi.mocked(useCustomTeams).mockReturnValue({
      teams: [makeTeamDoc("t1", "Test Team")],
      loading: false,
      createTeam: vi.fn(),
      updateTeam: vi.fn(),
      deleteTeam: vi.fn(),
      refresh: vi.fn(),
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("career-stats-team-select")).toBeInTheDocument();
    });
  });

  it("shows Edit This Team button for a selected custom team", async () => {
    vi.mocked(useCustomTeams).mockReturnValue({
      teams: [makeTeamDoc("team1", "Custom Team", { city: "Test", abbreviation: "TST" })],
      loading: false,
      createTeam: vi.fn(),
      updateTeam: vi.fn(),
      deleteTeam: vi.fn(),
      refresh: vi.fn(),
    });

    renderPage();
    expect(await screen.findByTestId("career-stats-edit-team-button")).toBeInTheDocument();
  });

  it("navigates to team editor when Edit This Team is clicked", async () => {
    const user = userEvent.setup();
    vi.mocked(useCustomTeams).mockReturnValue({
      teams: [makeTeamDoc("team1", "Custom Team", { city: "Test", abbreviation: "TST" })],
      loading: false,
      createTeam: vi.fn(),
      updateTeam: vi.fn(),
      deleteTeam: vi.fn(),
      refresh: vi.fn(),
    });

    renderPage();
    await user.click(await screen.findByTestId("career-stats-edit-team-button"));
    expect(mockNavigate).toHaveBeenCalledWith("/teams/team1/edit");
  });

  it("back button navigates to home", async () => {
    const user = userEvent.setup();
    await act(async () => {
      renderPage();
    });
    const backBtn = screen.getByRole("button", { name: /back/i });
    await user.click(backBtn);
    expect(mockNavigate).toHaveBeenCalledWith("/");
  });

  it("shows empty state when no data for a team", async () => {
    vi.mocked(useCustomTeams).mockReturnValue({
      teams: [makeTeamDoc("team1", "Test Team", { city: "Test City", abbreviation: "TT" })],
      loading: false,
      createTeam: vi.fn(),
      updateTeam: vi.fn(),
      deleteTeam: vi.fn(),
      refresh: vi.fn(),
    });
    vi.mocked(GameHistoryStore.getTeamCareerBattingStats).mockResolvedValue([]);
    vi.mocked(GameHistoryStore.getTeamCareerPitchingStats).mockResolvedValue([]);

    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("career-stats-empty")).toBeInTheDocument();
    });
  });

  it("renders batting rows when data is available", async () => {
    vi.mocked(useCustomTeams).mockReturnValue({
      teams: [makeTeamDoc("team1", "Yankees", { city: "NY", abbreviation: "NYY" })],
      loading: false,
      createTeam: vi.fn(),
      updateTeam: vi.fn(),
      deleteTeam: vi.fn(),
      refresh: vi.fn(),
    });
    vi.mocked(GameHistoryStore.getTeamCareerBattingStats).mockResolvedValue([
      {
        playerId: "plyr_p1",
        nameAtGameTime: "John Smith",
        gamesPlayed: 5,
        atBats: 20,
        hits: 7,
        doubles: 2,
        triples: 0,
        homers: 1,
        sacFlies: 0,
        walks: 3,
        strikeouts: 4,
        rbi: 4,
        singles: 4,
      },
    ]);
    vi.mocked(GameHistoryStore.getTeamCareerPitchingStats).mockResolvedValue([]);

    renderPage();
    await waitFor(() => {
      expect(screen.getByText("John Smith")).toBeInTheDocument();
    });
    expect(screen.getByText("5")).toBeInTheDocument(); // games played
  });

  it("switches to pitching tab and renders pitching rows", async () => {
    const user = userEvent.setup();
    vi.mocked(useCustomTeams).mockReturnValue({
      teams: [makeTeamDoc("team1", "Yankees", { city: "NY", abbreviation: "NYY" })],
      loading: false,
      createTeam: vi.fn(),
      updateTeam: vi.fn(),
      deleteTeam: vi.fn(),
      refresh: vi.fn(),
    });
    vi.mocked(GameHistoryStore.getTeamCareerBattingStats).mockResolvedValue([]);
    vi.mocked(GameHistoryStore.getTeamCareerPitchingStats).mockResolvedValue([
      {
        playerId: "plyr_p1",
        nameAtGameTime: "Bob Pitcher",
        gamesPlayed: 3,
        outsPitched: 27,
        battersFaced: 35,
        hitsAllowed: 8,
        walksAllowed: 3,
        strikeoutsRecorded: 20,
        homersAllowed: 1,
        runsAllowed: 5,
        earnedRuns: 5,
        saves: 1,
        holds: 0,
        pitchesThrown: 0,
        blownSaves: 0,
      },
    ]);

    renderPage();
    const pitchingTab = screen.getByTestId("career-stats-pitching-tab");
    await user.click(pitchingTab);
    await waitFor(() => {
      expect(screen.getByText("Bob Pitcher")).toBeInTheDocument();
    });
    // IP should show 9.0 (27 outs)
    expect(screen.getByText("9.0")).toBeInTheDocument();
  });

  it("populates team selector with custom teams", async () => {
    vi.mocked(useCustomTeams).mockReturnValue({
      teams: [
        makeTeamDoc("team1", "Red Sox", { city: "Boston", abbreviation: "BOS" }),
        makeTeamDoc("team2", "Yankees", { city: "NY", abbreviation: "NYY" }),
      ],
      loading: false,
      createTeam: vi.fn(),
      updateTeam: vi.fn(),
      deleteTeam: vi.fn(),
      refresh: vi.fn(),
    });

    renderPage();
    await waitFor(() => {
      const select = screen.getByTestId("career-stats-team-select");
      expect(select.querySelectorAll("option").length).toBeGreaterThanOrEqual(2);
    });
  });

  it("handles error from getDb silently — page still renders", async () => {
    const { getDb } = await import("@storage/db");
    vi.mocked(getDb).mockRejectedValueOnce(new Error("DB unavailable"));
    renderPage();
    await act(async () => {});
    // Page should still render without crashing.
    expect(screen.getByTestId("career-stats-page")).toBeInTheDocument();
  });

  it("handles error from getTeamCareerBattingStats — shows empty state", async () => {
    vi.mocked(useCustomTeams).mockReturnValue({
      teams: [makeTeamDoc("team1", "Cubs", { city: "Chicago", abbreviation: "CHC" })],
      loading: false,
      createTeam: vi.fn(),
      updateTeam: vi.fn(),
      deleteTeam: vi.fn(),
      refresh: vi.fn(),
    });
    vi.mocked(GameHistoryStore.getTeamCareerBattingStats).mockRejectedValueOnce(
      new Error("query failed"),
    );
    vi.mocked(GameHistoryStore.getTeamCareerPitchingStats).mockRejectedValueOnce(
      new Error("query failed"),
    );
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("career-stats-empty")).toBeInTheDocument();
    });
  });

  it("loads teams from game history (non-custom teamIds) into the selector", async () => {
    const { getDb } = await import("@storage/db");
    // Return completed games with non-custom team IDs.
    vi.mocked(getDb).mockResolvedValue({
      completedGames: {
        find: vi.fn(() => ({
          exec: vi
            .fn()
            .mockResolvedValue([{ toJSON: () => ({ homeTeamId: "Yankees", awayTeamId: "Mets" }) }]),
        })),
      },
    } as any);

    renderPage();
    await waitFor(() => {
      const select = screen.getByTestId("career-stats-team-select");
      // Yankees and Mets were found in completed games and should appear as options.
      const options = Array.from(select.querySelectorAll("option")).map((o) => o.value);
      expect(options).toContain("Yankees");
      expect(options).toContain("Mets");
    });
  });

  it("renders — with 0 IP pitcher row — WHIP and ERA display as '—'", async () => {
    const user = userEvent.setup();
    vi.mocked(useCustomTeams).mockReturnValue({
      teams: [makeTeamDoc("team1", "Yankees", { city: "NY", abbreviation: "NYY" })],
      loading: false,
      createTeam: vi.fn(),
      updateTeam: vi.fn(),
      deleteTeam: vi.fn(),
      refresh: vi.fn(),
    });
    vi.mocked(GameHistoryStore.getTeamCareerBattingStats).mockResolvedValue([]);
    vi.mocked(GameHistoryStore.getTeamCareerPitchingStats).mockResolvedValue([
      {
        playerId: "plyr_p1",
        nameAtGameTime: "Zero IP Pitcher",
        gamesPlayed: 1,
        outsPitched: 0, // 0 IP → ERA and WHIP should display "—"
        battersFaced: 0,
        hitsAllowed: 0,
        walksAllowed: 0,
        strikeoutsRecorded: 0,
        homersAllowed: 0,
        runsAllowed: 0,
        earnedRuns: 0,
        saves: 0,
        holds: 0,
        pitchesThrown: 0,
        blownSaves: 0,
      },
    ]);

    renderPage();
    const pitchingTab = screen.getByTestId("career-stats-pitching-tab");
    await user.click(pitchingTab);
    await waitFor(() => {
      expect(screen.getByText("Zero IP Pitcher")).toBeInTheDocument();
    });
    // With 0 IP, ERA and WHIP should render as "—" (null guard in formatWHIP/formatERA)
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });

  it("cleanup effects run without errors when component unmounts", async () => {
    vi.mocked(useCustomTeams).mockReturnValue({
      teams: [makeTeamDoc("t1", "Tigers", { city: "Detroit", abbreviation: "DET" })],
      loading: false,
      createTeam: vi.fn(),
      updateTeam: vi.fn(),
      deleteTeam: vi.fn(),
      refresh: vi.fn(),
    });
    const { unmount } = renderPage();
    // Let effects start so cancelled-check cleanup functions are registered.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    // Unmount triggers the cleanup functions: () => { cancelled = true; }
    unmount();
    // If no error thrown, cleanup executed correctly.
    expect(true).toBe(true);
  });

  it("team select onChange fires and loads stats for the new team", async () => {
    const user = userEvent.setup();
    vi.mocked(useCustomTeams).mockReturnValue({
      teams: [
        makeTeamDoc("team1", "Red Sox", { city: "Boston", abbreviation: "BOS" }),
        makeTeamDoc("team2", "Yankees", { city: "NY", abbreviation: "NYY" }),
      ],
      loading: false,
      createTeam: vi.fn(),
      updateTeam: vi.fn(),
      deleteTeam: vi.fn(),
      refresh: vi.fn(),
    });
    vi.mocked(GameHistoryStore.getTeamCareerBattingStats).mockResolvedValue([]);
    vi.mocked(GameHistoryStore.getTeamCareerPitchingStats).mockResolvedValue([]);

    renderPage();
    const select = screen.getByTestId("career-stats-team-select");

    // Wait for the first team to be auto-selected.
    await waitFor(() => {
      expect((select as HTMLSelectElement).value).not.toBe("");
    });

    // Change the selection to the second team — onChange calls navigate('/stats/team2').
    await user.selectOptions(select, "team2");
    expect(mockNavigate).toHaveBeenCalledWith("/stats/team2");
  });

  it("clicking a player row in pitching table navigates to player page", async () => {
    const user = userEvent.setup();
    vi.mocked(useCustomTeams).mockReturnValue({
      teams: [makeTeamDoc("team1", "Yankees", { city: "NY", abbreviation: "NYY" })],
      loading: false,
      createTeam: vi.fn(),
      updateTeam: vi.fn(),
      deleteTeam: vi.fn(),
      refresh: vi.fn(),
    });
    vi.mocked(GameHistoryStore.getTeamCareerBattingStats).mockResolvedValue([]);
    vi.mocked(GameHistoryStore.getTeamCareerPitchingStats).mockResolvedValue([
      {
        playerId: "plyr_p1",
        nameAtGameTime: "Click Pitcher",
        gamesPlayed: 1,
        outsPitched: 9,
        battersFaced: 12,
        hitsAllowed: 2,
        walksAllowed: 1,
        strikeoutsRecorded: 5,
        homersAllowed: 0,
        runsAllowed: 1,
        earnedRuns: 1,
        saves: 0,
        holds: 0,
        pitchesThrown: 0,
        blownSaves: 0,
      },
    ]);

    renderPage();
    const pitchingTab = screen.getByTestId("career-stats-pitching-tab");
    await user.click(pitchingTab);
    await waitFor(() => expect(screen.getByText("Click Pitcher")).toBeInTheDocument());

    // Clicking the pitcher name fires the onClick at line 293.
    await user.click(screen.getByText("Click Pitcher"));
    expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining("/stats/team1/players/"));
  });

  it("clicking a batting column header sorts rows by that column", async () => {
    const user = userEvent.setup();
    vi.mocked(useCustomTeams).mockReturnValue({
      teams: [makeTeamDoc("team1", "Yankees", { city: "NY", abbreviation: "NYY" })],
      loading: false,
      createTeam: vi.fn(),
      updateTeam: vi.fn(),
      deleteTeam: vi.fn(),
      refresh: vi.fn(),
    });
    vi.mocked(GameHistoryStore.getTeamCareerBattingStats).mockResolvedValue([
      {
        playerId: "p1",
        nameAtGameTime: "Aaron",
        gamesPlayed: 5,
        atBats: 20,
        hits: 8,
        doubles: 1,
        triples: 0,
        homers: 2,
        sacFlies: 0,
        walks: 3,
        strikeouts: 4,
        rbi: 5,
        singles: 5,
      },
      {
        playerId: "p2",
        nameAtGameTime: "Bob",
        gamesPlayed: 3,
        atBats: 10,
        hits: 2,
        doubles: 0,
        triples: 0,
        homers: 0,
        sacFlies: 0,
        walks: 1,
        strikeouts: 2,
        rbi: 1,
        singles: 2,
      },
    ]);
    vi.mocked(GameHistoryStore.getTeamCareerPitchingStats).mockResolvedValue([]);

    renderPage();
    await waitFor(() => expect(screen.getByText("Aaron")).toBeInTheDocument());

    // Default sort is by gamesPlayed desc — Aaron (5) should come before Bob (3).
    const rows = screen.getAllByRole("row");
    expect(rows[1].textContent).toContain("Aaron");

    // Click "G" header once (→ still desc, same key) then again (→ asc).
    const gHeader = screen.getAllByRole("columnheader", { name: /^G/i })[0];
    await user.click(gHeader); // toggles to asc
    await waitFor(() => {
      const updatedRows = screen.getAllByRole("row");
      expect(updatedRows[1].textContent).toContain("Bob"); // Bob has fewer games
    });
  });

  it("clicking a pitching column header sorts pitching rows", async () => {
    const user = userEvent.setup();
    vi.mocked(useCustomTeams).mockReturnValue({
      teams: [makeTeamDoc("team1", "Yankees", { city: "NY", abbreviation: "NYY" })],
      loading: false,
      createTeam: vi.fn(),
      updateTeam: vi.fn(),
      deleteTeam: vi.fn(),
      refresh: vi.fn(),
    });
    vi.mocked(GameHistoryStore.getTeamCareerBattingStats).mockResolvedValue([]);
    vi.mocked(GameHistoryStore.getTeamCareerPitchingStats).mockResolvedValue([
      {
        playerId: "p1",
        nameAtGameTime: "ZebraCloser",
        gamesPlayed: 10,
        outsPitched: 27,
        battersFaced: 35,
        hitsAllowed: 5,
        walksAllowed: 3,
        strikeoutsRecorded: 12,
        homersAllowed: 1,
        runsAllowed: 2,
        earnedRuns: 2,
        saves: 8,
        holds: 0,
        pitchesThrown: 0,
        blownSaves: 2,
      },
      {
        playerId: "p2",
        nameAtGameTime: "AcePitcher",
        gamesPlayed: 15,
        outsPitched: 135,
        battersFaced: 160,
        hitsAllowed: 20,
        walksAllowed: 8,
        strikeoutsRecorded: 50,
        homersAllowed: 3,
        runsAllowed: 12,
        earnedRuns: 11,
        saves: 0,
        holds: 0,
        pitchesThrown: 0,
        blownSaves: 0,
      },
    ]);

    renderPage();
    const pitchingTab = screen.getByTestId("career-stats-pitching-tab");
    await user.click(pitchingTab);
    await waitFor(() => expect(screen.getByText("ZebraCloser")).toBeInTheDocument());

    // Default sort is gamesPlayed desc — AcePitcher (15) should come first.
    const rows = screen.getAllByRole("row");
    expect(rows[1].textContent).toContain("AcePitcher");

    // Click "Name" header → sort by name desc (Z before A).
    const nameHeader = screen.getByRole("columnheader", { name: /^Name/i });
    await user.click(nameHeader);
    await waitFor(() => {
      const updatedRows = screen.getAllByRole("row");
      expect(updatedRows[1].textContent).toContain("ZebraCloser");
    });
  });

  it("shows no-teams empty state when there are no teams and no history", async () => {
    // Ensure getDb returns empty completedGames so the loadTeamIds effect
    // doesn't populate teamsWithHistory with non-custom team IDs from a
    // prior test's overridden mock (clearAllMocks only resets call counts,
    // not persistent mockResolvedValue implementations).
    const { getDb } = await import("@storage/db");
    vi.mocked(getDb).mockResolvedValue({
      completedGames: { find: vi.fn(() => ({ exec: vi.fn().mockResolvedValue([]) })) },
    } as any);
    renderPage();
    // Wait for the async loadTeamIds effect to settle (empty → noTeams = true).
    await waitFor(
      () => {
        expect(screen.getByTestId("career-stats-no-teams")).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
    expect(screen.getByText(/no teams yet/i)).toBeInTheDocument();
    // The team selector must NOT be rendered in this state.
    expect(screen.queryByTestId("career-stats-team-select")).not.toBeInTheDocument();
  });

  // ── Team Summary + Leader cards ─────────────────────────────────────────────

  /** Helper: set up a team with gamesPlayed > 0 so TeamSummarySection renders. */
  function setupTeamWithSummary() {
    vi.mocked(useCustomTeams).mockReturnValue({
      teams: [makeTeamDoc("team1", "Cubs", { city: "Chicago", abbreviation: "CHC" })],
      loading: false,
      createTeam: vi.fn(),
      updateTeam: vi.fn(),
      deleteTeam: vi.fn(),
      refresh: vi.fn(),
    });
    vi.mocked(GameHistoryStore.getTeamCareerSummary).mockResolvedValue({
      gamesPlayed: 5,
      wins: 3,
      losses: 2,
      ties: 0,
      winPct: 0.6,
      runsScored: 25,
      runsAllowed: 18,
      runDiff: 7,
      rsPerGame: 5.0,
      raPerGame: 3.6,
      streak: "W2",
      last10: { wins: 3, losses: 2, ties: 0 },
    });
    vi.mocked(GameHistoryStore.getTeamCareerBattingStats).mockResolvedValue([]);
    vi.mocked(GameHistoryStore.getTeamCareerPitchingStats).mockResolvedValue([]);
  }

  it("renders TeamSummarySection with GP and stats when gamesPlayed > 0", async () => {
    setupTeamWithSummary();
    vi.mocked(GameHistoryStore.getTeamBattingLeaders).mockResolvedValue({
      hrLeader: null,
      avgLeader: null,
      rbiLeader: null,
    });
    vi.mocked(GameHistoryStore.getTeamPitchingLeaders).mockResolvedValue({
      eraLeader: null,
      savesLeader: null,
      strikeoutsLeader: null,
    });

    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("team-summary-section")).toBeInTheDocument();
    });
    expect(screen.getByTestId("summary-gp")).toHaveTextContent("5");
    expect(screen.getByTestId("summary-wl")).toHaveTextContent("3-2");
    expect(screen.getByTestId("summary-rs")).toHaveTextContent("25");
    expect(screen.getByTestId("summary-ra")).toHaveTextContent("18");
    expect(screen.getByTestId("summary-diff")).toHaveTextContent("+7");
    expect(screen.getByTestId("summary-streak")).toHaveTextContent("W2");
    expect(screen.getByTestId("summary-last10")).toHaveTextContent("3-2");
  });

  it("shows leader card placeholders when no leaders are available", async () => {
    setupTeamWithSummary();
    vi.mocked(GameHistoryStore.getTeamBattingLeaders).mockResolvedValue({
      hrLeader: null,
      avgLeader: null,
      rbiLeader: null,
    });
    vi.mocked(GameHistoryStore.getTeamPitchingLeaders).mockResolvedValue({
      eraLeader: null,
      savesLeader: null,
      strikeoutsLeader: null,
    });

    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("team-summary-section")).toBeInTheDocument();
    });
    expect(screen.getByText("HR — no data")).toBeInTheDocument();
    expect(screen.getByText("AVG — no qualifier")).toBeInTheDocument();
    expect(screen.getByText("RBI — no data")).toBeInTheDocument();
    expect(screen.getByText("ERA — no qualifier")).toBeInTheDocument();
    expect(screen.getByText("SV — no data")).toBeInTheDocument();
    expect(screen.getByText("K — no data")).toBeInTheDocument();
  });

  it("renders HR leader card and clicking it navigates to player career page", async () => {
    const user = userEvent.setup();
    setupTeamWithSummary();
    vi.mocked(GameHistoryStore.getTeamBattingLeaders).mockResolvedValue({
      hrLeader: {
        playerId: "plyr_hr",
        nameAtGameTime: "Homer King",
        value: 12,
        gamesPlayed: 5,
      },
      avgLeader: null,
      rbiLeader: null,
    });
    vi.mocked(GameHistoryStore.getTeamPitchingLeaders).mockResolvedValue({
      eraLeader: null,
      savesLeader: null,
      strikeoutsLeader: null,
    });

    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("hr-leader-card")).toBeInTheDocument();
    });
    expect(screen.getByTestId("hr-leader-card")).toHaveTextContent("Homer King");
    expect(screen.getByTestId("hr-leader-card")).toHaveTextContent("12");

    await user.click(screen.getByTestId("hr-leader-card"));

    expect(mockNavigate).toHaveBeenCalledWith("/stats/team1/players/plyr_hr");
  });

  it("renders AVG leader card and clicking it navigates to player career page", async () => {
    const user = userEvent.setup();
    setupTeamWithSummary();
    vi.mocked(GameHistoryStore.getTeamBattingLeaders).mockResolvedValue({
      hrLeader: null,
      avgLeader: {
        playerId: "plyr_avg",
        nameAtGameTime: "Avg Queen",
        value: 0.345,
        gamesPlayed: 5,
      },
      rbiLeader: null,
    });
    vi.mocked(GameHistoryStore.getTeamPitchingLeaders).mockResolvedValue({
      eraLeader: null,
      savesLeader: null,
      strikeoutsLeader: null,
    });

    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("avg-leader-card")).toBeInTheDocument();
    });
    expect(screen.getByTestId("avg-leader-card")).toHaveTextContent("Avg Queen");
    // AVG value formatted as .345
    expect(screen.getByTestId("avg-leader-card")).toHaveTextContent(".345");

    await user.click(screen.getByTestId("avg-leader-card"));
    expect(mockNavigate).toHaveBeenCalledWith("/stats/team1/players/plyr_avg");
  });

  it("renders RBI leader card and clicking it navigates", async () => {
    const user = userEvent.setup();
    setupTeamWithSummary();
    vi.mocked(GameHistoryStore.getTeamBattingLeaders).mockResolvedValue({
      hrLeader: null,
      avgLeader: null,
      rbiLeader: {
        playerId: "plyr_rbi",
        nameAtGameTime: "RBI Boss",
        value: 30,
        gamesPlayed: 5,
      },
    });
    vi.mocked(GameHistoryStore.getTeamPitchingLeaders).mockResolvedValue({
      eraLeader: null,
      savesLeader: null,
      strikeoutsLeader: null,
    });

    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("rbi-leader-card")).toBeInTheDocument();
    });
    expect(screen.getByTestId("rbi-leader-card")).toHaveTextContent("RBI Boss");

    await user.click(screen.getByTestId("rbi-leader-card"));
    expect(mockNavigate).toHaveBeenCalledWith("/stats/team1/players/plyr_rbi");
  });

  it("renders ERA leader card and clicking it navigates to player career page", async () => {
    const user = userEvent.setup();
    setupTeamWithSummary();
    vi.mocked(GameHistoryStore.getTeamBattingLeaders).mockResolvedValue({
      hrLeader: null,
      avgLeader: null,
      rbiLeader: null,
    });
    vi.mocked(GameHistoryStore.getTeamPitchingLeaders).mockResolvedValue({
      eraLeader: {
        playerId: "plyr_era",
        nameAtGameTime: "Ace Starter",
        value: 2.25,
        gamesPlayed: 5,
      },
      savesLeader: null,
      strikeoutsLeader: null,
    });

    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("era-leader-card")).toBeInTheDocument();
    });
    expect(screen.getByTestId("era-leader-card")).toHaveTextContent("Ace Starter");
    expect(screen.getByTestId("era-leader-card")).toHaveTextContent("2.25");

    await user.click(screen.getByTestId("era-leader-card"));
    expect(mockNavigate).toHaveBeenCalledWith("/stats/team1/players/plyr_era");
  });

  it("renders SV leader card and clicking it navigates", async () => {
    const user = userEvent.setup();
    setupTeamWithSummary();
    vi.mocked(GameHistoryStore.getTeamBattingLeaders).mockResolvedValue({
      hrLeader: null,
      avgLeader: null,
      rbiLeader: null,
    });
    vi.mocked(GameHistoryStore.getTeamPitchingLeaders).mockResolvedValue({
      eraLeader: null,
      savesLeader: {
        playerId: "plyr_sv",
        nameAtGameTime: "Save King",
        value: 15,
        gamesPlayed: 5,
      },
      strikeoutsLeader: null,
    });

    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("saves-leader-card")).toBeInTheDocument();
    });
    expect(screen.getByTestId("saves-leader-card")).toHaveTextContent("Save King");

    await user.click(screen.getByTestId("saves-leader-card"));
    expect(mockNavigate).toHaveBeenCalledWith("/stats/team1/players/plyr_sv");
  });

  it("renders K (strikeouts) leader card and clicking it navigates", async () => {
    const user = userEvent.setup();
    setupTeamWithSummary();
    vi.mocked(GameHistoryStore.getTeamBattingLeaders).mockResolvedValue({
      hrLeader: null,
      avgLeader: null,
      rbiLeader: null,
    });
    vi.mocked(GameHistoryStore.getTeamPitchingLeaders).mockResolvedValue({
      eraLeader: null,
      savesLeader: null,
      strikeoutsLeader: {
        playerId: "plyr_k",
        nameAtGameTime: "K Machine",
        value: 88,
        gamesPlayed: 5,
      },
    });

    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("k-leader-card")).toBeInTheDocument();
    });
    expect(screen.getByTestId("k-leader-card")).toHaveTextContent("K Machine");

    await user.click(screen.getByTestId("k-leader-card"));
    expect(mockNavigate).toHaveBeenCalledWith("/stats/team1/players/plyr_k");
  });

  it("renders TeamSummarySection even when gamesPlayed is 0", async () => {
    vi.mocked(useCustomTeams).mockReturnValue({
      teams: [makeTeamDoc("team1", "Cubs", { city: "Chicago", abbreviation: "CHC" })],
      loading: false,
      createTeam: vi.fn(),
      updateTeam: vi.fn(),
      deleteTeam: vi.fn(),
      refresh: vi.fn(),
    });
    // Explicitly set gamesPlayed: 0 — section should still render (shows GP=0).
    vi.mocked(GameHistoryStore.getTeamCareerSummary).mockResolvedValue({
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      ties: 0,
      winPct: 0,
      runsScored: 0,
      runsAllowed: 0,
      runDiff: 0,
      rsPerGame: 0,
      raPerGame: 0,
      streak: "-",
      last10: { wins: 0, losses: 0, ties: 0 },
    });
    vi.mocked(GameHistoryStore.getTeamBattingLeaders).mockResolvedValue({
      hrLeader: null,
      avgLeader: null,
      rbiLeader: null,
    });
    vi.mocked(GameHistoryStore.getTeamPitchingLeaders).mockResolvedValue({
      eraLeader: null,
      savesLeader: null,
      strikeoutsLeader: null,
    });
    renderPage();
    await waitFor(() => {
      // Section renders whenever teamSummary is non-null, regardless of gamesPlayed.
      expect(screen.getByTestId("team-summary-section")).toBeInTheDocument();
    });
    expect(screen.getByTestId("summary-gp")).toHaveTextContent("0");
  });

  it("keyboard Enter on batting column header triggers sort", async () => {
    const user = userEvent.setup();
    vi.mocked(useCustomTeams).mockReturnValue({
      teams: [makeTeamDoc("team1", "Yankees", { city: "NY", abbreviation: "NYY" })],
      loading: false,
      createTeam: vi.fn(),
      updateTeam: vi.fn(),
      deleteTeam: vi.fn(),
      refresh: vi.fn(),
    });
    vi.mocked(GameHistoryStore.getTeamCareerBattingStats).mockResolvedValue([
      {
        playerId: "p1",
        nameAtGameTime: "Alpha",
        gamesPlayed: 10,
        atBats: 30,
        hits: 10,
        doubles: 2,
        triples: 0,
        homers: 3,
        sacFlies: 0,
        walks: 4,
        strikeouts: 5,
        rbi: 8,
        singles: 5,
      },
      {
        playerId: "p2",
        nameAtGameTime: "Zeta",
        gamesPlayed: 5,
        atBats: 15,
        hits: 3,
        doubles: 0,
        triples: 0,
        homers: 0,
        sacFlies: 0,
        walks: 1,
        strikeouts: 2,
        rbi: 2,
        singles: 3,
      },
    ]);
    vi.mocked(GameHistoryStore.getTeamCareerPitchingStats).mockResolvedValue([]);

    renderPage();
    await waitFor(() => expect(screen.getByText("Alpha")).toBeInTheDocument());

    // Focus the Name header and press Enter to sort by name desc.
    const nameHeader = screen.getByRole("columnheader", { name: /^Name/i });
    nameHeader.focus();
    await user.keyboard("{Enter}");
    await waitFor(() => {
      const updatedRows = screen.getAllByRole("row");
      // Name desc: "Zeta" > "Alpha"
      expect(updatedRows[1].textContent).toContain("Zeta");
    });
  });

  it("keyboard Enter on pitching column header triggers sort", async () => {
    const user = userEvent.setup();
    vi.mocked(useCustomTeams).mockReturnValue({
      teams: [makeTeamDoc("team1", "Yankees", { city: "NY", abbreviation: "NYY" })],
      loading: false,
      createTeam: vi.fn(),
      updateTeam: vi.fn(),
      deleteTeam: vi.fn(),
      refresh: vi.fn(),
    });
    vi.mocked(GameHistoryStore.getTeamCareerBattingStats).mockResolvedValue([]);
    vi.mocked(GameHistoryStore.getTeamCareerPitchingStats).mockResolvedValue([
      {
        playerId: "p1",
        nameAtGameTime: "Alpha",
        gamesPlayed: 5,
        outsPitched: 27,
        battersFaced: 30,
        hitsAllowed: 5,
        walksAllowed: 2,
        strikeoutsRecorded: 12,
        homersAllowed: 1,
        runsAllowed: 3,
        earnedRuns: 3,
        saves: 0,
        holds: 0,
        pitchesThrown: 0,
        blownSaves: 0,
      },
      {
        playerId: "p2",
        nameAtGameTime: "Zeta",
        gamesPlayed: 10,
        outsPitched: 90,
        battersFaced: 110,
        hitsAllowed: 20,
        walksAllowed: 8,
        strikeoutsRecorded: 40,
        homersAllowed: 3,
        runsAllowed: 15,
        earnedRuns: 14,
        saves: 0,
        holds: 0,
        pitchesThrown: 0,
        blownSaves: 0,
      },
    ]);

    renderPage();
    const pitchingTab = screen.getByTestId("career-stats-pitching-tab");
    await user.click(pitchingTab);
    await waitFor(() => expect(screen.getByText("Alpha")).toBeInTheDocument());

    // Press Enter on Name header to sort by name desc.
    const nameHeader = screen.getByRole("columnheader", { name: /^Name/i });
    nameHeader.focus();
    await user.keyboard("{Enter}");
    await waitFor(() => {
      const updatedRows = screen.getAllByRole("row");
      expect(updatedRows[1].textContent).toContain("Zeta");
    });
  });
});
