import getRandomInt from "@feat/gameplay/utils/getRandomInt";
import { Hit } from "@shared/constants/hitTypes";

import type { DecisionType, OnePitchModifier } from "./decisionTypes";
import { checkWalkoff } from "./gameOver";
import type { State } from "./gameStateTypes";
import { addInningRuns, hitBall } from "./hitBall";
import { updateActivePitcherLog } from "./pitcherLog";
import { incrementPitchCount, playerOut } from "./playerOut";
import type { Strategy } from "./playerTypes";

export const buntAttempt = (
  state: State,
  log: (msg: string) => void,
  strategy: Strategy = "balanced",
): State => {
  // Count this pitch — the pitcher is throwing to the batter on the bunt.
  const stateWithPitch = incrementPitchCount(state);
  log("Batter squares to bunt...");
  const roll = getRandomInt(100);
  const singleChance = strategy === "contact" ? 20 : 8;

  // MLB parity Phase 1: a foul bunt with 2 strikes is an automatic strikeout.
  // Rolls >= 80 map to the "foul bunt" range. With 0 or 1 strikes the existing
  // pop-out path (roll >= 80) fires unchanged below; this check is only reached
  // when state.strikes === 2, so non-2-strike paths are completely unaffected.
  // Note: "Foul tip on the bunt" is the log phrasing from the Phase 1 spec;
  // mechanically this represents any foul-territory bunt contact with two strikes.
  if (state.strikes === 2 && roll >= 80) {
    log("Foul tip on the bunt — strike three!");
    return playerOut(
      {
        ...stateWithPitch,
        pendingDecision: null,
        hitType: undefined,
        pitchKey: (stateWithPitch.pitchKey ?? 0) + 1,
      },
      log,
      true,
    );
  }

  if (roll < singleChance) {
    log("Bunt single!");
    return hitBall(Hit.Single, { ...stateWithPitch, pendingDecision: null }, log, strategy);
  }

  const fcChance = singleChance + 12;
  if (roll < fcChance) {
    log("Fielder's choice! Lead runner thrown out — batter reaches first safely.");
    const oldBase = stateWithPitch.baseLayout;
    const newBase: [number, number, number] = [1, 0, 0];
    let runsScored = 0;
    if (oldBase[0]) {
      if (oldBase[2]) runsScored++;
      if (oldBase[1]) newBase[2] = 1;
    } else if (oldBase[1]) {
      if (oldBase[2]) runsScored++;
    }
    const newScore: [number, number] = [stateWithPitch.score[0], stateWithPitch.score[1]];
    newScore[stateWithPitch.atBat] += runsScored;
    if (runsScored > 0) log(runsScored === 1 ? "One run scores!" : `${runsScored} runs score!`);
    // Shift runner IDs: lead runner is out, remaining runners advance per base movement
    const fcOldIds =
      stateWithPitch.baseRunnerIds ??
      ([null, null, null] as [string | null, string | null, string | null]);
    const fcNewRunnerIds: [string | null, string | null, string | null] = [null, null, null];
    if (oldBase[0]) {
      // lead runner on 1st is out; if runner on 2nd, they move to 3rd
      if (oldBase[1]) fcNewRunnerIds[2] = fcOldIds[1];
      // runner on 3rd scores (ID drops)
    } else if (oldBase[1]) {
      // lead runner on 2nd is out; runner on 3rd scores (ID drops)
    }
    // batter goes to 1st — ID unknown here (null)
    // Track pitcher: runs scored only. battersFaced is incremented by playerOut(…, true) below.
    const pitchingTeam = (1 - (stateWithPitch.atBat as number)) as 0 | 1;
    const pitcherLogAfterFC = updateActivePitcherLog(
      stateWithPitch.pitcherGameLog ?? [[], []],
      pitchingTeam,
      (entry) => ({
        ...entry,
        runsAllowed: entry.runsAllowed + runsScored,
      }),
    );
    const afterFC = addInningRuns(
      {
        ...stateWithPitch,
        baseLayout: newBase,
        score: newScore,
        baseRunnerIds: fcNewRunnerIds,
        pendingDecision: null as DecisionType | null,
        onePitchModifier: null as OnePitchModifier,
        strikes: 0,
        balls: 0,
        hitType: undefined,
        pitchKey: (stateWithPitch.pitchKey ?? 0) + 1,
        pitcherGameLog: pitcherLogAfterFC,
      },
      runsScored,
    );
    return checkWalkoff(playerOut(afterFC, log, true), log);
  }

  if (roll < 80) {
    log("Sacrifice bunt! Runner(s) advance.");
    const oldBase = stateWithPitch.baseLayout;
    const newBase: [number, number, number] = [0, 0, 0];
    let runsScored = 0;
    if (oldBase[2]) runsScored++;
    if (oldBase[1]) newBase[2] = 1;
    if (oldBase[0]) newBase[1] = 1;
    const newScore: [number, number] = [stateWithPitch.score[0], stateWithPitch.score[1]];
    newScore[stateWithPitch.atBat] += runsScored;
    if (runsScored > 0) log(runsScored === 1 ? "One run scores!" : `${runsScored} runs score!`);
    // Shift runner IDs following the same movement as bases
    const sacOldIds =
      stateWithPitch.baseRunnerIds ??
      ([null, null, null] as [string | null, string | null, string | null]);
    const sacNewRunnerIds: [string | null, string | null, string | null] = [null, null, null];
    if (oldBase[1]) sacNewRunnerIds[2] = sacOldIds[1]; // 2nd → 3rd
    if (oldBase[0]) sacNewRunnerIds[1] = sacOldIds[0]; // 1st → 2nd
    // runner on 3rd scores — ID drops; batter out — no ID placed
    // Track pitcher: runs scored for sac-bunt plays.
    const pitchingTeamSac = (1 - (stateWithPitch.atBat as number)) as 0 | 1;
    const pitcherLogAfterSac = updateActivePitcherLog(
      stateWithPitch.pitcherGameLog ?? [[], []],
      pitchingTeamSac,
      (entry) => ({ ...entry, runsAllowed: entry.runsAllowed + runsScored }),
    );
    const afterBunt = addInningRuns(
      {
        ...stateWithPitch,
        baseLayout: newBase,
        score: newScore,
        baseRunnerIds: sacNewRunnerIds,
        pendingDecision: null as DecisionType | null,
        onePitchModifier: null as OnePitchModifier,
        pinchHitterStrategy: null as Strategy | null,
        strikes: 0,
        balls: 0,
        hitType: undefined,
        pitchKey: (stateWithPitch.pitchKey ?? 0) + 1,
        pitcherGameLog: pitcherLogAfterSac,
      },
      runsScored,
    );
    return checkWalkoff(playerOut(afterBunt, log, true), log);
  }

  log("Bunt popped up — out!");
  return playerOut(
    {
      ...stateWithPitch,
      pendingDecision: null,
      hitType: undefined,
      pitchKey: (stateWithPitch.pitchKey ?? 0) + 1,
    },
    log,
    true,
  );
};
