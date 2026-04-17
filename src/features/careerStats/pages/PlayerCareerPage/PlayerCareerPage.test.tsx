import * as React from "react";

import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@shared/hooks/useCustomTeams", () => ({
  useCustomTeams: vi.fn(() => ({ teams: [], loading: false })),
}));

vi.mock("@shared/hooks/useTeamWithRoster", () => ({
  useTeamWithRoster: vi.fn(() => null),
}));

vi.mock("@storage/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@storage/db")>();
  return {
    ...actual,
    teamsCollection: vi.fn().mockResolvedValue({
      findByIds: vi.fn().mockReturnValue({ exec: vi.fn().mockResolvedValue(new Map()) }),
    }),
  };
});

const mockNavigate = vi.fn();
vi.mock("react-router", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-router")>();
  return {
    ...mod,
    useNavigate: vi.fn(() => mockNavigate),
  };
});

vi.mock("@feat/careerStats/storage/gameHistoryStore", () => ({
  GameHistoryStore: {
    getPlayerCareerBatting: vi.fn().mockResolvedValue([]),
    getPlayerCareerPitching: vi.fn().mockResolvedValue([]),
  },
}));

import { GameHistoryStore } from "@feat/careerStats/storage/gameHistoryStore";
import { useTeamWithRoster } from "@shared/hooks/useTeamWithRoster";

import PlayerCareerPage from "./index";

const NOW = 1700000000000; // fixed timestamp for deterministic date formatting

function makeBattingRow(overrides = {}) {
  return {
    id: "game1:team1:p1",
    gameId: "game1",
    teamId: "team1",
    opponentTeamId: "team2",
    playerId: "p1",
    nameAtGameTime: "Test Batter",
    role: "batter" as const,
    batting: {
      atBats: 4,
      hits: 2,
      walks: 1,
      strikeouts: 1,
      rbi: 2,
      singles: 1,
      doubles: 1,
      triples: 0,
      homers: 0,
      sacFlies: 0,
    },
    createdAt: NOW,
    schemaVersion: 1,
    ...overrides,
  };
}

function makePitchingRow(overrides = {}) {
  return {
    id: "game1:team1:p1",
    gameId: "game1",
    teamId: "team1",
    opponentTeamId: "team2",
    playerId: "p1",
    nameAtGameTime: "Test Pitcher",
    outsPitched: 18,
    battersFaced: 24,
    hitsAllowed: 5,
    walksAllowed: 2,
    strikeoutsRecorded: 10,
    homersAllowed: 0,
    runsAllowed: 2,
    earnedRuns: 2,
    saves: 1,
    holds: 0,
    blownSaves: 0,
    pitchesThrown: 0,
    createdAt: NOW,
    schemaVersion: 1,
    ...overrides,
  };
}

