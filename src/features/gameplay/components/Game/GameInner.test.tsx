import * as React from "react";

import type { Strategy } from "@feat/gameplay/context/index";
import { GameContext, GameProviderWrapper, useGameContext } from "@feat/gameplay/context/index";
import * as rngModule from "@shared/utils/rng";
import * as savesModule from "@shared/utils/saves";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SaveRecord } from "@storage/types";
import { makeContextValue, makeState } from "@test/testHelpers";

import Game from ".";
import GameInner from "./GameInner";

// jsdom doesn't implement showModal/close on <dialog>
HTMLDialogElement.prototype.showModal = vi.fn();
HTMLDialogElement.prototype.close = vi.fn();

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

vi.mock("@shared/utils/saves", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@shared/utils/saves")>();
  return {
    ...actual,
    currentSeedStr: vi.fn().mockReturnValue("9ix"),
  };
});

vi.mock("@shared/utils/rng", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@shared/utils/rng")>();
  return {
    ...actual,
    getSeed: vi.fn().mockReturnValue(12345),
    restoreRng: vi.fn(),
    restoreSeed: vi.fn(),
    reinitSeed: vi.fn(),
  };
});

vi.mock("@feat/saves/storage/saveStore", () => ({
  SaveStore: {
    listSaves: vi.fn().mockResolvedValue([]),
    createSave: vi.fn().mockResolvedValue("save_1"),
    updateProgress: vi.fn().mockResolvedValue(undefined),
    deleteSave: vi.fn().mockResolvedValue(undefined),
    exportRxdbSave: vi.fn().mockResolvedValue("{}"),
    importRxdbSave: vi.fn().mockResolvedValue(undefined),
  },
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

vi.mock("rxdb/plugins/react", () => ({
  RxDatabaseProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@storage/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@storage/db")>();
  return { ...actual, getDb: vi.fn().mockResolvedValue({}) };
});

vi.mock("@shared/hooks/useCustomTeams", () => ({
  useCustomTeams: vi.fn(() => ({
    teams: [],
    loading: false,
    createTeam: vi.fn(),
    updateTeam: vi.fn(),
    deleteTeam: vi.fn(),
    refresh: vi.fn(),
  })),
}));

vi.mock("@shared/hooks/useTeamWithRoster", () => ({
  useTeamWithRoster: vi.fn().mockReturnValue(null),
}));

describe("GameInner", () => {
  it("renders without crashing", () => {
    render(
      <GameProviderWrapper>
        <GameInner />
      </GameProviderWrapper>,
    );
    expect(screen.getByTestId("scoreboard")).toBeInTheDocument();
  });

  it("clicking New Game button calls onNewGame when provided", () => {
    const onNewGame = vi.fn();
    // Render with a game-over context so the "New Game" button is visible in GameControls
    render(
      <GameContext.Provider
        value={makeContextValue({ gameOver: true, teams: ["Yankees", "Mets"] })}
      >
        <GameInner onNewGame={onNewGame} />
      </GameContext.Provider>,
    );
    // "New Game" button is present because gameOver=true in context and onNewGame provided
    expect(screen.getByRole("button", { name: /new game/i })).toBeInTheDocument();
    // Click it — should delegate to onNewGame (navigate to /exhibition/new)
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /new game/i }));
    });
    expect(onNewGame).toHaveBeenCalled();
    // No dialog should be present
    expect(screen.queryByTestId("new-game-dialog")).not.toBeInTheDocument();
  });
});

// ─── Auto-save resume ────────────────────────────────────────────────────────

const SEED_NUM = 12345;
const SEED_STR = SEED_NUM.toString(36); // matches what getSeed().toString(36) returns

