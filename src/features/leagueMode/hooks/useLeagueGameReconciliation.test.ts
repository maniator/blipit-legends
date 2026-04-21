import * as React from "react";

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@feat/leagueMode/storage/scheduledGameStore", () => ({
  scheduledGameStore: {
    markScheduledGameCompleted: vi.fn().mockResolvedValue(undefined),
    getScheduledGame: vi.fn(),
  },
}));

vi.mock("@feat/leagueMode/utils/advanceGameDayIfComplete", () => ({
  advanceGameDayIfComplete: vi.fn().mockResolvedValue(undefined),
}));

import { scheduledGameStore } from "@feat/leagueMode/storage/scheduledGameStore";
import { advanceGameDayIfComplete } from "@feat/leagueMode/utils/advanceGameDayIfComplete";
import type { LeagueGameContext, ScheduledGameRecord } from "@feat/leagueMode/storage/types";

import { useLeagueGameReconciliation } from "./useLeagueGameReconciliation";

const makeContext = (): LeagueGameContext => ({
  leagueId: "lg_1",
  leagueSeasonId: "lsn_1",
  scheduledGameId: "sgame_1",
});

const makeScheduledGame = (gameDay = 0): ScheduledGameRecord => ({
  id: "sgame_1",
  leagueSeasonId: "lsn_1",
  gameDay,
  awayTeamId: "team_away",
  homeTeamId: "team_home",
  status: "completed",
  schemaVersion: 1,
});

describe("useLeagueGameReconciliation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(scheduledGameStore.markScheduledGameCompleted).mockResolvedValue(undefined);
    vi.mocked(scheduledGameStore.getScheduledGame).mockResolvedValue(makeScheduledGame());
    vi.mocked(advanceGameDayIfComplete).mockResolvedValue(undefined);
  });

  it("marks the scheduled game completed when both context and completedGameId are set", async () => {
    const { rerender } = renderHook(
      ({ ctx, saveId }: { ctx: LeagueGameContext | null; saveId: string | null }) =>
        useLeagueGameReconciliation(ctx, saveId),
      { initialProps: { ctx: makeContext(), saveId: "save_abc" } },
    );

    await act(async () => {});

    expect(scheduledGameStore.markScheduledGameCompleted).toHaveBeenCalledWith(
      "sgame_1",
      "save_abc",
    );
    rerender({ ctx: makeContext(), saveId: "save_abc" });
  });

  it("calls advanceGameDayIfComplete after marking game completed", async () => {
    renderHook(() => useLeagueGameReconciliation(makeContext(), "save_abc"));

    await act(async () => {});

    expect(advanceGameDayIfComplete).toHaveBeenCalledWith("lsn_1", 0);
  });

  it("does NOT fire when leagueGameContext is null", async () => {
    renderHook(() => useLeagueGameReconciliation(null, "save_abc"));

    await act(async () => {});

    expect(scheduledGameStore.markScheduledGameCompleted).not.toHaveBeenCalled();
    expect(advanceGameDayIfComplete).not.toHaveBeenCalled();
  });

  it("does NOT fire when completedGameId is null", async () => {
    renderHook(() => useLeagueGameReconciliation(makeContext(), null));

    await act(async () => {});

    expect(scheduledGameStore.markScheduledGameCompleted).not.toHaveBeenCalled();
    expect(advanceGameDayIfComplete).not.toHaveBeenCalled();
  });

  it("fires exactly once even if dependencies re-render", async () => {
    const ctx = makeContext();
    const { rerender } = renderHook(
      ({ saveId }: { saveId: string }) => useLeagueGameReconciliation(ctx, saveId),
      { initialProps: { saveId: "save_abc" } },
    );

    await act(async () => {});
    rerender({ saveId: "save_abc" });
    await act(async () => {});

    expect(scheduledGameStore.markScheduledGameCompleted).toHaveBeenCalledTimes(1);
    expect(advanceGameDayIfComplete).toHaveBeenCalledTimes(1);
  });

  it("uses the game day from the fetched scheduled game record", async () => {
    vi.mocked(scheduledGameStore.getScheduledGame).mockResolvedValue(makeScheduledGame(3));

    renderHook(() => useLeagueGameReconciliation(makeContext(), "save_xyz"));

    await act(async () => {});

    expect(advanceGameDayIfComplete).toHaveBeenCalledWith("lsn_1", 3);
  });

  it("skips advanceGameDayIfComplete gracefully when game record is not found", async () => {
    vi.mocked(scheduledGameStore.getScheduledGame).mockResolvedValue(null);

    renderHook(() => useLeagueGameReconciliation(makeContext(), "save_abc"));

    await act(async () => {});

    expect(advanceGameDayIfComplete).not.toHaveBeenCalled();
  });
});