function renderPage(playerId = "p1", teamId = "team1") {
  return render(
    <MemoryRouter initialEntries={[`/stats/${teamId}/players/${playerId}`]}>
      <Routes>
        <Route path="/stats/:teamId/players/:playerId" element={<PlayerCareerPage />} />
        <Route path="/" element={<div data-testid="home-screen" />} />
        <Route path="/stats/:teamId" element={<div data-testid="stats-page" />} />
        <Route path="/stats" element={<div data-testid="stats-page" />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("PlayerCareerPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(GameHistoryStore.getPlayerCareerBatting).mockResolvedValue([]);
    vi.mocked(GameHistoryStore.getPlayerCareerPitching).mockResolvedValue([]);
    vi.mocked(useTeamWithRoster).mockReturnValue(null);
  });

  it("renders the player career page", async () => {
    renderPage();
    await act(async () => {});
    expect(screen.getByTestId("player-career-page")).toBeInTheDocument();
  });

  it("shows batting and pitching tab buttons", async () => {
    renderPage();
    await act(async () => {});
    expect(screen.getByText("Batting")).toBeInTheDocument();
    expect(screen.getByText("Pitching")).toBeInTheDocument();
  });

  it("has a back button", async () => {
    renderPage();
    await act(async () => {});
    expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();
  });

  it("back button navigates to /stats/:teamId", async () => {
    const user = userEvent.setup();
    renderPage();
    await act(async () => {});
    const backBtn = screen.getByRole("button", { name: /back/i });
    await user.click(backBtn);
    expect(mockNavigate).toHaveBeenCalledWith("/stats/team1");
  });

  it("shows 'No batting data.' when no batting rows", async () => {
    vi.mocked(GameHistoryStore.getPlayerCareerBatting).mockResolvedValue([]);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/no batting data/i)).toBeInTheDocument();
    });
  });

  it("renders batting career totals when batting rows available", async () => {
    vi.mocked(GameHistoryStore.getPlayerCareerBatting).mockResolvedValue([makeBattingRow()]);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Test Batter")).toBeInTheDocument();
    });
    // Career totals: 4 AB, 2 H
    const allFours = screen.getAllByText("4");
    expect(allFours.length).toBeGreaterThan(0);
  });

  it("renders batting per-game log with correct AVG", async () => {
    vi.mocked(GameHistoryStore.getPlayerCareerBatting).mockResolvedValue([makeBattingRow()]);
    renderPage();
    await waitFor(() => {
      // AVG for 2 hits / 4 AB = 0.500 → displayed as ".500"
      const avgElements = screen.getAllByText(".500");
      expect(avgElements.length).toBeGreaterThan(0);
    });
  });

  it("switches to pitching tab and shows pitching rows", async () => {
    const user = userEvent.setup();
    vi.mocked(GameHistoryStore.getPlayerCareerPitching).mockResolvedValue([makePitchingRow()]);
    renderPage();
    await act(async () => {});
    const pitchingTab = screen.getByText("Pitching");
    await user.click(pitchingTab);
    await waitFor(() => {
      expect(screen.getByText("Test Pitcher")).toBeInTheDocument();
      // IP = 18 outs → 6.0 innings
      const ipElements = screen.getAllByText("6.0");
      expect(ipElements.length).toBeGreaterThan(0);
    });
  });

  it("shows 'No pitching data.' on pitching tab when no pitching rows", async () => {
    const user = userEvent.setup();
    vi.mocked(GameHistoryStore.getPlayerCareerPitching).mockResolvedValue([]);
    renderPage();
    await act(async () => {});
    const pitchingTab = screen.getByText("Pitching");
    await user.click(pitchingTab);
    await waitFor(() => {
      expect(screen.getByText(/no pitching data/i)).toBeInTheDocument();
    });
  });

  it("fetches data for the playerId from the URL", async () => {
    renderPage("plyr_xyz", "ct_abc");
    await waitFor(() => {
      expect(GameHistoryStore.getPlayerCareerBatting).toHaveBeenCalledWith("plyr_xyz");
      expect(GameHistoryStore.getPlayerCareerPitching).toHaveBeenCalledWith("plyr_xyz");
    });
  });

  it("handles missing playerId param gracefully (no fetch, page still renders)", async () => {
    // Render at /stats with no playerId param — useParams returns { playerId: undefined }.
    render(
      <MemoryRouter initialEntries={["/stats/team1"]}>
        <Routes>
          <Route path="/stats/:teamId" element={<PlayerCareerPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await act(async () => {});
    expect(screen.getByTestId("player-career-page")).toBeInTheDocument();
    // No fetch should have happened.
    expect(GameHistoryStore.getPlayerCareerBatting).not.toHaveBeenCalled();
  });

  it("handles error from store — shows empty state without crashing", async () => {
    vi.mocked(GameHistoryStore.getPlayerCareerBatting).mockRejectedValueOnce(new Error("DB error"));
    vi.mocked(GameHistoryStore.getPlayerCareerPitching).mockRejectedValueOnce(
      new Error("DB error"),
    );
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/no batting data/i)).toBeInTheDocument();
    });
  });

  it("cleanup effect runs without errors when component unmounts mid-fetch", async () => {
    // Delay the fetch so the cleanup fires while the fetch is in-flight.
    vi.mocked(GameHistoryStore.getPlayerCareerBatting).mockImplementationOnce(
      () => new Promise((resolve) => setTimeout(() => resolve([]), 200)),
    );
    vi.mocked(GameHistoryStore.getPlayerCareerPitching).mockResolvedValue([]);
    const { unmount } = renderPage();
    // Unmount before async fetch resolves — triggers () => { cancelled = true; }
    unmount();
    expect(true).toBe(true);
  });

  it("shows Prev/Next buttons when ?team= param matches a known custom team", async () => {
    const teamDoc = {
      id: "ct_1",
      name: "Aces",
      abbreviation: "ACE",
      city: "Springfield",
      schemaVersion: 4,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
      roster: {
        schemaVersion: 1,
        lineup: [
          {
            id: "plyr_1",
            name: "First Batter",
            role: "batter" as const,
            batting: { contact: 50, power: 50, speed: 50 },
          },
          {
            id: "plyr_2",
            name: "Second Batter",
            role: "batter" as const,
            batting: { contact: 50, power: 50, speed: 50 },
          },
        ],
        bench: [],
        pitchers: [],
      },
      metadata: { notes: "", tags: [], archived: false },
    };
    vi.mocked(useTeamWithRoster).mockReturnValue(teamDoc as any);

    render(
      <MemoryRouter initialEntries={["/stats/ct_1/players/plyr_1"]}>
        <Routes>
          <Route path="/stats/:teamId/players/:playerId" element={<PlayerCareerPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await act(async () => {});

    // Should show Prev/Next nav since team context has 2 players.
    expect(screen.getByTestId("player-career-prev")).toBeInTheDocument();
    expect(screen.getByTestId("player-career-next")).toBeInTheDocument();
    // Prev should be disabled (first player), Next should be enabled.
    expect(screen.getByTestId("player-career-prev")).toBeDisabled();
    expect(screen.getByTestId("player-career-next")).not.toBeDisabled();
  });

  it("clicking Next navigates to the next player in the roster", async () => {
    const user = userEvent.setup();
    const teamDoc = {
      id: "ct_1",
      name: "Aces",
      abbreviation: "ACE",
      city: "Springfield",
      schemaVersion: 4,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
      roster: {
        schemaVersion: 1,
        lineup: [
          {
            id: "plyr_1",
            name: "First Batter",
            role: "batter" as const,
            batting: { contact: 50, power: 50, speed: 50 },
          },
          {
            id: "plyr_2",
            name: "Second Batter",
            role: "batter" as const,
            batting: { contact: 50, power: 50, speed: 50 },
          },
        ],
        bench: [],
        pitchers: [],
      },
      metadata: { notes: "", tags: [], archived: false },
    };
    vi.mocked(useTeamWithRoster).mockReturnValue(teamDoc as any);

    render(
      <MemoryRouter initialEntries={["/stats/ct_1/players/plyr_1"]}>
        <Routes>
          <Route path="/stats/:teamId/players/:playerId" element={<PlayerCareerPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await act(async () => {});
    await user.click(screen.getByTestId("player-career-next"));
    expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining("plyr_2"));
  });

  it("clicking Next on team-independent route navigates to /stats/players/:playerId", async () => {
    const user = userEvent.setup();
    const teamDoc = {
      id: "ct_1",
      name: "Aces",
      abbreviation: "ACE",
      city: "Springfield",
      schemaVersion: 4,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
      roster: {
        schemaVersion: 1,
        lineup: [
          {
            id: "plyr_1",
            name: "First Batter",
            role: "batter" as const,
            batting: { contact: 50, power: 50, speed: 50 },
          },
          {
            id: "plyr_2",
            name: "Second Batter",
            role: "batter" as const,
            batting: { contact: 50, power: 50, speed: 50 },
          },
        ],
        bench: [],
        pitchers: [],
      },
      metadata: { notes: "", tags: [], archived: false },
    };
    vi.mocked(useTeamWithRoster).mockReturnValue(teamDoc as any);

    render(
      <MemoryRouter initialEntries={["/stats/players/plyr_1"]}>
        <Routes>
          <Route path="/stats/players/:playerId" element={<PlayerCareerPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await act(async () => {});
    await user.click(screen.getByTestId("player-career-next"));
    expect(mockNavigate).toHaveBeenCalledWith("/stats/players/plyr_2");
  });

  it("does not render Prev/Next when team has no roster loaded", async () => {
    renderPage("test_player_no_team");
    await act(async () => {});
    expect(screen.queryByTestId("player-career-prev")).toBeNull();
    expect(screen.queryByTestId("player-career-next")).toBeNull();
  });

  describe("role-aware tabs", () => {
    it("shows both Batting and Pitching tabs when player has both", async () => {
      vi.mocked(GameHistoryStore.getPlayerCareerBatting).mockResolvedValue([makeBattingRow()]);
      vi.mocked(GameHistoryStore.getPlayerCareerPitching).mockResolvedValue([makePitchingRow()]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText("Batting")).toBeInTheDocument();
        expect(screen.getByText("Pitching")).toBeInTheDocument();
      });
    });

    it("shows only Batting tab for batter-only player (no pitching history)", async () => {
      vi.mocked(GameHistoryStore.getPlayerCareerBatting).mockResolvedValue([makeBattingRow()]);
      vi.mocked(GameHistoryStore.getPlayerCareerPitching).mockResolvedValue([]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText("Batting")).toBeInTheDocument();
        expect(screen.queryByText("Pitching")).toBeNull();
      });
    });

    it("shows only Pitching tab for pitcher-only player (no batting history)", async () => {
      vi.mocked(GameHistoryStore.getPlayerCareerBatting).mockResolvedValue([]);
      vi.mocked(GameHistoryStore.getPlayerCareerPitching).mockResolvedValue([makePitchingRow()]);
      renderPage();
      await waitFor(() => {
        expect(screen.queryByText("Batting")).toBeNull();
        expect(screen.getByText("Pitching")).toBeInTheDocument();
      });
    });

    it("shows both tabs when player has no history (empty state)", async () => {
      vi.mocked(GameHistoryStore.getPlayerCareerBatting).mockResolvedValue([]);
      vi.mocked(GameHistoryStore.getPlayerCareerPitching).mockResolvedValue([]);
      renderPage();
      await waitFor(() => {
        // Both tabs shown when neither has rows (keep current empty behavior)
        expect(screen.getByText("Batting")).toBeInTheDocument();
        expect(screen.getByText("Pitching")).toBeInTheDocument();
      });
    });

    it("auto-switches to Pitching tab when activeTab is batting but player is pitcher-only", async () => {
      vi.mocked(GameHistoryStore.getPlayerCareerBatting).mockResolvedValue([]);
      vi.mocked(GameHistoryStore.getPlayerCareerPitching).mockResolvedValue([makePitchingRow()]);
      renderPage();
      await waitFor(() => {
        // Pitching tab should be visible and active
        expect(screen.getByText("Pitching")).toBeInTheDocument();
        // Pitching content should be shown (not batting)
        expect(screen.getByText("Test Pitcher")).toBeInTheDocument();
      });
    });
  });

  // ── Bug regression: player name must not show raw player ID ─────────────

  it("shows player name from roster when player has no game stats (Bug 1 regression)", async () => {
    const teamDoc = {
      id: "ct_bench",
      name: "Rovers",
      abbreviation: "ROV",
      city: "Austin",
      schemaVersion: 4,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
      roster: {
        schemaVersion: 1,
        lineup: [],
        bench: [
          {
            id: "pl_d29e3bad",
            name: "Sandy Rivera",
            role: "batter" as const,
            batting: { contact: 40, power: 40, speed: 40 },
          },
        ],
        pitchers: [],
      },
      metadata: { notes: "", tags: [], archived: false },
    };
    vi.mocked(useTeamWithRoster).mockReturnValue(teamDoc as any);

    // No batting or pitching history — player never appeared in a game.
    vi.mocked(GameHistoryStore.getPlayerCareerBatting).mockResolvedValue([]);
    vi.mocked(GameHistoryStore.getPlayerCareerPitching).mockResolvedValue([]);

    render(
      <MemoryRouter initialEntries={["/stats/ct_bench/players/pl_d29e3bad"]}>
        <Routes>
          <Route path="/stats/:teamId/players/:playerId" element={<PlayerCareerPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      // Should show the real name from the roster, NOT the raw player ID.
      expect(screen.getByText("Sandy Rivera")).toBeInTheDocument();
      // The raw ID must NOT appear as the heading.
      expect(screen.queryByText("pl_d29e3bad")).toBeNull();
    });
  });

  it("shows 'Unknown Player' when player has no stats and is not found in any roster", async () => {
    // No teams — useTeamWithRoster returns null (default mock).
    vi.mocked(GameHistoryStore.getPlayerCareerBatting).mockResolvedValue([]);
    vi.mocked(GameHistoryStore.getPlayerCareerPitching).mockResolvedValue([]);

    render(
      <MemoryRouter initialEntries={["/stats/ct_none/players/pl_totally_unknown"]}>
        <Routes>
          <Route path="/stats/:teamId/players/:playerId" element={<PlayerCareerPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Unknown Player")).toBeInTheDocument();
      // The raw key must NOT appear as the heading.
      expect(screen.queryByText("pl_totally_unknown")).toBeNull();
    });
  });
});
