import * as React from "react";

import type { ContextValue } from "@feat/gameplay/context/index";
import { GameContext } from "@feat/gameplay/context/index";
import { useCustomTeams } from "@shared/hooks/useCustomTeams";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeContextValue } from "@test/testHelpers";

import GameControls from ".";

vi.mock("@feat/gameplay/utils/announce", () => ({
  playDecisionChime: vi.fn(),
  setAnnouncementVolume: vi.fn(),
  setAlertVolume: vi.fn(),
  getAnnouncementVolume: vi.fn().mockReturnValue(1),
  getAlertVolume: vi.fn().mockReturnValue(1),
  announce: vi.fn(),
  cancelAnnouncements: vi.fn(),
  isSpeechPending: vi.fn().mockReturnValue(false),
  canAnnounce: vi.fn().mockReturnValue(true),
  setSpeechRate: vi.fn(),
  playVictoryFanfare: vi.fn(),
  play7thInningStretch: vi.fn(),
}));

vi.mock("@feat/saves/hooks/useSaveStore", () => ({
  useSaveStore: vi.fn(() => ({
    saves: [],
    createSave: vi.fn().mockResolvedValue("save_1"),
    appendEvents: vi.fn().mockResolvedValue(undefined),
    updateProgress: vi.fn().mockResolvedValue(undefined),
    deleteSave: vi.fn().mockResolvedValue(undefined),
    exportRxdbSave: vi.fn().mockResolvedValue("{}"),
    importRxdbSave: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock("@shared/hooks/useCustomTeams", () => ({
  useCustomTeams: vi.fn(),
}));

vi.mock("@feat/customTeams/storage/customTeamStore", () => ({
  CustomTeamStore: {
    getCustomTeam: vi.fn().mockResolvedValue(null),
    listCustomTeams: vi.fn().mockResolvedValue([]),
    createCustomTeam: vi.fn().mockResolvedValue("ct_test"),
    updateCustomTeam: vi.fn().mockResolvedValue(undefined),
    deleteCustomTeam: vi.fn().mockResolvedValue(undefined),
    archiveCustomTeam: vi.fn().mockResolvedValue(undefined),
    unarchiveCustomTeam: vi.fn().mockResolvedValue(undefined),
  },
  makeCustomTeamStore: vi.fn(),
}));

const renderWithContext = (ui: React.ReactElement, ctx: ContextValue = makeContextValue()) =>
  render(<GameContext.Provider value={ctx}>{ui}</GameContext.Provider>);

describe("GameControls", () => {
  beforeEach(() => {
    localStorage.clear();
    // Default: empty teams list (most tests don't check team-name resolution).
    vi.mocked(useCustomTeams).mockReturnValue({
      teams: [] as any,
      loading: false,
      createTeam: vi.fn(),
      updateTeam: vi.fn(),
      deleteTeam: vi.fn(),
      refresh: vi.fn(),
    });
  });

  it("does NOT show Batter Up button (removed in favor of Play ball dialog)", () => {
    renderWithContext(<GameControls />, makeContextValue({ gameOver: false }));
    expect(screen.queryByRole("button", { name: /batter up/i })).not.toBeInTheDocument();
  });

  it("shows Manager Mode checkbox when gameStarted=true", () => {
    renderWithContext(<GameControls gameStarted />, makeContextValue());
    expect(screen.getByRole("checkbox", { name: /manager mode/i })).toBeInTheDocument();
  });

  it("does NOT show Manager Mode checkbox when gameStarted=false", () => {
    renderWithContext(<GameControls gameStarted={false} />);
    expect(screen.queryByRole("checkbox", { name: /manager mode/i })).not.toBeInTheDocument();
  });

  it("shows volume sliders", () => {
    renderWithContext(<GameControls />);
    expect(screen.getByRole("slider", { name: /announcement volume/i })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: /music volume/i })).toBeInTheDocument();
  });

  it("shows speed slider", () => {
    renderWithContext(<GameControls />);
    expect(screen.getByRole("slider", { name: /game speed/i })).toBeInTheDocument();
  });

  it("enabling Manager Mode requests notification permission", async () => {
    (Notification as any).permission = "default";
    const requestPermission = vi.fn().mockResolvedValue("granted");
    (Notification as any).requestPermission = requestPermission;
    const user = userEvent.setup();
    renderWithContext(<GameControls gameStarted />, makeContextValue());
    await user.click(screen.getByRole("checkbox", { name: /manager mode/i }));
    expect(requestPermission).toHaveBeenCalled();
    (Notification as any).permission = "granted";
  });

  it("changing speed slider updates the value", () => {
    renderWithContext(<GameControls />);
    const slider = screen.getByRole("slider", { name: /game speed/i });
    fireEvent.change(slider, { target: { value: "2" } });
    expect((slider as HTMLInputElement).value).toBe("2");
  });

  it("changing announcement volume slider fires handler", () => {
    renderWithContext(<GameControls />);
    const slider = screen.getByRole("slider", { name: /announcement volume/i });
    fireEvent.change(slider, { target: { value: "0.5" } });
    expect((slider as HTMLInputElement).value).toBe("0.5");
  });

  it("changing music volume slider fires handler", () => {
    renderWithContext(<GameControls />);
    const slider = screen.getByRole("slider", { name: /music volume/i });
    fireEvent.change(slider, { target: { value: "0.3" } });
    expect((slider as HTMLInputElement).value).toBe("0.3");
  });

  it("renders team and strategy selectors in manager mode", () => {
    localStorage.setItem("managerMode", "true");
    vi.mocked(useCustomTeams).mockReturnValue({
      teams: [
        {
          id: "ct_yankees",
          name: "Yankees",
          city: "",
          abbreviation: "YNK",
          schemaVersion: 1,
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-01T00:00:00.000Z",
          roster: { schemaVersion: 1, lineup: [], bench: [], pitchers: [] },
          metadata: { archived: false },
        },
        {
          id: "ct_redsox",
          name: "Red Sox",
          city: "",
          abbreviation: "RSX",
          schemaVersion: 1,
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-01T00:00:00.000Z",
          roster: { schemaVersion: 1, lineup: [], bench: [], pitchers: [] },
          metadata: { archived: false },
        },
      ] as any,
      loading: false,
      createTeam: vi.fn(),
      updateTeam: vi.fn(),
      deleteTeam: vi.fn(),
      refresh: vi.fn(),
    });
    renderWithContext(
      <GameControls gameStarted />,
      makeContextValue({ teams: ["ct_yankees", "ct_redsox"] }),
    );
    const selects = screen.getAllByRole("combobox");
    expect(selects.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Yankees")).toBeInTheDocument();
  });

  it("speed slider has correct range", () => {
    renderWithContext(<GameControls />);
    const slider = screen.getByTestId("speed-slider");
    expect(slider).toHaveAttribute("min", "0");
    expect(slider).toHaveAttribute("max", "3");
    expect(slider).toHaveAttribute("step", "1");
  });

  it("can set Instant speed via slider", () => {
    renderWithContext(<GameControls />);
    const slider = screen.getByRole("slider", { name: /game speed/i });
    fireEvent.change(slider, { target: { value: "3" } });
    expect((slider as HTMLInputElement).value).toBe("3");
  });

  describe("isCommitting prop", () => {
    it("Home button is disabled when isCommitting=true", () => {
      renderWithContext(<GameControls onBackToHome={vi.fn()} isCommitting />, makeContextValue());
      expect(screen.getByTestId("back-to-home-button")).toBeDisabled();
    });

    it("Home button is enabled when isCommitting=false", () => {
      renderWithContext(
        <GameControls onBackToHome={vi.fn()} isCommitting={false} />,
        makeContextValue(),
      );
      expect(screen.getByTestId("back-to-home-button")).not.toBeDisabled();
    });

    it("New Game button renders disabled with 'Saving…' label when gameOver=true and isCommitting=true", () => {
      renderWithContext(
        <GameControls onNewGame={vi.fn()} isCommitting />,
        makeContextValue({ gameOver: true }),
      );
      const btn = screen.getByTestId("new-game-button");
      expect(btn).toBeDisabled();
      expect(btn).toHaveTextContent("Saving…");
    });

    it("New Game button renders enabled with 'New Game' label when gameOver=true and isCommitting=false", () => {
      renderWithContext(
        <GameControls onNewGame={vi.fn()} isCommitting={false} />,
        makeContextValue({ gameOver: true }),
      );
      const btn = screen.getByTestId("new-game-button");
      expect(btn).not.toBeDisabled();
      expect(btn).toHaveTextContent("New Game");
    });
  });

  it("shows pause/play button when gameStarted=true and game not over", () => {
    renderWithContext(<GameControls gameStarted />, makeContextValue({ gameOver: false }));
    expect(screen.getByTestId("pause-play-button")).toBeInTheDocument();
    expect(screen.getByTestId("pause-play-button")).toHaveAttribute("aria-label", "Pause game");
  });

  it("does NOT show pause/play button when gameStarted=false", () => {
    renderWithContext(<GameControls gameStarted={false} />);
    expect(screen.queryByTestId("pause-play-button")).not.toBeInTheDocument();
  });

  it("does NOT show pause/play button when game is over", () => {
    renderWithContext(<GameControls gameStarted />, makeContextValue({ gameOver: true }));
    expect(screen.queryByTestId("pause-play-button")).not.toBeInTheDocument();
  });

  it("pause button shows Resume label when game is paused", () => {
    renderWithContext(<GameControls gameStarted />, makeContextValue({ gameOver: false }));
    const btn = screen.getByTestId("pause-play-button");
    // Click once to pause
    fireEvent.click(btn);
    expect(btn).toHaveAttribute("aria-label", "Resume game");
    expect(btn).toHaveTextContent("▶");
  });

  it("pause button shows Pause label when game is playing", () => {
    renderWithContext(<GameControls gameStarted />, makeContextValue({ gameOver: false }));
    // Fresh render starts unpaused
    const btn = screen.getByTestId("pause-play-button");
    expect(btn).toHaveAttribute("aria-label", "Pause game");
    expect(btn).toHaveTextContent("⏸");
  });
});
