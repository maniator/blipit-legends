/**
 * Shared helpers for calibration harness tests.
 *
 * Provides a production-faithful game runner that mirrors the dispatch pipeline
 * in usePitchDispatch (including the AI steal-threshold override).
 */
import { selectPitchType } from "@feat/gameplay/constants/pitchTypes";
import {
  makeAiPitchingDecision,
  makeAiStrategyDecision,
  makeAiTacticalDecision,
} from "@feat/gameplay/context/aiManager";
import type { GameAction, LogAction, State } from "@feat/gameplay/context/index";
import { createFreshGameState } from "@feat/gameplay/context/initialState";
import { DEFAULT_MANAGER_DECISION_VALUES } from "@feat/gameplay/context/managerDecisionValues";
import {
  computeFatigueFactor,
  computeSwingRate,
  resolveBattedBallType,
  resolveSwingOutcome,
} from "@feat/gameplay/context/pitchSimulation";
import type { TeamCustomPlayerOverrides } from "@feat/gameplay/context/playerTypes";
import reducerFactory, { detectDecision } from "@feat/gameplay/context/reducer";
import { ZERO_MODS } from "@feat/gameplay/context/resolvePlayerMods";
import getRandomInt from "@feat/gameplay/utils/getRandomInt";
import { Hit } from "@shared/constants/hitTypes";
import { restoreRng } from "@shared/utils/rng";

export interface SimStats {
  plateAppearances: number;
  atBats: number;
  walks: number;
  strikeouts: number;
  singles: number;
  doubles: number;
  triples: number;
  homeRuns: number;
  sacFlies: number;
  runsTotal: number;
  sbAttempts: number;
  sbSuccesses: number;
  doublePlays: number;
  totalPitches: number;
  totalInnings: number;
  starterBattersFaced: number[];
  relievers: number;
}

export interface GameSetup {
  teams?: [string, string];
  playerOverrides?: [TeamCustomPlayerOverrides, TeamCustomPlayerOverrides];
  lineupOrder?: [string[], string[]];
  rosterPitchers?: [string[], string[]];
}

/**
 * Runs a single game to completion using the game reducer and pitch pipeline.
 * Seeds the global PRNG so results are deterministic for a given seed.
 *
 * Production-faithful: mirrors usePitchDispatch's AI path, including passing
 * stealMinOfferPct: aiStealThreshold to detectDecision (not the default).
 */
