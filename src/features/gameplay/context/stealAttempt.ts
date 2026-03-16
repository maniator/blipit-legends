import getRandomInt from "@feat/gameplay/utils/getRandomInt";

import type { State } from "./gameStateTypes";
import { playerOut } from "./playerOut";

export const stealAttempt = (
  state: State,
  log: (msg: string) => void,
  successPct: number,
  base: 0 | 1,
): State => {
  log(`Steal attempt from ${base === 0 ? "1st" : "2nd"}...`);
  const roll = getRandomInt(100);
  if (roll < successPct) {
    log("Safe! Steal successful!");
    const newBase: [number, number, number] = [...state.baseLayout] as [number, number, number];
    newBase[base] = 0;
    newBase[base + 1] = 1;
    const newRunnerIds = [...(state.baseRunnerIds ?? [null, null, null])] as [
      string | null,
      string | null,
      string | null,
    ];
    newRunnerIds[base + 1] = newRunnerIds[base];
    newRunnerIds[base] = null;
    return {
      ...state,
      baseLayout: newBase,
      baseRunnerIds: newRunnerIds,
      pendingDecision: null,
      onePitchModifier: null,
      pitchKey: (state.pitchKey ?? 0) + 1,
    };
  }
  log("Caught stealing!");
  const clearedBases: [number, number, number] = [...state.baseLayout] as [number, number, number];
  clearedBases[base] = 0;
  const clearedRunnerIds = [...(state.baseRunnerIds ?? [null, null, null])] as [
    string | null,
    string | null,
    string | null,
  ];
  clearedRunnerIds[base] = null;
  return playerOut(
    {
      ...state,
      pendingDecision: null,
      baseLayout: clearedBases,
      baseRunnerIds: clearedRunnerIds,
      pitchKey: (state.pitchKey ?? 0) + 1,
    },
    log,
    false,
  );
};
