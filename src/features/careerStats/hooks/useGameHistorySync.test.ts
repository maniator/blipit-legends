import * as React from "react";

import { Hit } from "@shared/constants/hitTypes";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeContextValue } from "@test/testHelpers";

// Mocks must use inline vi.fn() — no top-level variables before vi.mock().
// Only commitCompletedGame is used by the hook; the full store API is not needed here.
vi.mock("@feat/careerStats/storage/gameHistoryStore", () => ({
  GameHistoryStore: { commitCompletedGame: vi.fn() },
}));

vi.mock("@feat/gameplay/context/index", () => ({ useGameContext: vi.fn() }));

vi.mock("@shared/utils/rng", () => ({
  getSeed: vi.fn().mockReturnValue(12345),
  getRngState: vi.fn().mockReturnValue(null),
}));

// Import the hook and mocked modules after vi.mock declarations.
import { GameHistoryStore } from "@feat/careerStats/storage/gameHistoryStore";
import { useGameContext } from "@feat/gameplay/context/index";
import { appLog } from "@shared/utils/logger";

import { useGameHistorySync } from "./useGameHistorySync";

/** Minimal subset of a committed stat row used for player-ID assertions in these tests.
 *  Only `playerId` is needed; batting-stat fields are not asserted here. */
type StatRowShape = { playerId: string };

/**
 * Generous timeout for the retry test: React schedules state updates asynchronously
 * across 4 render cycles (initial + 3 retries). 2 s is ample for the test environment.
 */
const RETRY_TEST_TIMEOUT_MS = 2000;

afterEach(() => {
  vi.restoreAllMocks();
});

/** Helper: returns a MutableRefObject wrapping `value`. */
const makeRef = <T>(value: T): React.MutableRefObject<T> => ({ current: value });

