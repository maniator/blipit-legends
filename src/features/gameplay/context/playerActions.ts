import type { PitchType } from "@feat/gameplay/constants/pitchTypes";
import { pitchName, pitchStrikeZoneMod } from "@feat/gameplay/constants/pitchTypes";
import getRandomInt from "@feat/gameplay/utils/getRandomInt";
import { Hit } from "@shared/constants/hitTypes";

import type { OnePitchModifier } from "./decisionTypes";
import type { State } from "./gameStateTypes";
import { hitBall } from "./hitBall";
import { updateActivePitcherLog } from "./pitcherLog";
import { computeFatigueFactor } from "./pitchSimulation";
import { incrementPitchCount, playerOut } from "./playerOut";
import type { Strategy } from "./playerTypes";
import { ZERO_MODS } from "./resolvePlayerMods";
import { stratMod } from "./strategy";

export { buntAttempt } from "./buntAttempt";
export { stealAttempt } from "./stealAttempt";

export const playerStrike = (
  state: State,
  log: (msg: string) => void,
  swung = false,
  foul = false,
  pitchType?: PitchType,
): State => {
  // Count this pitch before processing its outcome.
  const stateWithPitch = incrementPitchCount(state);
  const newStrikes = stateWithPitch.strikes + 1;
  const pitchKey = (stateWithPitch.pitchKey ?? 0) + 1;
  const msg = (text: string) =>
    pitchType ? `${pitchName(pitchType)} — ${text}` : `${text[0].toUpperCase()}${text.slice(1)}`;

  if (newStrikes === 3) {
    log(
      swung
        ? msg("swing and a miss — strike three! He's out!")
        : msg("called strike three! He's out!"),
    );
    // Track strikeout for the active pitcher before recording the out.
    const pitchingTeam = (1 - (stateWithPitch.atBat as number)) as 0 | 1;
    const stateWithK = {
      ...stateWithPitch,
      pitcherGameLog: updateActivePitcherLog(
        stateWithPitch.pitcherGameLog ?? [[], []],
        pitchingTeam,
        (entry) => ({ ...entry, strikeoutsRecorded: entry.strikeoutsRecorded + 1 }),
      ),
    };
    return playerOut({ ...stateWithK, pitchKey }, log, true);
  }

  if (foul) {
    log(msg(`foul ball — strike ${newStrikes}.`));
  } else {
    log(
      swung ? msg(`swing and a miss — strike ${newStrikes}.`) : msg(`called strike ${newStrikes}.`),
    );
  }

  return {
    ...stateWithPitch,
    strikes: newStrikes,
    pendingDecision: null,
    onePitchModifier: null,
    hitType: undefined,
    pitchKey,
  };
};

export const playerBall = (
  state: State,
  log: (msg: string) => void,
  pitchType?: PitchType,
): State => {
  // Count this pitch before processing its outcome.
  const stateWithPitch = incrementPitchCount(state);
  const newBalls = stateWithPitch.balls + 1;
  const pitchKey = (stateWithPitch.pitchKey ?? 0) + 1;
  const msg = (text: string) =>
    pitchType ? `${pitchName(pitchType)} — ${text}` : `${text[0].toUpperCase()}${text.slice(1)}`;

  if (newBalls === 4) {
    log(msg("ball four — take your base!"));
    return hitBall(Hit.Walk, { ...stateWithPitch, pitchKey }, log);
  }

  log(msg(`ball ${newBalls}.`));
  return {
    ...stateWithPitch,
    balls: newBalls,
    pendingDecision: null,
    onePitchModifier: null,
    hitType: undefined,
    pitchKey,
  };
};

interface ComputeWaitOutcomeOptions {
  strategy: Strategy;
  modifier: OnePitchModifier;
  pitchType?: PitchType;
  pitcherControlMod?: number;
  pitcherVelocityMod?: number;
  walkRateMultiplier?: number;
  calledStrikeRateMultiplier?: number;
}

