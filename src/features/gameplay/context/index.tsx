import * as React from "react";

import type { ContextValue, GameAction, State } from "./gameStateTypes";
import { createFreshGameState } from "./initialState";
import type { LogAction } from "./logReducer";
import { logReducer } from "./logReducer";
import reducer from "./reducer";

export type { DecisionType, OnePitchModifier } from "./decisionTypes";
export type { PitcherLogEntry, PlayLogEntry, StrikeoutEntry } from "./gameLogTypes";
export type { ContextValue, GameAction, State } from "./gameStateTypes";
export type { LogAction } from "./logReducer";
export type {
  Handedness,
  PinchHitterCandidate,
  PlayerCustomization,
  ResolvedPlayerMods,
  Strategy,
  TeamCustomPlayerOverrides,
} from "./playerTypes";

export const GameContext = React.createContext<ContextValue | undefined>(undefined);

export const useGameContext = (): ContextValue => {
  const ctx = React.useContext(GameContext);
  if (!ctx) throw new Error("useGameContext must be used within GameProviderWrapper");
  return ctx;
};

const initialState: State = createFreshGameState(["A", "B"]);

export const GameProviderWrapper: React.FunctionComponent<{
  children?: React.ReactNode;
  onDispatch?: (action: GameAction) => void;
  announcePreprocessor?: (text: string) => string;
}> = ({ children, onDispatch, announcePreprocessor }) => {
  const [logState, dispatchLogger] = React.useReducer(logReducer, { announcements: [] });

  // Use a ref so the wrapped dispatch is stable even if onDispatch identity changes.
  const onDispatchRef = React.useRef(onDispatch);
  onDispatchRef.current = onDispatch;

  // Use a ref so the preprocessor is always-current without re-creating the wrapper.
  const preprocessorRef = React.useRef(announcePreprocessor);
  preprocessorRef.current = announcePreprocessor;

  // Stable injecting dispatcher: reads preprocessorRef on every call, composing
  // with any action-level preprocessor, then forwards to dispatchLogger.
  // Stored in a ref so the *same function identity* is passed to reducer(...)
  // (which captures it once at useReducer initialization) AND exposed as
  // dispatchLog — ensuring all log paths (game reducer + external callers) go
  // through the preprocessor.
  const injectingDispatch = React.useRef<React.Dispatch<LogAction>>((action: LogAction) => {
    if (action.type !== "log") {
      dispatchLogger(action);
      return;
    }
    const globalPre = preprocessorRef.current;
    const actionPre = action.preprocessor;
    let combined = actionPre ?? globalPre;
    if (globalPre && actionPre) {
      combined = (t: string) => actionPre(globalPre(t));
    }
    dispatchLogger({ ...action, preprocessor: combined });
  }).current;

  const [state, rawDispatch] = React.useReducer(reducer(injectingDispatch), initialState);

  const dispatch: React.Dispatch<GameAction> = React.useCallback((action) => {
    onDispatchRef.current?.(action);
    rawDispatch(action);
  }, []);

  return (
    <GameContext.Provider
      value={{
        ...state,
        dispatch,
        log: logState.announcements,
        dispatchLog: injectingDispatch,
      }}
    >
      {children}
    </GameContext.Provider>
  );
};
