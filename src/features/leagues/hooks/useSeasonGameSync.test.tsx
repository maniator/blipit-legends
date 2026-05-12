import * as React from "react";

import type { ContextValue } from "@feat/gameplay/context/index";
import { GameContext } from "@feat/gameplay/context/index";
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeContextValue, makeGameSessionContext } from "@test/testHelpers";

// Mock GameSessionContext — useSeasonGameSync reads seasonGameId from context.
// Use vi.mock so the hook under test gets the mocked version without needing
// a real <GameSessionProvider> in the tree (same pattern as useSaveStore mocks).
vi.mock("@feat/gameplay/context/index", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@feat/gameplay/context/index")>();
  return { ...actual, useGameSessionContext: vi.fn() };
});

import { useGameSessionContext } from "@feat/gameplay/context/index";

vi.mock("@feat/leagues/utils/applySeasonGameResult", () => ({
  applySeasonGameResult: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@storage/db", () => ({
  getDb: vi.fn().mockResolvedValue({}),
}));

import { applySeasonGameResult } from "@feat/leagues/utils/applySeasonGameResult";

import { getDb } from "@storage/db";

import { useSeasonGameSync } from "./useSeasonGameSync";

const renderSync = (ctxOverrides: Partial<ContextValue> = {}) => {
  const ctx = makeContextValue(ctxOverrides);
  return renderHook(() => useSeasonGameSync(), {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <GameContext.Provider value={ctx}>{children}</GameContext.Provider>
    ),
  });
};

describe("useSeasonGameSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("when seasonGameId is null (exhibition game)", () => {
    beforeEach(() => {
      vi.mocked(useGameSessionContext).mockReturnValue(
        makeGameSessionContext({ seasonGameId: null }),
      );
    });

    it("does not call applySeasonGameResult even when game is over", async () => {
      renderSync({ gameOver: true });
      // Flush microtasks
      await Promise.resolve();
      expect(applySeasonGameResult).not.toHaveBeenCalled();
    });

    it("does not call getDb", async () => {
      renderSync({ gameOver: true });
      await Promise.resolve();
      expect(getDb).not.toHaveBeenCalled();
    });
  });

  describe("when seasonGameId is set (league game)", () => {
    beforeEach(() => {
      vi.mocked(useGameSessionContext).mockReturnValue(
        makeGameSessionContext({ seasonGameId: "sg-123", disableSave: true }),
      );
    });

    it("calls applySeasonGameResult with correct args when game is over", async () => {
      renderSync({ gameOver: true, score: [3, 5] });
      await vi.waitFor(() => {
        expect(applySeasonGameResult).toHaveBeenCalledWith({}, "sg-123", {
          homeScore: 5,
          awayScore: 3,
        });
      });
    });

    it("does not call applySeasonGameResult when game is not over", async () => {
      renderSync({ gameOver: false, score: [1, 0] });
      await Promise.resolve();
      expect(applySeasonGameResult).not.toHaveBeenCalled();
    });

    it("calls applySeasonGameResult only once even if re-rendered (idempotency via committedRef)", async () => {
      const { rerender } = renderSync({ gameOver: true, score: [2, 4] });
      await vi.waitFor(() => {
        expect(applySeasonGameResult).toHaveBeenCalledTimes(1);
      });
      // Re-render should NOT trigger a second call.
      rerender();
      await Promise.resolve();
      expect(applySeasonGameResult).toHaveBeenCalledTimes(1);
    });
  });

  describe("committedRef resets when seasonGameId changes", () => {
    it("commits again after seasonGameId changes to a new value", async () => {
      let currentSeasonGameId = "sg-first";
      vi.mocked(useGameSessionContext).mockImplementation(() =>
        makeGameSessionContext({ seasonGameId: currentSeasonGameId, disableSave: true }),
      );

      const { rerender } = renderSync({ gameOver: true, score: [1, 2] });
      await vi.waitFor(() => {
        expect(applySeasonGameResult).toHaveBeenCalledTimes(1);
      });

      // Switch to a new season game ID — committedRef must reset.
      currentSeasonGameId = "sg-second";
      vi.mocked(useGameSessionContext).mockReturnValue(
        makeGameSessionContext({ seasonGameId: "sg-second", disableSave: true }),
      );
      rerender();
      await vi.waitFor(() => {
        expect(applySeasonGameResult).toHaveBeenCalledTimes(2);
      });
      expect(applySeasonGameResult).toHaveBeenLastCalledWith({}, "sg-second", expect.anything());
    });
  });
});
