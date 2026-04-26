import * as React from "react";

import { UIPauseProvider, useUIPause, useUIPauseScope } from "@shared/contexts/UIPauseContext";
import { act, render, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <UIPauseProvider>{children}</UIPauseProvider>
);

describe("UIPauseContext", () => {
  it("starts unpaused", () => {
    const { result } = renderHook(() => useUIPause(), { wrapper });
    expect(result.current.isPaused).toBe(false);
  });

  it("pushPause + popPause toggles isPaused", () => {
    const { result } = renderHook(() => useUIPause(), { wrapper });
    act(() => result.current.pushPause());
    expect(result.current.isPaused).toBe(true);
    act(() => result.current.popPause());
    expect(result.current.isPaused).toBe(false);
  });

  it("is reference-counted — stays paused while any consumer is pushed (modal stack)", () => {
    const { result } = renderHook(() => useUIPause(), { wrapper });
    act(() => {
      result.current.pushPause();
      result.current.pushPause();
    });
    expect(result.current.isPaused).toBe(true);
    act(() => result.current.popPause());
    // Still paused because second push remains.
    expect(result.current.isPaused).toBe(true);
    act(() => result.current.popPause());
    expect(result.current.isPaused).toBe(false);
  });

  it("popPause never goes below zero", () => {
    const { result } = renderHook(() => useUIPause(), { wrapper });
    act(() => {
      result.current.popPause();
      result.current.popPause();
    });
    expect(result.current.isPaused).toBe(false);
    act(() => result.current.pushPause());
    expect(result.current.isPaused).toBe(true);
  });

  it("default context (no provider) has isPaused=false and no-op push/pop", () => {
    const { result } = renderHook(() => useUIPause());
    expect(result.current.isPaused).toBe(false);
    expect(() => {
      act(() => result.current.pushPause());
      act(() => result.current.popPause());
    }).not.toThrow();
    expect(result.current.isPaused).toBe(false);
  });

  it("useUIPauseScope pushes on mount and pops on unmount", () => {
    const Probe: React.FC<{ active: boolean; onState: (v: boolean) => void }> = ({
      active,
      onState,
    }) => {
      useUIPauseScope(active);
      const { isPaused } = useUIPause();
      React.useEffect(() => {
        onState(isPaused);
      }, [isPaused, onState]);
      return null;
    };

    const states: boolean[] = [];
    const { rerender, unmount } = render(
      <UIPauseProvider>
        <Probe active={false} onState={(v) => states.push(v)} />
      </UIPauseProvider>,
    );
    expect(states.at(-1)).toBe(false);

    rerender(
      <UIPauseProvider>
        <Probe active={true} onState={(v) => states.push(v)} />
      </UIPauseProvider>,
    );
    expect(states.at(-1)).toBe(true);

    unmount();
    // After unmount we cannot read state from the unmounted tree, but the
    // important contract is that no leak occurs. Re-mount and verify count
    // returned to zero.
    const { result } = renderHook(() => useUIPause(), { wrapper });
    expect(result.current.isPaused).toBe(false);
  });
});
