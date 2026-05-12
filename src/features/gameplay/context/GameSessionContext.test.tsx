import * as React from "react";

import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { GameSessionContextValue } from "./GameSessionContext";
import { GameSessionProvider, useGameSessionContext } from "./GameSessionContext";

const defaultValue: GameSessionContextValue = {
  sessionType: "exhibition",
  managerModeAllowed: true,
  disableSave: false,
  seasonGameId: null,
  managedTeam: null,
  sessionReady: true,
};

function makeWrapper(value: GameSessionContextValue) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <GameSessionProvider value={value}>{children}</GameSessionProvider>;
  };
}

describe("GameSessionContext", () => {
  it("throws when used outside GameSessionProvider", () => {
    expect(() => {
      renderHook(() => useGameSessionContext());
    }).toThrow("useGameSessionContext must be used within GameSessionProvider");
  });

  it("returns value from provider", () => {
    const { result } = renderHook(() => useGameSessionContext(), {
      wrapper: makeWrapper(defaultValue),
    });
    expect(result.current).toEqual(defaultValue);
  });

  it("allows overriding individual fields", () => {
    const customValue: GameSessionContextValue = {
      ...defaultValue,
      managerModeAllowed: false,
      managedTeam: 1,
    };
    const { result } = renderHook(() => useGameSessionContext(), {
      wrapper: makeWrapper(customValue),
    });
    expect(result.current.managerModeAllowed).toBe(false);
    expect(result.current.managedTeam).toBe(1);
  });

  it("reflects league session fields", () => {
    const leagueValue: GameSessionContextValue = {
      sessionType: "league",
      managerModeAllowed: false,
      disableSave: true,
      seasonGameId: "sg-abc",
      managedTeam: null,
      sessionReady: true,
    };
    const { result } = renderHook(() => useGameSessionContext(), {
      wrapper: makeWrapper(leagueValue),
    });
    expect(result.current.sessionType).toBe("league");
    expect(result.current.disableSave).toBe(true);
    expect(result.current.seasonGameId).toBe("sg-abc");
  });

  it("can start with sessionReady=false", () => {
    const notReadyValue: GameSessionContextValue = { ...defaultValue, sessionReady: false };
    const { result } = renderHook(() => useGameSessionContext(), {
      wrapper: makeWrapper(notReadyValue),
    });
    expect(result.current.sessionReady).toBe(false);
  });
});
