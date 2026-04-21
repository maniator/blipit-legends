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

import type { PlayerOverrides } from "@storage/types";

import type { ScheduledGameRecord } from "../storage/types";
import { deriveScheduledGameSeed } from "./deriveScheduledGameSeed";

export interface SimulatedGameResult {
  homeScore: number;
  awayScore: number;
  winnerId: string;
  loserId: string;
  isTie: boolean;
  /** Full final game state — used by callers to extract career stats and per-inning box score data. */
  finalState: State;
}

/** Options for a headless simulation run. When provided, the real team roster is applied so player IDs and names match career stats records. */
export interface SimulateGameOptions {
  /**
   * Full roster data for both teams (lineup order, bench, pitchers, handedness,
   * player attribute overrides). When provided, the simulation uses actual custom-team
   * player IDs and names so career stats are meaningful. When omitted, generic player
   * IDs are used (appropriate for built-in / default teams).
   */
  playerOverrides?: PlayerOverrides;
  /** Human-readable display label for the away team (shown in box scores). Defaults to the team ID. */
  awayTeamLabel?: string;
  /** Human-readable display label for the home team (shown in box scores). Defaults to the team ID. */
  homeTeamLabel?: string;
}

const MAX_ITERATIONS = 10_000;

export async function simulateGame(
  game: ScheduledGameRecord,
  leagueSeasonId: string,
  options?: SimulateGameOptions,
): Promise<SimulatedGameResult> {
  const seed = deriveScheduledGameSeed(leagueSeasonId, game.id);
  reinitSeed(seed);

  let state: State = createFreshGameState([game.awayTeamId, game.homeTeamId]);
  const reducerFn = reducerFactory(() => {});

  // Apply team roster / player overrides so the simulation uses real player IDs
  // and names — this makes career stats meaningful for custom-team players.
  if (options) {
    const { playerOverrides, awayTeamLabel, homeTeamLabel } = options;
    state = reducerFn(state, {
      type: "setTeams",
      payload: {
        teams: [game.awayTeamId, game.homeTeamId] as [string, string],
        teamLabels: [awayTeamLabel ?? game.awayTeamId, homeTeamLabel ?? game.homeTeamId] as [
          string,
          string,
        ],
        ...(playerOverrides && {
          playerOverrides: [playerOverrides.away, playerOverrides.home] as [
            typeof playerOverrides.away,
            typeof playerOverrides.home,
          ],
          lineupOrder: [playerOverrides.awayOrder, playerOverrides.homeOrder] as [
            string[],
            string[],
          ],
          rosterBench: [playerOverrides.awayBench ?? [], playerOverrides.homeBench ?? []] as [
            string[],
            string[],
          ],
          rosterPitchers: [
            playerOverrides.awayPitchers ?? [],
            playerOverrides.homePitchers ?? [],
          ] as [string[], string[]],
          ...(playerOverrides.awayHandedness !== undefined ||
          playerOverrides.homeHandedness !== undefined
            ? {
                handednessByTeam: [
                  playerOverrides.awayHandedness ?? {},
                  playerOverrides.homeHandedness ?? {},
                ] as [Record<string, string>, Record<string, string>],
              }
            : {}),
        }),
      },
    } as GameAction);
  }

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

  return { homeScore, awayScore, winnerId, loserId, isTie, finalState: state };
}
