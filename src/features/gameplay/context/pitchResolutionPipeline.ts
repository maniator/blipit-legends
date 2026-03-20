import type { PitchType } from "@feat/gameplay/constants/pitchTypes";
import { selectPitchType } from "@feat/gameplay/constants/pitchTypes";
import {
  buildHandednessMatchup,
  getHandednessOutcomeModifiers,
  resolvePitcherHandedness,
  resolvePlayerHandedness,
} from "@feat/gameplay/context/handednessMatchup";
import {
  computeBatterFatigueFactor,
  computeFatigueFactor,
  computeSwingRate,
  resolveBattedBallType,
  resolveSwingOutcome,
} from "@feat/gameplay/context/pitchSimulation";
import { ZERO_MODS } from "@feat/gameplay/context/resolvePlayerMods";
import getRandomInt from "@feat/gameplay/utils/getRandomInt";

import type { OnePitchModifier } from "./decisionTypes";
import type { GameAction, State } from "./gameStateTypes";
import type { Strategy } from "./playerTypes";

export interface ResolvePitchOptions {
  currentState: State;
  effectiveStrategy: Strategy;
  onePitchMod: OnePitchModifier;
  dispatch: (action: GameAction) => void;
}

/**
 * Resolves a single pitch against the current batter, dispatching the appropriate
 * game action (strike, foul, hit, or wait). Handles batter/pitcher mod lookups,
 * handedness matchup, fatigue, swing rate, and batted-ball resolution.
 */
export function resolvePitch({
  currentState,
  effectiveStrategy,
  onePitchMod,
  dispatch,
}: ResolvePitchOptions): void {
  const currentStrikes = currentState.strikes;
  const currentBalls = currentState.balls;

  // 1. Select pitch type based on current count.
  const pitchType: PitchType = selectPitchType(currentBalls, currentStrikes, getRandomInt(100));

  // Look up batter contact/power mods.
  const battingTeam = currentState.atBat as 0 | 1;
  const batterSlotIdx = currentState.batterIndex[battingTeam];
  const batterId = currentState.lineupOrder[battingTeam]?.[batterSlotIdx];
  const batterMods = batterId
    ? (currentState.resolvedMods?.[battingTeam]?.[batterId] ?? ZERO_MODS)
    : ZERO_MODS;

  // Look up active pitcher mods (velocity, movement, stamina).
  const pitchingTeam = (1 - (currentState.atBat as number)) as 0 | 1;
  const activePitcherId =
    currentState.rosterPitchers?.[pitchingTeam]?.[
      currentState.activePitcherIdx?.[pitchingTeam] ?? 0
    ];
  const pitcherMods = activePitcherId
    ? (currentState.resolvedMods?.[pitchingTeam]?.[activePitcherId] ?? ZERO_MODS)
    : ZERO_MODS;

  const batterHandedness = batterId
    ? resolvePlayerHandedness(currentState.handednessByTeam[battingTeam]?.[batterId], batterId)
    : "R";
  const pitcherHandedness = activePitcherId
    ? resolvePitcherHandedness(
        currentState.handednessByTeam[pitchingTeam]?.[activePitcherId],
        activePitcherId,
      )
    : "R";
  const matchup = buildHandednessMatchup(batterHandedness, pitcherHandedness);
  const matchupMods = getHandednessOutcomeModifiers(matchup);

  // Compute pitcher fatigue factor from pitch count (primary) and batters faced (secondary).
  const pitcherBattersFaced = (currentState.pitcherBattersFaced ?? [0, 0])[pitchingTeam];
  const pitcherPitchCount = (currentState.pitcherPitchCount ?? [0, 0])[pitchingTeam];
  const fatigueFactor = computeFatigueFactor(
    pitcherPitchCount,
    pitcherBattersFaced,
    pitcherMods.staminaMod,
  );

  const batterPlateAppearances = (currentState.batterPlateAppearances ?? [{}, {}])[battingTeam];
  const batterPaCount = batterId ? (batterPlateAppearances[batterId] ?? 0) : 0;
  const batterFatigue = computeBatterFatigueFactor(batterPaCount, batterMods.staminaMod);
  const effectiveBatterContactMod = batterMods.contactMod - batterFatigue.contactPenalty;
  const effectiveBatterPowerMod = batterMods.powerMod - batterFatigue.powerPenalty;

  // 2. Determine swing vs. take.
  const swingRoll = getRandomInt(1000);
  const swingRate = computeSwingRate(currentStrikes, {
    strategy: effectiveStrategy,
    batterContactMod: batterMods.contactMod,
    pitchType,
    onePitchMod,
    swingRateMultiplier: matchupMods.swingRateMultiplier,
  });

  if (swingRoll < swingRate) {
    // 3. Batter swings — resolve whiff / foul / contact.
    const outcomeRoll = getRandomInt(100);
    const swingOutcome = resolveSwingOutcome(outcomeRoll, {
      pitcherVelocityMod: pitcherMods.velocityMod,
      pitcherMovementMod: pitcherMods.movementMod,
      batterContactMod: effectiveBatterContactMod,
      fatigueFactor,
      whiffRateMultiplier: matchupMods.whiffRateMultiplier,
    });

    if (swingOutcome === "whiff") {
      dispatch({ type: "strike", payload: { swung: true, pitchType } });
    } else if (swingOutcome === "foul") {
      dispatch({ type: "foul", payload: { pitchType } });
    } else {
      // 4. Contact — resolve batted-ball type (contact quality → ball-in-play shape).
      const contactRoll = getRandomInt(100);
      const typeRoll = getRandomInt(100);
      const battedBallType = resolveBattedBallType(contactRoll, typeRoll, {
        strategy: effectiveStrategy,
        batterPowerMod: effectiveBatterPowerMod,
        pitcherVelocityMod: pitcherMods.velocityMod,
        pitcherMovementMod: pitcherMods.movementMod,
        fatigueFactor,
        hardContactMultiplier: matchupMods.hardContactMultiplier,
      });
      dispatch({ type: "hit", payload: { battedBallType, strategy: effectiveStrategy } });
    }
  } else {
    // 5. Batter takes the pitch — resolve ball or called strike.
    dispatch({
      type: "wait",
      payload: {
        strategy: effectiveStrategy,
        pitchType,
        walkRateMultiplier: matchupMods.walkRateMultiplier,
        calledStrikeRateMultiplier: matchupMods.calledStrikeRateMultiplier,
      },
    });
  }
}