const computeWaitOutcome = (
  random: number,
  {
    strategy,
    modifier,
    pitchType,
    pitcherControlMod = 0,
    pitcherVelocityMod = 0,
    walkRateMultiplier = 1,
    calledStrikeRateMultiplier = 1,
  }: ComputeWaitOutcomeOptions,
): "ball" | "strike" => {
  const zoneMod = pitchType ? pitchStrikeZoneMod(pitchType) : 1.0;
  // Higher control = pitcher more likely to throw strikes; higher velocity = harder to draw walks.
  // Clamp all thresholds to [0, 999] to stay within the getRandomInt(1000) RNG range.
  const controlFactor = 1 + (pitcherControlMod + pitcherVelocityMod / 2) / 100;
  if (modifier === "take") {
    const adjustedWalkChance = Math.min(
      999,
      Math.max(
        0,
        Math.round(
          // Raised 220→380: baseline sweep (seeds 0–99) gave 1.90 BB/team/game vs 2023 MLB
          // target 3.28. Increasing the deliberate-take ball chance brings intentional
          // walks (3-0 count AI take) closer to realistic draw rates.
          (380 * stratMod(strategy, "walk") * walkRateMultiplier) / (zoneMod * controlFactor),
        ),
      ),
    );
    return random < adjustedWalkChance ? "ball" : "strike";
  }
  const adjustedStrikeThreshold = Math.min(
    999,
    Math.max(
      0,
      Math.round(
        // Lowered 500→350: reduces called-strike frequency on taken pitches, increasing
        // ball accumulation to bring BB/game closer to the 2023 MLB target of 3.28/team.
        ((350 * zoneMod * controlFactor * calledStrikeRateMultiplier) /
          stratMod(strategy, "walk")) *
          (1 / Math.max(0.5, walkRateMultiplier)),
      ),
    ),
  );
  return random < adjustedStrikeThreshold ? "strike" : "ball";
};

interface PlayerWaitOptions {
  walkRateMultiplier?: number;
  calledStrikeRateMultiplier?: number;
}

export const playerWait = (
  state: State,
  log: (msg: string) => void,
  strategy: Strategy = "balanced",
  modifier: OnePitchModifier = null,
  pitchType?: PitchType,
  { walkRateMultiplier = 1, calledStrikeRateMultiplier = 1 }: PlayerWaitOptions = {},
): State => {
  const random = getRandomInt(1000);
  // Look up active pitcher's control and velocity mods
  const pitchingTeam = (1 - (state.atBat as number)) as 0 | 1;
  const activePitcherId =
    state.rosterPitchers[pitchingTeam]?.[state.activePitcherIdx[pitchingTeam]];
  const pitcherMods = activePitcherId
    ? (state.resolvedMods?.[pitchingTeam]?.[activePitcherId] ?? ZERO_MODS)
    : ZERO_MODS;
  const pitcherControlMod = pitcherMods.controlMod;
  const pitcherVelocityMod = pitcherMods.velocityMod;

  // Fatigue reduces effective control: a tired pitcher misses the zone more often.
  const pitcherBattersFaced = (state.pitcherBattersFaced ?? [0, 0])[pitchingTeam];
  const pitcherPitchCount = (state.pitcherPitchCount ?? [0, 0])[pitchingTeam];
  const fatigueFactor = computeFatigueFactor(
    pitcherPitchCount,
    pitcherBattersFaced,
    pitcherMods.staminaMod,
  );
  const fatigueControlPenalty = Math.round((fatigueFactor - 1) * 20);
  const effectiveControlMod = pitcherControlMod - fatigueControlPenalty;

  const outcome = computeWaitOutcome(random, {
    strategy,
    modifier,
    pitchType,
    pitcherControlMod: effectiveControlMod,
    pitcherVelocityMod,
    walkRateMultiplier,
    calledStrikeRateMultiplier,
  });
  return outcome === "ball"
    ? playerBall(state, log, pitchType)
    : playerStrike(state, log, false, false, pitchType);
};