const makeAutoSaveSlot = () => ({
  id: "autosave",
  name: "Auto-save — Mets vs Yankees · Inning 5",
  createdAt: 1000,
  updatedAt: 2000,
  seed: SEED_STR,
  homeTeamId: "Yankees",
  awayTeamId: "Mets",
  progressIdx: 25,
  setup: {
    strategy: "power" as Strategy,
    managedTeam: 1 as 0 | 1,
    managerMode: true,
    homeTeam: "Yankees",
    awayTeam: "Mets",
  },
  stateSnapshot: {
    state: makeState({ inning: 5, teams: ["Mets", "Yankees"] as [string, string] }),
    rngState: 42,
  },
  schemaVersion: 1,
});

describe("GameInner — auto-save resume", () => {
  beforeEach(async () => {
    const { useSaveStore } = await import("@feat/saves/hooks/useSaveStore");
    vi.mocked(useSaveStore).mockReturnValue({
      saves: [],
      createSave: vi.fn().mockResolvedValue("save_1"),
      appendEvents: vi.fn().mockResolvedValue(undefined),
      updateProgress: vi.fn().mockResolvedValue(undefined),
      deleteSave: vi.fn().mockResolvedValue(undefined),
      exportRxdbSave: vi.fn().mockResolvedValue("{}"),
      importRxdbSave: vi.fn().mockResolvedValue(undefined),
    });
    vi.mocked(rngModule.restoreRng).mockClear();
    vi.mocked(rngModule.restoreSeed).mockClear();
    vi.mocked(rngModule.getSeed).mockReturnValue(SEED_NUM);
  });

  it("auto-restores from rxAutoSave without dialog when snapshot exists", async () => {
    const { useSaveStore } = await import("@feat/saves/hooks/useSaveStore");
    vi.mocked(useSaveStore).mockReturnValue({
      saves: [makeAutoSaveSlot() as SaveRecord],
      createSave: vi.fn().mockResolvedValue("save_abc"),
      appendEvents: vi.fn().mockResolvedValue(undefined),
      updateProgress: vi.fn().mockResolvedValue(undefined),
      deleteSave: vi.fn().mockResolvedValue(undefined),
      exportRxdbSave: vi.fn().mockResolvedValue("{}"),
      importRxdbSave: vi.fn().mockResolvedValue(undefined),
    });
    const onGameSessionStarted = vi.fn();
    await act(async () => {
      render(
        <GameProviderWrapper>
          <GameInner onGameSessionStarted={onGameSessionStarted} />
        </GameProviderWrapper>,
      );
    });
    // Auto-restore fires onGameSessionStarted without any dialog interaction
    expect(onGameSessionStarted).toHaveBeenCalled();
    expect(rngModule.restoreSeed).toHaveBeenCalledWith(SEED_STR);
    expect(rngModule.restoreRng).toHaveBeenCalledWith(42);
  });

  it("does not auto-restore when no snapshot exists", async () => {
    const { useSaveStore } = await import("@feat/saves/hooks/useSaveStore");
    const noSnapshotSlot = { ...makeAutoSaveSlot(), stateSnapshot: undefined };
    vi.mocked(useSaveStore).mockReturnValue({
      saves: [noSnapshotSlot as SaveRecord],
      createSave: vi.fn().mockResolvedValue("save_1"),
      appendEvents: vi.fn().mockResolvedValue(undefined),
      updateProgress: vi.fn().mockResolvedValue(undefined),
      deleteSave: vi.fn().mockResolvedValue(undefined),
      exportRxdbSave: vi.fn().mockResolvedValue("{}"),
      importRxdbSave: vi.fn().mockResolvedValue(undefined),
    });
    const onGameSessionStarted = vi.fn();
    await act(async () => {
      render(
        <GameProviderWrapper>
          <GameInner onGameSessionStarted={onGameSessionStarted} />
        </GameProviderWrapper>,
      );
    });
    expect(onGameSessionStarted).not.toHaveBeenCalled();
  });

  it("calls restoreRng when a matched auto-save is present on mount", async () => {
    const { useSaveStore } = await import("@feat/saves/hooks/useSaveStore");
    vi.mocked(useSaveStore).mockReturnValue({
      saves: [makeAutoSaveSlot() as SaveRecord],
      createSave: vi.fn().mockResolvedValue("save_abc"),
      appendEvents: vi.fn().mockResolvedValue(undefined),
      updateProgress: vi.fn().mockResolvedValue(undefined),
      deleteSave: vi.fn().mockResolvedValue(undefined),
      exportRxdbSave: vi.fn().mockResolvedValue("{}"),
      importRxdbSave: vi.fn().mockResolvedValue(undefined),
    });
    await act(async () => {
      render(
        <GameProviderWrapper>
          <GameInner />
        </GameProviderWrapper>,
      );
    });
    expect(rngModule.restoreSeed).toHaveBeenCalledWith(SEED_STR);
    expect(rngModule.restoreRng).toHaveBeenCalledWith(42);
  });

  it("calls createSave and onGameSessionStarted when starting a new game via pendingGameSetup", async () => {
    const { useSaveStore } = await import("@feat/saves/hooks/useSaveStore");
    const mockCreateSave = vi.fn().mockResolvedValue("save_1");
    vi.mocked(useSaveStore).mockReturnValue({
      saves: [],
      createSave: mockCreateSave,
      appendEvents: vi.fn().mockResolvedValue(undefined),
      updateProgress: vi.fn().mockResolvedValue(undefined),
      deleteSave: vi.fn().mockResolvedValue(undefined),
      exportRxdbSave: vi.fn().mockResolvedValue("{}"),
      importRxdbSave: vi.fn().mockResolvedValue(undefined),
    });
    const pendingSetup = {
      homeTeam: "Yankees",
      awayTeam: "Mets",
      homeTeamLabel: "Yankees",
      awayTeamLabel: "Mets",
      managedTeam: null as null,
      playerOverrides: {
        away: {},
        home: {},
        awayOrder: [] as string[],
        homeOrder: [] as string[],
      },
    };
    const onGameSessionStarted = vi.fn();
    render(
      <GameProviderWrapper>
        <GameInner pendingGameSetup={pendingSetup} onGameSessionStarted={onGameSessionStarted} />
      </GameProviderWrapper>,
    );
    await act(async () => {});
    expect(mockCreateSave).toHaveBeenCalled();
    expect(onGameSessionStarted).toHaveBeenCalled();
  });
});