export function runGame(seed: number, setup?: GameSetup): SimStats {
  restoreRng(seed);

  const logs: string[] = [];
  const dispatchLog = (action: LogAction) => {
    if (action.type === "log" && action.payload) logs.push(action.payload);
  };

  const gameReducer = reducerFactory(dispatchLog);
  let state: State = createFreshGameState(setup?.teams ?? ["Away", "Home"]);

  const dispatch = (action: GameAction): void => {
    state = gameReducer(state, action);
  };

  // Apply custom team setup if provided.
  if (setup) {
    const p: Record<string, unknown> = { teams: setup.teams ?? ["Away", "Home"] };
    if (setup.playerOverrides) p.playerOverrides = setup.playerOverrides;
    if (setup.lineupOrder) p.lineupOrder = setup.lineupOrder;
    if (setup.rosterPitchers) p.rosterPitchers = setup.rosterPitchers;
    dispatch({ type: "setTeams", payload: p as GameAction["payload"] });
  }

  let maxTicks = 50000;

  while (!state.gameOver && maxTicks-- > 0) {
    const pitchingTeamIdx = (1 - state.atBat) as 0 | 1;

    if (state.balls === 0 && state.strikes === 0) {
      const aiPitchDecision = makeAiPitchingDecision(state, pitchingTeamIdx, {});
      if (aiPitchDecision.kind === "pitching_change") {
        dispatch({
          type: "make_substitution",
          payload: {
            teamIdx: aiPitchDecision.teamIdx,
            kind: "pitcher",
            pitcherIdx: aiPitchDecision.pitcherIdx,
            reason: aiPitchDecision.reasonText,
          },
        });
      }
    }

    const aiStrategy = makeAiStrategyDecision(state, state.atBat as 0 | 1);

    if (state.suppressNextDecision) {
      dispatch({ type: "clear_suppress_decision" });
    } else {
      // Production-faithful: mirror usePitchDispatch AI path
      // (stealMinOfferPct overridden to aiStealThreshold)
      const aiDecisionValues = {
        ...DEFAULT_MANAGER_DECISION_VALUES,
        stealMinOfferPct: DEFAULT_MANAGER_DECISION_VALUES.aiStealThreshold,
      };
      const battingDecision = detectDecision(state, aiStrategy, true, aiDecisionValues);
      if (battingDecision) {
        const aiAction = makeAiTacticalDecision(state, battingDecision);
        if (aiAction.kind === "tactical") {
          dispatch({
            type: aiAction.actionType as GameAction["type"],
            payload: aiAction.payload,
          });
          if (
            battingDecision.kind === "pinch_hitter" &&
            aiAction.actionType === "make_substitution"
          ) {
            dispatch({ type: "set_pinch_hitter_strategy", payload: "contact" });
          }
          if (["steal_attempt", "bunt_attempt", "intentional_walk"].includes(aiAction.actionType)) {
            continue;
          }
        } else {
          dispatch({ type: "skip_decision" });
        }
      }
    }

    const effectiveStrategy = state.pinchHitterStrategy ?? aiStrategy;
    const onePitchMod = state.onePitchModifier;
    const pitchType = selectPitchType(state.balls, state.strikes, getRandomInt(100));

    const battingTeam = state.atBat as 0 | 1;
    const batterSlotIdx = state.batterIndex[battingTeam];
    const batterId = state.lineupOrder[battingTeam]?.[batterSlotIdx];
    const batterMods = batterId
      ? (state.resolvedMods?.[battingTeam]?.[batterId] ?? ZERO_MODS)
      : ZERO_MODS;

    const pitchingTeam = (1 - (state.atBat as number)) as 0 | 1;
    const activePitcherId =
      state.rosterPitchers?.[pitchingTeam]?.[(state.activePitcherIdx ?? [0, 0])[pitchingTeam]];
    const pitcherMods = activePitcherId
      ? (state.resolvedMods?.[pitchingTeam]?.[activePitcherId] ?? ZERO_MODS)
      : ZERO_MODS;

    const pitcherBattersFaced = (state.pitcherBattersFaced ?? [0, 0])[pitchingTeam];
    const pitcherPitchCount = (state.pitcherPitchCount ?? [0, 0])[pitchingTeam];
    const fatigueFactor = computeFatigueFactor(
      pitcherPitchCount,
      pitcherBattersFaced,
      pitcherMods.staminaMod,
    );

    const swingRoll = getRandomInt(1000);
    const swingRate = computeSwingRate(state.strikes, {
      strategy: effectiveStrategy,
      batterContactMod: batterMods.contactMod,
      pitchType,
      onePitchMod,
    });

    if (swingRoll < swingRate) {
      const outcomeRoll = getRandomInt(100);
      const swingOutcome = resolveSwingOutcome(outcomeRoll, {
        pitcherVelocityMod: pitcherMods.velocityMod,
        pitcherMovementMod: pitcherMods.movementMod,
        batterContactMod: batterMods.contactMod,
        fatigueFactor,
      });

      if (swingOutcome === "whiff") {
        dispatch({ type: "strike", payload: { swung: true, pitchType } });
      } else if (swingOutcome === "foul") {
        dispatch({ type: "foul", payload: { pitchType } });
      } else {
        const contactRoll = getRandomInt(100);
        const typeRoll = getRandomInt(100);
        const battedBallType = resolveBattedBallType(contactRoll, typeRoll, {
          strategy: effectiveStrategy,
          batterPowerMod: batterMods.powerMod,
          pitcherVelocityMod: pitcherMods.velocityMod,
          pitcherMovementMod: pitcherMods.movementMod,
          fatigueFactor,
        });
        dispatch({ type: "hit", payload: { battedBallType, strategy: effectiveStrategy } });
      }
    } else {
      dispatch({ type: "wait", payload: { strategy: effectiveStrategy, pitchType } });
    }
  }

  // Tally hit types from playLog
  let singles = 0,
    doubles = 0,
    triples = 0,
    homeRuns = 0,
    walks = 0;
  for (const entry of state.playLog) {
    if (entry.event === Hit.Single) singles++;
    else if (entry.event === Hit.Double) doubles++;
    else if (entry.event === Hit.Triple) triples++;
    else if (entry.event === Hit.Homerun) homeRuns++;
    else if (entry.event === Hit.Walk) walks++;
  }

  const sacFlies = state.outLog.filter((e) => e.isSacFly).length;
  const strikeouts = state.strikeoutLog.length;
  const hits = singles + doubles + triples + homeRuns;

  // PA = hits + walks + all outs (outLog contains K + non-K)
  const plateAppearances = hits + walks + state.outLog.length;
  // AB = PA - BB - SF
  const atBats = plateAppearances - walks - sacFlies;

  // Count SB, DP from log strings
  let sbAttempts = 0,
    sbSuccesses = 0,
    doublePlays = 0;
  for (const msg of logs) {
    if (msg.includes("Steal attempt")) sbAttempts++;
    if (msg.includes("Safe! Steal successful")) sbSuccesses++;
    if (msg.includes("double play")) doublePlays++;
  }

  const totalPitches =
    (state.pitcherPitchCount ?? [0, 0])[0] + (state.pitcherPitchCount ?? [0, 0])[1];
  // state.inning is 1-based; when game ends it points to the inning that just finished
  const totalInnings = Math.max(1, state.inning - 1);

  const starterBattersFaced: number[] = [];
  for (let team = 0; team < 2; team++) {
    const log = state.pitcherGameLog[team as 0 | 1];
    if (log.length > 0) {
      starterBattersFaced.push(log[0].battersFaced);
    }
  }

  const relievers =
    Math.max(0, state.pitcherGameLog[0].length - 1) +
    Math.max(0, state.pitcherGameLog[1].length - 1);

  return {
    plateAppearances,
    atBats,
    walks,
    strikeouts,
    singles,
    doubles,
    triples,
    homeRuns,
    sacFlies,
    runsTotal: state.score[0] + state.score[1],
    sbAttempts,
    sbSuccesses,
    doublePlays,
    totalPitches,
    totalInnings,
    starterBattersFaced,
    relievers,
  };
}
