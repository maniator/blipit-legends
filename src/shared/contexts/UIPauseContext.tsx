import * as React from "react";

/**
 * UI-pause coordination — reference-counted so multiple overlapping modals
 * (modal stack) all stay paused until the last one closes.
 *
 * IMPORTANT: This is a UI-only pause. It must NEVER dispatch into the game
 * reducer or call into the shared PRNG (`@shared/utils/rng`). Any change here
 * that mutates simulation state would break determinism for replays and
 * seed-anchored regression tests.
 *
 * Consumers:
 *  - Blocking modals (e.g. SavesModal) call `pushPause()` on open and
 *    `popPause()` on close (typically via `useUIPauseScope(active)`).
 *  - The Manager Mode `DecisionPanel` reads `isPaused` to freeze its
 *    auto-skip countdown and visually disable the action buttons.
 *  - The autoplay scheduler (`useAutoPlayScheduler`) is suspended when
 *    `isPaused` is true (combined with the user-driven `paused` flag).
 */
export interface UIPauseContextValue {
  /** True when at least one consumer has pushed a pause. */
  isPaused: boolean;
  /** Increment the pause counter. */
  pushPause: () => void;
  /** Decrement the pause counter. Safe to call when count is 0 (no-op). */
  popPause: () => void;
}

const noop = (): void => {};

const defaultValue: UIPauseContextValue = {
  isPaused: false,
  pushPause: noop,
  popPause: noop,
};

export const UIPauseContext = React.createContext<UIPauseContextValue>(defaultValue);

interface ProviderProps {
  children: React.ReactNode;
}

export const UIPauseProvider: React.FunctionComponent<ProviderProps> = ({ children }) => {
  const [count, setCount] = React.useState(0);

  // Use functional updates so concurrent push/pop calls in the same tick
  // (e.g. one modal closing while another opens) do not lose increments.
  const pushPause = React.useCallback(() => {
    setCount((c) => c + 1);
  }, []);

  const popPause = React.useCallback(() => {
    setCount((c) => (c > 0 ? c - 1 : 0));
  }, []);

  const value = React.useMemo<UIPauseContextValue>(
    () => ({ isPaused: count > 0, pushPause, popPause }),
    [count, pushPause, popPause],
  );

  return <UIPauseContext.Provider value={value}>{children}</UIPauseContext.Provider>;
};

export const useUIPause = (): UIPauseContextValue => React.useContext(UIPauseContext);

/**
 * Pushes a pause on mount (or whenever `active` becomes true) and pops it
 * on unmount (or whenever `active` becomes false). Use for modal-stack
 * scenarios where you want pause/resume tied to component lifecycle.
 */
export const useUIPauseScope = (active: boolean): void => {
  const { pushPause, popPause } = useUIPause();
  React.useEffect(() => {
    if (!active) return;
    pushPause();
    return () => {
      popPause();
    };
  }, [active, pushPause, popPause]);
};