describe("Game", () => {
  it("renders the full game without crashing", async () => {
    await act(async () => {
      render(<Game />);
    });
    expect(screen.getByTestId("scoreboard")).toBeInTheDocument();
  });
});

describe("GameProviderWrapper — logReducer", () => {
  it("dispatchLog adds message to log", () => {
    const { result } = renderHook(() => useGameContext(), {
      wrapper: GameProviderWrapper,
    });
    act(() => {
      result.current.dispatchLog({ type: "log", payload: "hello" });
    });
    expect(result.current.log[0]).toBe("hello");
  });
});

// ─── Custom-team label resolution ────────────────────────────────────────────

describe("GameInner — custom team label resolution", () => {
  const CUSTOM_TEAM_DOC = {
    id: "ct_abc123",
    name: "Eagles",
    city: "Austin",
    abbreviation: "ATX",
    schemaVersion: 1 as const,
    createdAt: 1000,
    updatedAt: 1000,
    lineup: {},
    roster: {
      players: [],
      lineup: [
        {
          id: "p1",
          name: "P C",
          role: "batter" as const,
          batting: { contact: 60, power: 60, speed: 60 },
          position: "C",
        },
        {
          id: "p2",
          name: "P 1B",
          role: "batter" as const,
          batting: { contact: 60, power: 60, speed: 60 },
          position: "1B",
        },
        {
          id: "p3",
          name: "P 2B",
          role: "batter" as const,
          batting: { contact: 60, power: 60, speed: 60 },
          position: "2B",
        },
        {
          id: "p4",
          name: "P 3B",
          role: "batter" as const,
          batting: { contact: 60, power: 60, speed: 60 },
          position: "3B",
        },
        {
          id: "p5",
          name: "P SS",
          role: "batter" as const,
          batting: { contact: 60, power: 60, speed: 60 },
          position: "SS",
        },
        {
          id: "p6",
          name: "P LF",
          role: "batter" as const,
          batting: { contact: 60, power: 60, speed: 60 },
          position: "LF",
        },
        {
          id: "p7",
          name: "P CF",
          role: "batter" as const,
          batting: { contact: 60, power: 60, speed: 60 },
          position: "CF",
        },
        {
          id: "p8",
          name: "P RF",
          role: "batter" as const,
          batting: { contact: 60, power: 60, speed: 60 },
          position: "RF",
        },
        {
          id: "p9",
          name: "P DH",
          role: "batter" as const,
          batting: { contact: 60, power: 60, speed: 60 },
          position: "DH",
        },
      ],
      bench: [],
      pitchers: [
        {
          id: "pp1",
          name: "Jane Smith",
          role: "pitcher" as const,
          batting: { contact: 40, power: 40, speed: 40 },
          pitching: { velocity: 65, control: 65, movement: 60 },
          pitchingRole: "SP" as const,
        },
      ],
    },
    metadata: {},
  };

  beforeEach(async () => {
    const { useCustomTeams } = await import("@shared/hooks/useCustomTeams");
    // Two teams required so the self-matchup validation (away ≠ home) passes.
    const CUSTOM_TEAM_DOC_2 = {
      ...CUSTOM_TEAM_DOC,
      id: "ct_abc999",
      name: "Falcons",
      city: "Denver",
      abbreviation: "DEN",
    };
    vi.mocked(useCustomTeams).mockReturnValue({
      teams: [CUSTOM_TEAM_DOC as any, CUSTOM_TEAM_DOC_2 as any],
      loading: false,
      createTeam: vi.fn(),
      updateTeam: vi.fn(),
      deleteTeam: vi.fn(),
      refresh: vi.fn(),
    });
    const { useSaveStore } = await import("@feat/saves/hooks/useSaveStore");
    vi.mocked(useSaveStore).mockReturnValue({
      saves: [],
      createSave: vi.fn().mockResolvedValue("save_1"),
      appendEvents: vi.fn().mockResolvedValue(undefined),
      updateProgress: vi.fn().mockResolvedValue(undefined),
      deleteSave: vi.fn().mockResolvedValue(undefined),
      exportRxdbSave: vi.fn().mockResolvedValue("{}"),
      importRxdbSave: vi.fn().mockResolvedValue(undefined),
    });
  });

  it("preserves ct_* IDs in state.teams (v1 canonical format)", async () => {
    // pendingGameSetup passes ct_* strings to handleStart; state should keep them intact.
    const dispatch = vi.fn();
    const customPendingSetup = {
      homeTeam: "ct_abc999",
      awayTeam: "ct_abc123",
      homeTeamLabel: "Home Team",
      awayTeamLabel: "Away Team",
      managedTeam: null as null,
      playerOverrides: {
        away: {},
        home: {},
        awayOrder: [] as string[],
        homeOrder: [] as string[],
      },
    };
    render(
      <GameContext.Provider value={makeContextValue({ dispatch })}>
        <GameInner pendingGameSetup={customPendingSetup} />
      </GameContext.Provider>,
    );
    await act(async () => {});
    const setTeamsCall = dispatch.mock.calls.find((c) => c[0]?.type === "setTeams");
    expect(setTeamsCall).toBeDefined();
    const teams: [string, string] = setTeamsCall?.[0]?.payload?.teams;
    // IDs are plain ct_* in v1 (no custom: prefix)
    expect(teams[0]).toMatch(/^ct_/);
    expect(teams[1]).toMatch(/^ct_/);
  });

  it("TTS preprocessor in GameProviderWrapper resolves ct_* IDs to display names", () => {
    // Regression: the announcePreprocessor built from customTeams must translate ct_* IDs.
    const { result } = renderHook(() => useGameContext(), {
      wrapper: ({ children }) => (
        <GameContext.Provider
          value={makeContextValue({
            dispatchLog: vi.fn((action) => {
              if (action.type === "log" && action.preprocessor) {
                const resolved = action.preprocessor("ct_abc123 are batting!");
                expect(resolved).toBe("Austin Eagles are batting!");
              }
            }),
          })}
        >
          {children}
        </GameContext.Provider>
      ),
    });
    // Trigger a log dispatch with a preprocessor that mimics the GameProviderWrapper one
    const preprocessor = (msg: string) =>
      msg.replace(/ct_[^\s"',]+/g, (id) => {
        const doc = [CUSTOM_TEAM_DOC as any].find((t: any) => t.id === id);
        return doc ? `${doc.city} ${doc.name}` : id;
      });
    act(() => {
      result.current.dispatchLog({
        type: "log",
        payload: "ct_abc123 are batting!",
        preprocessor,
      });
    });
  });

  it("auto-resume keeps ct_* IDs intact in restored state", async () => {
    const { useSaveStore } = await import("@feat/saves/hooks/useSaveStore");
    const snapState = makeState({ teams: ["ct_abc123", "Home"] as [string, string] });
    vi.mocked(useSaveStore).mockReturnValue({
      saves: [
        {
          ...makeAutoSaveSlot(),
          stateSnapshot: { state: snapState, rngState: null },
        } as SaveRecord,
      ],
      createSave: vi.fn().mockResolvedValue("save_1"),
      appendEvents: vi.fn().mockResolvedValue(undefined),
      updateProgress: vi.fn().mockResolvedValue(undefined),
      deleteSave: vi.fn().mockResolvedValue(undefined),
      exportRxdbSave: vi.fn().mockResolvedValue("{}"),
      importRxdbSave: vi.fn().mockResolvedValue(undefined),
    });
    const dispatch = vi.fn();
    await act(async () => {
      render(
        <GameContext.Provider value={makeContextValue({ dispatch })}>
          <GameInner />
        </GameContext.Provider>,
      );
    });
    const restoreCall = dispatch.mock.calls.find((c) => c[0]?.type === "restore_game");
    expect(restoreCall).toBeDefined();
    const restoredTeams: [string, string] = restoreCall?.[0]?.payload?.teams;
    // ct_* ID must be preserved intact in v1
    expect(restoredTeams[0]).toBe("ct_abc123");
    expect(restoredTeams[1]).toBe("Home");
  });
});