describe("useGameHistorySync", () => {
  describe("happy path — game over triggers exactly one commit", () => {
    beforeEach(() => {
      vi.mocked(GameHistoryStore.commitCompletedGame).mockResolvedValue(undefined);
    });

    it("does NOT commit when gameOver is false", () => {
      vi.mocked(useGameContext).mockReturnValue(makeContextValue({ gameOver: false }));
      renderHook(() => useGameHistorySync(makeRef("save_1"), false));
      expect(GameHistoryStore.commitCompletedGame).not.toHaveBeenCalled();
    });

    it("commits once when gameOver is true", async () => {
      vi.mocked(useGameContext).mockReturnValue(makeContextValue({ gameOver: true }));
      const { rerender } = renderHook(() => useGameHistorySync(makeRef("save_1"), false));
      await act(async () => {
        await Promise.resolve();
      });
      rerender();
      expect(GameHistoryStore.commitCompletedGame).toHaveBeenCalledTimes(1);
      expect(GameHistoryStore.commitCompletedGame).toHaveBeenCalledWith(
        "save_1",
        expect.objectContaining({ committedBySaveId: "save_1" }),
        expect.any(Array),
        expect.any(Array),
      );
    });

    it("uses gameInstanceId as the primary key when present in state", async () => {
      vi.mocked(useGameContext).mockReturnValue(
        makeContextValue({ gameOver: true, gameInstanceId: "game_abc" }),
      );
      renderHook(() => useGameHistorySync(makeRef("save_1"), false));
      await act(async () => {
        await Promise.resolve();
      });
      expect(GameHistoryStore.commitCompletedGame).toHaveBeenCalledWith(
        "game_abc",
        expect.objectContaining({ committedBySaveId: "save_1" }),
        expect.any(Array),
        expect.any(Array),
      );
    });

    it("does NOT commit a second time on re-render", async () => {
      vi.mocked(useGameContext).mockReturnValue(makeContextValue({ gameOver: true }));
      const ref = makeRef("save_1");
      const { rerender } = renderHook(() => useGameHistorySync(ref, false));
      await act(async () => {
        await Promise.resolve();
      });
      rerender();
      rerender();
      await act(async () => {
        await Promise.resolve();
      });
      expect(GameHistoryStore.commitCompletedGame).toHaveBeenCalledTimes(1);
    });

    it("builds stat rows from play log entries", async () => {
      // Provide a play log so the stat-building loop runs (covering buildPlayerKey).
      const playLog = [
        {
          inning: 1,
          half: 0 as const,
          batterNum: 1,
          playerId: "p1",
          team: 0 as const,
          event: Hit.Single,
          runs: 0,
          rbi: 0,
        },
      ];
      const strikeoutLog = [{ team: 0 as const, batterNum: 2, playerId: "p2" }];
      vi.mocked(useGameContext).mockReturnValue(
        makeContextValue({ gameOver: true, playLog, strikeoutLog }),
      );
      renderHook(() => useGameHistorySync(makeRef("save_1"), false));
      await act(async () => {
        await Promise.resolve();
      });
      expect(GameHistoryStore.commitCompletedGame).toHaveBeenCalledTimes(1);
      // Stat rows should include the batter from team 0.
      const statRows = vi.mocked(GameHistoryStore.commitCompletedGame).mock
        .calls[0][2] as StatRowShape[];
      expect(statRows.some((r) => r.playerId === "p1")).toBe(true);
    });
  });

  describe("wasAlreadyFinalOnLoad guard", () => {
    it("does NOT commit when wasAlreadyFinalOnLoad is true", async () => {
      vi.mocked(GameHistoryStore.commitCompletedGame).mockResolvedValue(undefined);
      vi.mocked(useGameContext).mockReturnValue(makeContextValue({ gameOver: true }));
      renderHook(() => useGameHistorySync(makeRef("save_1"), true));
      await act(async () => {
        await Promise.resolve();
      });
      expect(GameHistoryStore.commitCompletedGame).not.toHaveBeenCalled();
    });
  });

  describe("missing saveId guard", () => {
    it("does NOT commit when rxSaveIdRef.current is null AND state has no gameInstanceId", async () => {
      vi.mocked(GameHistoryStore.commitCompletedGame).mockResolvedValue(undefined);
      vi.mocked(useGameContext).mockReturnValue(makeContextValue({ gameOver: true }));
      renderHook(() => useGameHistorySync(makeRef(null), false));
      await act(async () => {
        await Promise.resolve();
      });
      expect(GameHistoryStore.commitCompletedGame).not.toHaveBeenCalled();
    });

    it("DOES commit using gameInstanceId when rxSaveIdRef.current is null but state has gameInstanceId", async () => {
      // This covers the SPEED_INSTANT race: createSave() hasn't resolved yet (saveId is
      // still null) but the game has already ended.  The fix ensures we use
      // state.gameInstanceId as the primary key so career stats are never dropped.
      vi.mocked(GameHistoryStore.commitCompletedGame).mockResolvedValue(undefined);
      vi.mocked(useGameContext).mockReturnValue(
        makeContextValue({ gameOver: true, gameInstanceId: "game_instant_race" }),
      );
      renderHook(() => useGameHistorySync(makeRef(null), false));
      await act(async () => {
        await Promise.resolve();
      });
      expect(GameHistoryStore.commitCompletedGame).toHaveBeenCalledTimes(1);
      expect(GameHistoryStore.commitCompletedGame).toHaveBeenCalledWith(
        "game_instant_race",
        expect.objectContaining({ homeTeamId: expect.any(String) }),
        expect.any(Array),
        expect.any(Array),
      );
    });
  });

  describe("retry on transient failure", () => {
    it("retries exactly MAX_COMMIT_RETRIES (3) times after initial failure — 4 total calls", async () => {
      const logSpy = vi.spyOn(appLog, "error").mockImplementation(() => {});
      const error = Object.assign(new Error("DB error"), { code: "QUOTA_EXCEEDED" });
      vi.mocked(GameHistoryStore.commitCompletedGame).mockRejectedValue(error);
      vi.mocked(useGameContext).mockReturnValue(makeContextValue({ gameOver: true }));

      renderHook(() => useGameHistorySync(makeRef("save_1"), false));

      // waitFor polls until the assertion passes, making the test resilient to React's
      // async render scheduling across 4 render cycles (initial + 3 retries = 4 total).
      await waitFor(
        () => {
          expect(GameHistoryStore.commitCompletedGame).toHaveBeenCalledTimes(4);
        },
        { timeout: RETRY_TEST_TIMEOUT_MS },
      );
      expect(logSpy).toHaveBeenCalled();
    });
  });
});
