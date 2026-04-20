import {
  makeAiPitchingDecision,
  makeAiStrategyDecision,
  makeAiTacticalDecision,
} from "@feat/gameplay/context/aiManager";
import type { GameAction, State } from "@feat/gameplay/context/gameStateTypes";
import { createFreshGameState } from "@feat/gameplay/context/initialState";
import { resolvePitch } from "@feat/gameplay/context/pitchResolutionPipeline";
import reducerFactory, { detectDecision } from "@feat/gameplay/context/reducer";
import { reinitSeed } from "@shared/utils/rng";

import type { ScheduledGameRecord } from "../storage/types";
import { deriveScheduledGameSeed } from "./deriveScheduledGameSeed";

export interface SimulatedGameResult {
  homeScore: number;
  awayScore: number;
  winnerId: string;
  loserId: string;
  isTie: boolean;
}

const MAX_ITERATIONS = 10_000;

export async function simulateGame(
  game: ScheduledGameRecord,
  leagueSeasonId: string,
): Promise<SimulatedGameResult> {
  const seed = deriveScheduledGameSeed(leagueSeasonId, game.id);
  reinitSeed(seed);

  let state: State = createFreshGameState([game.awayTeamId, game.homeTeamId]);
  const reducerFn = reducerFactory(() => {});

  let iterations = 0;

  while (!state.gameOver && iterations < MAX_ITERATIONS) {
    iterations++;
    let pitchReplaced = false;

    if (state.suppressNextDecision) {
      state = reducerFn(state, { type: "clear_suppress_decision" });
    } else {
      const battingTeam = state.atBat as 0 | 1;
      const aiStrategy = makeAiStrategyDecision(state, battingTeam);

      if (state.balls === 0 && state.strikes === 0) {
        const pitchingTeamIdx = (1 - battingTeam) as 0 | 1;
        const aiPitchDecision = makeAiPitchingDecision(state, pitchingTeamIdx, {});
        if (aiPitchDecision.kind === "pitching_change") {
          state = reducerFn(state, {
            type: "make_substitution",
            payload: {
              teamIdx: aiPitchDecision.teamIdx,
              kind: "pitcher",
              pitcherIdx: aiPitchDecision.pitcherIdx,
              reason: aiPitchDecision.reasonText,
            },
          });
        }
        if (!state.defensiveShiftOffered) {
          const shiftDecision = makeAiTacticalDecision(state, { kind: "defensive_shift" });
          if (shiftDecision.kind === "tactical") {
            state = reducerFn(state, {
              type: shiftDecision.actionType as GameAction["type"],
              payload: shiftDecision.payload,
            });
          }
        }
      }

      const battingDecision = detectDecision(state, aiStrategy, true);
      if (battingDecision) {
        const aiAction = makeAiTacticalDecision(state, battingDecision);
        if (aiAction.kind === "tactical") {
          state = reducerFn(state, {
            type: aiAction.actionType as GameAction["type"],
            payload: aiAction.payload,
          });
          if (
            battingDecision.kind === "pinch_hitter" &&
            aiAction.actionType === "make_substitution"
          ) {
            state = reducerFn(state, {
              type: "set_pinch_hitter_strategy",
              payload: "contact",
            });
          }
          pitchReplaced = ["steal_attempt", "bunt_attempt", "intentional_walk"].includes(
            aiAction.actionType,
          );
        } else {
          state = reducerFn(state, { type: "skip_decision" });
        }
      }
    }

    if (!pitchReplaced) {
      const battingTeam = state.atBat as 0 | 1;
      const aiStrategy = makeAiStrategyDecision(state, battingTeam);
      const effectiveStrategy = state.pinchHitterStrategy ?? aiStrategy;
      let pitchAction: GameAction | null = null;
      resolvePitch({
        currentState: state,
        effectiveStrategy,
        onePitchMod: state.onePitchModifier,
        dispatch: (action) => {
          pitchAction = action;
        },
      });
      if (pitchAction !== null) {
        state = reducerFn(state, pitchAction as GameAction);
      }
    }
  }

  const awayScore = state.score[0];
  const homeScore = state.score[1];
  const isTie = awayScore === homeScore;

  let winnerId: string;
  let loserId: string;
  if (homeScore > awayScore) {
    winnerId = game.homeTeamId;
    loserId = game.awayTeamId;
  } else if (awayScore > homeScore) {
    winnerId = game.awayTeamId;
    loserId = game.homeTeamId;
  } else {
    winnerId = game.homeTeamId;
    loserId = game.awayTeamId;
  }

  return { homeScore, awayScore, winnerId, loserId, isTie };
}