describe("Game — DbResetNotice", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("shows the reset notice when wasDbReset returns true", async () => {
    vi.spyOn(await import("@storage/db"), "wasDbReset").mockReturnValue(true);
    await act(async () => {
      render(<Game />);
    });
    expect(screen.getByTestId("db-reset-notice")).toBeInTheDocument();
  });

  it("hides the notice after clicking the dismiss button", async () => {
    vi.spyOn(await import("@storage/db"), "wasDbReset").mockReturnValue(true);
    await act(async () => {
      render(<Game />);
    });
    const notice = screen.getByTestId("db-reset-notice");
    expect(notice).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /dismiss notice/i }));
    expect(screen.queryByTestId("db-reset-notice")).not.toBeInTheDocument();
  });

  it("does not show the notice when wasDbReset returns false", async () => {
    vi.spyOn(await import("@storage/db"), "wasDbReset").mockReturnValue(false);
    await act(async () => {
      render(<Game />);
    });
    expect(screen.queryByTestId("db-reset-notice")).not.toBeInTheDocument();
  });

  it("does not show the notice if already dismissed this session (sessionStorage guard)", async () => {
    sessionStorage.setItem("db-reset-dismissed", "1");
    vi.spyOn(await import("@storage/db"), "wasDbReset").mockReturnValue(true);
    await act(async () => {
      render(<Game />);
    });
    expect(screen.queryByTestId("db-reset-notice")).not.toBeInTheDocument();
  });

  it("dismiss sets sessionStorage so notice stays gone on remount", async () => {
    vi.spyOn(await import("@storage/db"), "wasDbReset").mockReturnValue(true);
    await act(async () => {
      render(<Game />);
    });
    fireEvent.click(screen.getByRole("button", { name: /dismiss notice/i }));
    expect(sessionStorage.getItem("db-reset-dismissed")).toBe("1");
  });
});

