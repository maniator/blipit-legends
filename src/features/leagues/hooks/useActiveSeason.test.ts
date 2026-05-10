/**
 * Unit tests for useActiveSeason hook.
 */
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useActiveSeason } from "./useActiveSeason";

vi.mock("rxdb/plugins/react", () => ({ useLiveRxQuery: vi.fn() }));

import { useLiveRxQuery } from "rxdb/plugins/react";

describe("useActiveSeason", () => {
  it("returns loading state when results are not yet loaded", () => {
    vi.mocked(useLiveRxQuery).mockReturnValue({ results: [], loading: true, error: null });

    const { result } = renderHook(() => useActiveSeason());

    expect(result.current.activeSeason).toBeNull();
    expect(result.current.loading).toBe(true);
  });

  it("returns active season when loaded", () => {
    const mockSeason = {
      id: "s1",
      name: "Spring 2026",
      status: "active",
      createdAt: Date.now(),
      preset: "mini",
      seasonLength: "sprint",
      masterSeed: "abc123",
      leagues: [],
      tradeDeadlineGameDay: null,
      playoffFormat: null,
      featureFlags: {},
      currentGameDay: 0,
      championTeamId: null,
      rulesetVersion: 1,
      awards: [],
    };

    vi.mocked(useLiveRxQuery).mockReturnValue({
      results: [{ toJSON: () => mockSeason }] as any,
      loading: false,
      error: null,
    });

    const { result } = renderHook(() => useActiveSeason());

    expect(result.current.activeSeason).toEqual(mockSeason);
    expect(result.current.loading).toBe(false);
  });

  it("returns null when no active season exists", () => {
    vi.mocked(useLiveRxQuery).mockReturnValue({ results: [], loading: false, error: null });

    const { result } = renderHook(() => useActiveSeason());

    expect(result.current.activeSeason).toBeNull();
    expect(result.current.loading).toBe(false);
  });
});
