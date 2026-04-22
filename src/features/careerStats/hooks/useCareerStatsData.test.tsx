import * as React from "react";

import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";

vi.mock("@storage/db", () => ({
  getDb: vi.fn().mockResolvedValue({
    completedGames: {
      find: vi.fn(() => ({
        exec: vi.fn().mockResolvedValue([]),
        // Reactive observable: subscribe fires immediately with empty array.
        $: {
          subscribe: (fn: (docs: unknown[]) => void) => {
            fn([]);
            return { unsubscribe: vi.fn() };
          },
        },
      })),
    },
  }),
}));

vi.mock("@shared/hooks/useCustomTeams", () => ({
  useCustomTeams: vi.fn(() => ({
    teams: [
      { id: "team1", roster: { lineup: [], bench: [], pitchers: [] } },
      { id: "team2", roster: { lineup: [], bench: [], pitchers: [] } },
    ],
    loading: false,
  })),
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
  GameHistoryStore: {
    getTeamCareerBattingStats: vi.fn().mockResolvedValue([]),
    getTeamCareerPitchingStats: vi.fn().mockResolvedValue([]),
    getTeamCareerSummary: vi.fn().mockResolvedValue(null),
    getTeamBattingLeaders: vi
      .fn()
      .mockResolvedValue({ hrLeader: null, avgLeader: null, rbiLeader: null }),
    getTeamPitchingLeaders: vi
      .fn()
      .mockResolvedValue({ eraLeader: null, savesLeader: null, strikeoutsLeader: null }),
  },
}));

import { useCustomTeams } from "@shared/hooks/useCustomTeams";

import { getDb } from "@storage/db";

import { useCareerStatsData } from "./useCareerStatsData";

function Probe() {
  const { selectedTeamId } = useCareerStatsData();
  return <div data-testid="selected-team-id">{selectedTeamId}</div>;
}

describe("useCareerStatsData", () => {
  it("reads selectedTeamId from the :teamId path param", async () => {
    render(
      <MemoryRouter initialEntries={["/stats/team2"]}>
        <Routes>
          <Route path="/stats/:teamId" element={<Probe />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("selected-team-id")).toHaveTextContent("team2");
    });
  });

  it("redirects /stats deterministically when only history team IDs exist", async () => {
    vi.mocked(useCustomTeams).mockReturnValue({ teams: [], loading: false } as any);
    vi.mocked(getDb).mockResolvedValue({
      completedGames: {
        find: vi.fn(() => ({
          // Reactive observable: subscribe fires immediately with the game docs.
          // (exec is not called by the reactive subscription path)
          $: {
            subscribe: (fn: (docs: unknown[]) => void) => {
              fn([{ toJSON: () => ({ homeTeamId: "z_team", awayTeamId: "a_team" }) }]);
              return { unsubscribe: vi.fn() };
            },
          },
        })),
      },
    } as any);

    render(
      <MemoryRouter initialEntries={["/stats"]}>
        <Routes>
          <Route path="/stats" element={<Probe />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/stats/a_team", { replace: true });
    });
  });
});