describe("GameInner — pendingGameSetup prop (Exhibition Setup page auto-start)", () => {
  const pendingSetup = {
    homeTeam: "Yankees",
    awayTeam: "Mets",
    homeTeamLabel: "Yankees",
    awayTeamLabel: "Mets",
    managedTeam: null as null,
    playerOverrides: {
      away: {},
      home: {},
      awayOrder: [] as string[],
      homeOrder: [] as string[],
    },
  };

  it("auto-starts the game when pendingGameSetup is provided", () => {
    const onConsumeGameSetup = vi.fn();
    render(
      <GameProviderWrapper>
        <GameInner pendingGameSetup={pendingSetup} onConsumeGameSetup={onConsumeGameSetup} />
      </GameProviderWrapper>,
    );
    // onConsumeGameSetup must be called to clear the pending setup
    expect(onConsumeGameSetup).toHaveBeenCalled();
    // No new-game-dialog should exist (it has been removed)
    expect(screen.queryByTestId("new-game-dialog")).not.toBeInTheDocument();
  });

  it("calls onConsumeGameSetup after consuming the setup", () => {
    const onConsumeGameSetup = vi.fn();
    act(() => {
      render(
        <GameProviderWrapper>
          <GameInner pendingGameSetup={pendingSetup} onConsumeGameSetup={onConsumeGameSetup} />
        </GameProviderWrapper>,
      );
    });
    expect(onConsumeGameSetup).toHaveBeenCalledTimes(1);
  });

  it("does not auto-start twice for the same pendingGameSetup reference", () => {
    const onConsumeGameSetup = vi.fn();
    const { rerender } = render(
      <GameProviderWrapper>
        <GameInner pendingGameSetup={pendingSetup} onConsumeGameSetup={onConsumeGameSetup} />
      </GameProviderWrapper>,
    );
    // Rerender with the same object reference — should NOT fire again
    act(() => {
      rerender(
        <GameProviderWrapper>
          <GameInner pendingGameSetup={pendingSetup} onConsumeGameSetup={onConsumeGameSetup} />
        </GameProviderWrapper>,
      );
    });
    expect(onConsumeGameSetup).toHaveBeenCalledTimes(1);
  });

  it("does not auto-resume a finished-game save when pendingGameSetup is provided", async () => {
    // Simulate the bug scenario: there is a finished game in RxDB saves, but the user
    // is starting a brand-new game.  The auto-resume logic must NOT overwrite the fresh
    // session with the finished-game state.
    const { useSaveStore } = await import("@feat/saves/hooks/useSaveStore");
    const finishedSave = {
      ...makeAutoSaveSlot(),
      id: "finished-save",
      stateSnapshot: {
        state: makeState({ gameOver: true, teams: ["Mets", "Yankees"] as [string, string] }),
        rngState: 99,
      },
    } as SaveRecord;
    vi.mocked(useSaveStore).mockReturnValue({
      saves: [finishedSave],
      createSave: vi.fn().mockResolvedValue("save_new"),
      appendEvents: vi.fn().mockResolvedValue(undefined),
      updateProgress: vi.fn().mockResolvedValue(undefined),
      deleteSave: vi.fn().mockResolvedValue(undefined),
      exportRxdbSave: vi.fn().mockResolvedValue("{}"),
      importRxdbSave: vi.fn().mockResolvedValue(undefined),
    });
    vi.mocked(rngModule.restoreRng).mockClear();
    vi.mocked(rngModule.restoreSeed).mockClear();

    const onGameSessionStarted = vi.fn();
    await act(async () => {
      render(
        <GameProviderWrapper>
          <GameInner pendingGameSetup={pendingSetup} onGameSessionStarted={onGameSessionStarted} />
        </GameProviderWrapper>,
      );
    });

    // New game session must have started via handleStart
    expect(onGameSessionStarted).toHaveBeenCalled();
    // restoreRng/restoreSeed are only called by the auto-resume (restore_game) path — must NOT fire
    expect(rngModule.restoreRng).not.toHaveBeenCalled();
    expect(rngModule.restoreSeed).not.toHaveBeenCalled();
  });
});

describe("GameInner — onNewGame prop (external navigation)", () => {
  it("calls onNewGame when the in-game New Game button is clicked (game over)", () => {
    const onNewGame = vi.fn();
    render(
      <GameContext.Provider
        value={makeContextValue({ gameOver: true, teams: ["Yankees", "Mets"] })}
      >
        <GameInner onNewGame={onNewGame} />
      </GameContext.Provider>,
    );
    // "New Game" button is visible because gameOver=true in context and onNewGame provided
    expect(screen.getByRole("button", { name: /new game/i })).toBeInTheDocument();
    // Click it — should delegate to onNewGame (navigate to /exhibition/new)
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /new game/i }));
    });
    expect(onNewGame).toHaveBeenCalled();
  });
});

describe("GameInner — onGameOver prop", () => {
  it("calls onGameOver when gameOver transitions from false to true", () => {
    const onGameOver = vi.fn();
    const { rerender } = render(
      <GameContext.Provider value={makeContextValue({ gameOver: false })}>
        <GameInner onGameOver={onGameOver} />
      </GameContext.Provider>,
    );
    expect(onGameOver).not.toHaveBeenCalled();
    rerender(
      <GameContext.Provider value={makeContextValue({ gameOver: true })}>
        <GameInner onGameOver={onGameOver} />
      </GameContext.Provider>,
    );
    expect(onGameOver).toHaveBeenCalledTimes(1);
  });

  it("calls onGameOver only once even on multiple re-renders after game over", () => {
    const onGameOver = vi.fn();
    const { rerender } = render(
      <GameContext.Provider value={makeContextValue({ gameOver: true })}>
        <GameInner onGameOver={onGameOver} />
      </GameContext.Provider>,
    );
    rerender(
      <GameContext.Provider value={makeContextValue({ gameOver: true })}>
        <GameInner onGameOver={onGameOver} />
      </GameContext.Provider>,
    );
    expect(onGameOver).toHaveBeenCalledTimes(1);
  });
});

// ─── Modal save load (handleModalLoad / onLoadSave callback) ──────────────────

const makeModalSaveSlot = (): SaveRecord => ({
  id: "modal_save_1",
  name: "Modal test save",
  seed: "modalseed",
  createdAt: 1000,
  updatedAt: 2000,
  progressIdx: 10,
  homeTeamId: "Home",
  awayTeamId: "Away",
  schemaVersion: 1,
  setup: {
    strategy: "aggressive" as Strategy,
    managedTeam: null,
    managerMode: false,
    homeTeam: "Home",
    awayTeam: "Away",
  },
  stateSnapshot: {
    state: makeState({ inning: 4, teams: ["Away", "Home"] as [string, string] }),
    rngState: null,
  },
});

describe("GameInner — modal save load (onLoadSave / handleModalLoad)", () => {
  beforeEach(async () => {
    // Need the dialog to actually open so we can interact with SavesModal.
    HTMLDialogElement.prototype.showModal = vi.fn().mockImplementation(function (
      this: HTMLDialogElement,
    ) {
      this.setAttribute("open", "");
    });
    HTMLDialogElement.prototype.close = vi.fn().mockImplementation(function (
      this: HTMLDialogElement,
    ) {
      this.removeAttribute("open");
    });
    const { useSaveStore } = await import("@feat/saves/hooks/useSaveStore");
    vi.mocked(useSaveStore).mockReturnValue({
      saves: [],
      createSave: vi.fn().mockResolvedValue("save_1"),
      appendEvents: vi.fn().mockResolvedValue(undefined),
      updateProgress: vi.fn().mockResolvedValue(undefined),
      deleteSave: vi.fn().mockResolvedValue(undefined),
      exportRxdbSave: vi.fn().mockResolvedValue("{}"),
      importRxdbSave: vi.fn().mockResolvedValue(undefined),
    });
  });

  afterEach(() => {
    // Restore simple no-op mocks after each test so other suites are unaffected.
    HTMLDialogElement.prototype.showModal = vi.fn();
    HTMLDialogElement.prototype.close = vi.fn();
  });

  it("dispatches restore_game and calls onGameSessionStarted after Load is clicked in the modal", async () => {
    const { useSaveStore } = await import("@feat/saves/hooks/useSaveStore");
    const slot = makeModalSaveSlot();
    vi.mocked(useSaveStore).mockReturnValue({
      saves: [slot],
      createSave: vi.fn().mockResolvedValue("save_1"),
      appendEvents: vi.fn().mockResolvedValue(undefined),
      updateProgress: vi.fn().mockResolvedValue(undefined),
      deleteSave: vi.fn().mockResolvedValue(undefined),
      exportRxdbSave: vi.fn().mockResolvedValue("{}"),
      importRxdbSave: vi.fn().mockResolvedValue(undefined),
    });

    const dispatch = vi.fn();
    const onGameSessionStarted = vi.fn();
    await act(async () => {
      render(
        <GameContext.Provider value={makeContextValue({ dispatch })}>
          <GameInner onGameSessionStarted={onGameSessionStarted} />
        </GameContext.Provider>,
      );
    });

    // Wait for the lazy-loaded SavesModal button to appear.
    const savesButton = await screen.findByRole("button", { name: /open saves panel/i });
    await act(async () => {
      fireEvent.click(savesButton);
    });

    // Wait for SaveSlotList to render, then find Load button via data-testid
    await screen.findByTestId("saves-modal-list");
    const loadButton = await screen.findByTestId("load-save-button");
    await act(async () => {
      fireEvent.click(loadButton);
    });

    // handleModalLoad must dispatch restore_game with the correct state payload.
    await vi.waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "restore_game",
          payload: expect.objectContaining({
            inning: slot.stateSnapshot!.state.inning,
            teams: slot.stateSnapshot!.state.teams,
          }),
        }),
      );
    });
    expect(onGameSessionStarted).toHaveBeenCalled();
  });

  it("calls reinitSeed and dispatches restore_game when a legacy save (rngState: null) is loaded from the modal", async () => {
    const { useSaveStore } = await import("@feat/saves/hooks/useSaveStore");
    const slot = makeModalSaveSlot(); // seed: "modalseed", rngState: null
    vi.mocked(useSaveStore).mockReturnValue({
      saves: [slot],
      createSave: vi.fn().mockResolvedValue("save_1"),
      appendEvents: vi.fn().mockResolvedValue(undefined),
      updateProgress: vi.fn().mockResolvedValue(undefined),
      deleteSave: vi.fn().mockResolvedValue(undefined),
      exportRxdbSave: vi.fn().mockResolvedValue("{}"),
      importRxdbSave: vi.fn().mockResolvedValue(undefined),
    });

    const dispatch = vi.fn();
    await act(async () => {
      render(
        <GameContext.Provider value={makeContextValue({ dispatch })}>
          <GameInner />
        </GameContext.Provider>,
      );
    });

    const savesButton = await screen.findByRole("button", { name: /open saves panel/i });
    await act(async () => {
      fireEvent.click(savesButton);
    });
    const loadButtons = await screen.findAllByRole("button", { name: /^load$/i });
    await act(async () => {
      fireEvent.click(loadButtons[0]);
    });

    await vi.waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: "restore_game" }));
      expect(rngModule.reinitSeed).toHaveBeenCalledWith("modalseed");
    });
  });
});
