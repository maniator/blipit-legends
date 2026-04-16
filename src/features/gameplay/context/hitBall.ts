import getRandomInt from "@feat/gameplay/utils/getRandomInt";
import { Hit } from "@shared/constants/hitTypes";
import { generateRoster } from "@shared/utils/roster";

import { advanceRunners } from "./advanceRunners";
import type { DecisionType, OnePitchModifier } from "./decisionTypes";
import type { PlayLogEntry } from "./gameLogTypes";
import type { State } from "./gameStateTypes";
import { updateActivePitcherLog } from "./pitcherLog";
import type { BattedBallType } from "./pitchSimulation";
import { computeFatigueFactor } from "./pitchSimulation";
import { incrementPitcherFatigue, nextBatter, playerOut } from "./playerOut";
import type { Strategy } from "./playerTypes";
import { resolveBatterPlayerId } from "./resolveBatterPlayerId";
import { ZERO_MODS } from "./resolvePlayerMods";
import { stratMod } from "./strategy";

// Vivid hit callouts — logged before processConfirmedHit (by callers).
const HIT_CALLOUTS: Record<Hit, string> = {
  [Hit.Single]: "He lines it into the outfield — base hit!",
  [Hit.Double]: "Into the gap — that's a double!",
  [Hit.Triple]: "Deep drive to the warning track — he's in with a triple!",
  [Hit.Homerun]: "That ball is GONE — home run!",
  [Hit.Walk]: "",
  [Hit.HitByPitch]: "",
};

/**
 * Look up the speedMod for a player by their ID from both team's resolved mods.
 * Returns 0 if the player is not found (stock teams / no overrides).
 */
const getSpeedMod = (state: State, playerId: string | null | undefined): number => {
  if (!playerId) return 0;
  return (
    state.resolvedMods?.[0]?.[playerId]?.speedMod ??
    state.resolvedMods?.[1]?.[playerId]?.speedMod ??
    0
  );
};

/**
 * Handle a ground ball out. Implements three scenarios:
 *   1. Double play — runner on 1st with <2 outs, conditions right: two outs recorded.
 *   2. Fielder's choice — runner on 1st with <2 outs, DP not turned: lead runner out, batter safe.
 *   3. Simple ground out — no force play: batter thrown out at 1st.
 *
 * DP probability is context-aware: slow batter and slow runner increase DP likelihood;
 * fast batter or fast runner reduce it.
 */
const handleGrounder = (state: State, log: (msg: string) => void, pitchKey: number): State => {
  const { baseLayout, outs } = state;
  const groundedState = { ...state, pitchKey, hitType: undefined as Hit | undefined };

  // Batter identity — needed to assign runner ID when batter reaches on FC.
  const battingTeam = state.atBat as 0 | 1;
  const batterSlotIdx = state.batterIndex[battingTeam];
  const batterId = resolveBatterPlayerId(state, battingTeam, batterSlotIdx);

  if (baseLayout[0] && outs < 2) {
    // Context-aware DP probability: base 55%, adjusted by batter and runner speed.
    const batterSpeedMod = getSpeedMod(state, batterId);
    const runnerSpeedMod = getSpeedMod(state, state.baseRunnerIds?.[0]);
    // Faster players reduce DP chance; slower players increase it.
    const dpChance = Math.max(
      20,
      Math.min(80, 55 - Math.round(batterSpeedMod / 2) - Math.round(runnerSpeedMod / 2)),
    );

    if (getRandomInt(100) < dpChance) {
      // 6-4-3 / 5-4-3 double play: runner from 1st forced out at 2nd, batter out at 1st.
      log("Ground ball to the infield — double play!");
      const dpBase: [number, number, number] = [0, baseLayout[1], baseLayout[2]];
      // Clear the runner ID from 1st (they were forced out); batter is also out.
      const dpRunnerIds = [...(state.baseRunnerIds ?? [null, null, null])] as [
        string | null,
        string | null,
        string | null,
      ];
      dpRunnerIds[0] = null;
      // First out: runner from 1st forced out at 2nd (no lineup advance yet).
      const afterFirst = playerOut(
        { ...groundedState, baseLayout: dpBase, baseRunnerIds: dpRunnerIds },
        log,
      );
      // Second out: batter thrown out at 1st, at-bat is over (advance lineup).
      return playerOut(afterFirst, log, true);
    }
    log("Ground ball to the infield — fielder's choice.");
    const fcBase: [number, number, number] = [1, baseLayout[1], baseLayout[2]];
    // Lead runner (1st) is forced out; batter reaches 1st safely — place batter's ID there.
    const fcRunnerIds = [...(state.baseRunnerIds ?? [null, null, null])] as [
      string | null,
      string | null,
      string | null,
    ];
    fcRunnerIds[0] = batterId; // batter takes 1st; old runner ID (forced out) is replaced
    // Batter reaches 1st safely; at-bat complete, so advance lineup.
    return playerOut(
      { ...groundedState, baseLayout: fcBase, baseRunnerIds: fcRunnerIds },
      log,
      true,
    );
  }

  log("Ground ball to the infield — out at first.");
  return playerOut(groundedState, log, true);
};

/** Accumulate runs into the sparse inningRuns array for the current team/inning. */
export const addInningRuns = (state: State, runs: number): State => {
  if (runs === 0) return state;
  const idx = state.inning - 1;
  const newInningRuns: [number[], number[]] = [[...state.inningRuns[0]], [...state.inningRuns[1]]];
  newInningRuns[state.atBat as 0 | 1][idx] = (newInningRuns[state.atBat as 0 | 1][idx] ?? 0) + runs;
  return { ...state, inningRuns: newInningRuns };
};

/** Options for `handleFlyOut`. */
interface FlyOutOptions {
  /** Base probability (0–100) that a runner on 3rd tags up and scores. */
  sacFlyPct: number;
  /**
   * Base probability (0–100) that a runner on 2nd tags up to 3rd.
   * Defaults to 0 (disabled). Only applies when 3rd is empty after any sac fly.
   */
  tagUp2ndPct?: number;
}

/**
 * Handle a fly ball caught for an out, applying sacrifice fly and tag-up
 * opportunities for base runners before recording the batter's out.
 *
 *   - Runner on 3rd (< 2 outs): probabilistic sacrifice fly; runner speed adjusts success.
 *   - Runner on 2nd (< 2 outs, 3rd now empty): probabilistic tag-up to 3rd.
 *   - Batter: always recorded as out.
 */
const handleFlyOut = (
  state: State,
  log: (msg: string) => void,
  pitchKey: number,
  { sacFlyPct, tagUp2ndPct = 0 }: FlyOutOptions,
): State => {
  const pitchingTeam = (1 - (state.atBat as number)) as 0 | 1;
  let s = state;
  let didSacFly = false;

  // Sacrifice fly: runner on 3rd tags and scores after the catch (< 2 outs only).
  if (s.baseLayout[2] && s.outs < 2) {
    const speedMod = getSpeedMod(s, s.baseRunnerIds?.[2]);
    const effectivePct = Math.max(20, Math.min(95, sacFlyPct + Math.round(speedMod)));
    if (getRandomInt(100) < effectivePct) {
      log("Runner tags up from third — sacrifice fly! One run scores.");
      const newScore: [number, number] = [s.score[0], s.score[1]];
      newScore[s.atBat] += 1;
      const newRunnerIds = [...(s.baseRunnerIds ?? [null, null, null])] as [
        string | null,
        string | null,
        string | null,
      ];
      newRunnerIds[2] = null;
      s = addInningRuns(
        {
          ...s,
          score: newScore,
          baseLayout: [s.baseLayout[0], s.baseLayout[1], 0] as [number, number, number],
          baseRunnerIds: newRunnerIds,
        },
        1,
      );
      // Credit the run as allowed by the active pitcher.
      s = {
        ...s,
        pitcherGameLog: updateActivePitcherLog(
          s.pitcherGameLog ?? [[], []],
          pitchingTeam,
          (entry) => ({ ...entry, runsAllowed: entry.runsAllowed + 1 }),
        ),
      };
      didSacFly = true;
    }
  }

  // Tag-up from 2nd: only when 3rd is now empty and < 2 outs.
  if (tagUp2ndPct > 0 && s.baseLayout[1] && !s.baseLayout[2] && s.outs < 2) {
    const speedMod = getSpeedMod(s, s.baseRunnerIds?.[1]);
    const effectivePct = Math.max(10, Math.min(70, tagUp2ndPct + Math.round(speedMod)));
    if (getRandomInt(100) < effectivePct) {
      log("Runner tags up from second to third!");
      const newRunnerIds = [...(s.baseRunnerIds ?? [null, null, null])] as [
        string | null,
        string | null,
        string | null,
      ];
      newRunnerIds[2] = newRunnerIds[1];
      newRunnerIds[1] = null;
      s = {
        ...s,
        baseLayout: [s.baseLayout[0], 0, 1] as [number, number, number],
        baseRunnerIds: newRunnerIds,
      };
    }
  }

  // Batter is out; at-bat is complete.
  // Sacrifice fly: counts as PA but not AB; batter earns 1 RBI.
  return playerOut(
    { ...s, pitchKey, hitType: undefined },
    log,
    true,
    didSacFly ? { isSacFly: true, rbi: 1 } : {},
  );
};

/**
 * Process a confirmed hit — the batter has already been determined to reach base.
 * Handles runner advancement, run scoring, play log, and lineup rotation.
 * No pop-out check is applied here; that determination belongs to the caller.
 *
 * `base` must already have pitchKey incremented and count/decision fields cleared.
 */
const processConfirmedHit = (
  type: Hit,
  base: State,
  log: (msg: string) => void,
  strategy: Strategy = "balanced",
): State => {
  const battingTeam = base.atBat as 0 | 1;
  const pitchingTeam = (1 - (base.atBat as number)) as 0 | 1;
  const batterSlotIdx = base.batterIndex[battingTeam];
  const playerId = resolveBatterPlayerId(base, battingTeam, batterSlotIdx);

  // ── Speed-based + strategy-based runner advancement ───────────────────────
  // Apply probabilistic advancement BEFORE calling advanceRunners so that
  // runners who score early are removed from the base layout first.
  const advanceMod = stratMod(strategy, "advance");
  const currentRunnerIds =
    base.baseRunnerIds ?? ([null, null, null] as [string | null, string | null, string | null]);

  const adjustedBase: [number, number, number] = [...base.baseLayout] as [number, number, number];
  const adjustedRunnerIds: [string | null, string | null, string | null] = [
    ...currentRunnerIds,
  ] as [string | null, string | null, string | null];
  let bonusRuns = 0;

  if (type === Hit.Single) {
    // Runner on 2nd: probabilistic scoring chance (~60% base, scaled by strategy + runner speed).
    if (adjustedBase[1]) {
      const runner2ndSpeedMod = getSpeedMod(base, adjustedRunnerIds[1]);
      const scoreChance = Math.max(
        40,
        Math.min(85, Math.round(60 * advanceMod) + Math.round(runner2ndSpeedMod * 1.5)),
      );
      if (getRandomInt(100) < scoreChance) {
        adjustedBase[1] = 0;
        adjustedRunnerIds[1] = null;
        bonusRuns++;
        log("Runner on second scores!");
      }
    }
  } else if (type === Hit.Double) {
    // Runner on 1st: probabilistic scoring chance (~30% base, scaled by strategy + runner speed).
    // (advanceRunners places runner from 1st on 3rd for a double by default.)
    if (adjustedBase[0]) {
      const runner1stSpeedMod = getSpeedMod(base, adjustedRunnerIds[0]);
      const scoreChance = Math.max(
        15,
        Math.min(55, Math.round(30 * advanceMod) + Math.round(runner1stSpeedMod * 1.5)),
      );
      if (getRandomInt(100) < scoreChance) {
        adjustedBase[0] = 0;
        adjustedRunnerIds[0] = null;
        bonusRuns++;
        log("Runner scores from first on the double!");
      }
    }
  }
  // ── End speed-based + strategy pre-processing ─────────────────────────────

  const { newBase, runsScored, newRunnerIds } = advanceRunners(
    type,
    adjustedBase,
    adjustedRunnerIds,
  );
  const totalRuns = runsScored + bonusRuns;
  const newScore: [number, number] = [base.score[0], base.score[1]];
  newScore[base.atBat] += totalRuns;

  if (runsScored > 0) {
    log(runsScored === 1 ? "One run scores!" : `${runsScored} runs score!`);
  }

  // Runner from 1st: sometimes stretches to 3rd on a single (if 3rd is empty after advance).
  const finalBase: [number, number, number] = [...newBase] as [number, number, number];
  const finalRunnerIds: [string | null, string | null, string | null] = [...newRunnerIds] as [
    string | null,
    string | null,
    string | null,
  ];

  if (type === Hit.Single && base.baseLayout[0]) {
    // Original runner was on 1st; they are now on 2nd (newBase[1]).
    // Use post-advance state for the 3rd-base check: if 3rd is now empty the
    // runner can stretch (e.g. a runner who was on 3rd may have scored on the play,
    // opening up the bag — the pre-advance !base.baseLayout[2] guard was too strict).
    if (finalBase[1] && !finalBase[2]) {
      const runner1stSpeedMod = getSpeedMod(base, currentRunnerIds[0]);
      const stretchChance = Math.max(
        10,
        Math.min(45, Math.round(28 * advanceMod) + Math.round(runner1stSpeedMod * 1.5)),
      );
      if (getRandomInt(100) < stretchChance) {
        finalBase[2] = 1;
        finalBase[1] = 0;
        finalRunnerIds[2] = finalRunnerIds[1];
        finalRunnerIds[1] = null;
        log("Runner stretches to third!");
      }
    }
  }

  // Place batter on their destination base.
  const batterBase =
    type === Hit.Single || type === Hit.Walk || type === Hit.HitByPitch
      ? 0
      : type === Hit.Double
        ? 1
        : type === Hit.Triple
          ? 2
          : null; // HR: batter scores, no base

  if (batterBase !== null) {
    finalRunnerIds[batterBase] = playerId;
  }

  // Record this at-bat in the play log (batter reached base).
  const batterNum = batterSlotIdx + 1;
  const overrideNickname = base.playerOverrides[battingTeam]?.[playerId]?.nickname?.trim();
  const batterName: string | undefined =
    (overrideNickname && overrideNickname.length > 0 ? overrideNickname : undefined) ??
    generateRoster(base.teams[battingTeam]).batters.find((p) => p.id === playerId)?.name;
  const playEntry: PlayLogEntry = {
    inning: base.inning,
    half: battingTeam,
    batterNum,
    playerId,
    ...(batterName ? { batterName } : {}),
    team: battingTeam,
    event: type,
    runs: totalRuns,
    rbi: totalRuns,
  };

  // Update pitcher log: increment hits/walks/homers/runs/battersFaced for pitching team.
  const isWalk = type === Hit.Walk || type === Hit.HitByPitch;
  const isHomer = type === Hit.Homerun;
  const pitcherLogAfterHit = updateActivePitcherLog(
    base.pitcherGameLog ?? [[], []],
    pitchingTeam,
    (entry) => ({
      ...entry,
      hitsAllowed: entry.hitsAllowed + (isWalk ? 0 : 1),
      walksAllowed: entry.walksAllowed + (isWalk ? 1 : 0),
      homersAllowed: entry.homersAllowed + (isHomer ? 1 : 0),
      runsAllowed: entry.runsAllowed + totalRuns,
      battersFaced: entry.battersFaced + 1,
    }),
  );

  const withRuns = addInningRuns(
    {
      ...base,
      baseLayout: finalBase,
      score: newScore,
      hitType: type,
      baseRunnerIds: finalRunnerIds,
      pitcherGameLog: pitcherLogAfterHit,
    },
    totalRuns,
  );

  // Increment pitcher fatigue: batter reached base (hit or walk) — at-bat complete.
  const withFatigue = incrementPitcherFatigue(withRuns);

  // nextBatter: batter reached base, rotate lineup to next batter.
  return nextBatter({
    ...withFatigue,
    playLog: [...base.playLog, playEntry],
  });
};

/** Options for `handleBallInPlay`. */
export interface HandleBallInPlayOptions {
  /** Batter's active strategy. Defaults to `"balanced"`. */
  strategy?: Strategy;
}

/**
 * Process a ball put in play from a batted-ball type.
 *
 * This is the authoritative contact-resolution path.  It receives the
 * batted-ball type already determined by `resolveBattedBallType()` in
 * `pitchSimulation.ts` and maps it to a final ball-in-play result:
 *
 *   pop_up        → always out (pop-up, runners hold under infield fly rule)
 *   weak_grounder → 65% ground out (FC / DP if runner on 1st), 35% infield single
 *   hard_grounder → 50% ground out (FC / DP if runner on 1st), 50% single through infield
 *   line_drive    → 20% liner caught (sac fly eligible), 80% hit (Single → HR spread)
 *   medium_fly    → 70% fly out (sac fly + tag-up eligible), 30% hit (Single or Double)
 *   deep_fly      → 35% warning-track out (sac fly + tag-up eligible), 65% hit (Double → HR)
 */
export const handleBallInPlay = (
  battedBallType: BattedBallType,
  state: State,
  log: (msg: string) => void,
  { strategy = "balanced" }: HandleBallInPlayOptions = {},
): State => {
  const pitchKey = (state.pitchKey ?? 0) + 1;
  const base = {
    ...state,
    balls: 0,
    strikes: 0,
    pendingDecision: null as DecisionType | null,
    onePitchModifier: null as OnePitchModifier,
    pinchHitterStrategy: null as Strategy | null,
    pitchKey,
  };

  // Pop-up: batter is out; runners hold (infield fly rule — no sac fly or tag-up).
  if (battedBallType === "pop_up") {
    log("Popped it up — that's an out.");
    return playerOut({ ...state, pitchKey, hitType: undefined }, log, true);
  }

  // One random roll (0–999) determines the ball-in-play result for all other types.
  const roll = getRandomInt(1000);

  // Defensive shift raises the ground-out threshold for grounders (shifted infield covers more).
  const shiftBoost = (state.defensiveShift ?? false) ? 100 : 0;

  // HR threshold for deep_fly shifts with strategy via stratMod(strategy, "homerun"):
  //   power  (1.6) → shift = -(0.6 * 50) = -30 → hrThreshold = 740  (more HRs)
  //   contact (0.7) → shift = +(0.3 * 50) = +15 → hrThreshold = 785  (fewer HRs)
  //   balanced (1.0) → shift = 0 → hrThreshold = 770  (default)
  const hrThreshold = Math.max(
    720,
    Math.min(820, 770 - Math.round((stratMod(strategy, "homerun") - 1.0) * 50)),
  );

  switch (battedBallType) {
    case "weak_grounder":
      // 65% ground out (may produce FC or DP if runner on 1st); +10% with defensive shift.
      if (roll < 650 + shiftBoost) return handleGrounder(state, log, pitchKey);
      log("Tapper sneaks through — infield single!");
      return processConfirmedHit(Hit.Single, base, log, strategy);

    case "hard_grounder":
      // 50% ground out (may produce FC or DP if runner on 1st); +10% with defensive shift.
      if (roll < 500 + shiftBoost) return handleGrounder(state, log, pitchKey);
      log("Sharp grounder finds a hole — single!");
      return processConfirmedHit(Hit.Single, base, log, strategy);

    case "line_drive":
      // 20% liner caught (sac fly: 40%, tag-up from 2nd: 10%); 80% hit spread.
      if (roll < 200) {
        log("Line drive — snagged for the out!");
        return handleFlyOut(state, log, pitchKey, { sacFlyPct: 40, tagUp2ndPct: 10 });
      }
      if (roll < 650) {
        log(HIT_CALLOUTS[Hit.Single]);
        return processConfirmedHit(Hit.Single, base, log, strategy);
      }
      if (roll < 850) {
        log(HIT_CALLOUTS[Hit.Double]);
        return processConfirmedHit(Hit.Double, base, log, strategy);
      }
      if (roll < 930) {
        log(HIT_CALLOUTS[Hit.Triple]);
        return processConfirmedHit(Hit.Triple, base, log, strategy);
      }
      log(HIT_CALLOUTS[Hit.Homerun]);
      return processConfirmedHit(Hit.Homerun, base, log, strategy);

    case "medium_fly":
      // 70% fly out (sac fly: 65%, tag-up from 2nd: 20%); 30% hit: Single (18%), Double (12%).
      if (roll < 700) {
        log("Fly ball — caught for the out.");
        return handleFlyOut(state, log, pitchKey, { sacFlyPct: 65, tagUp2ndPct: 20 });
      }
      if (roll < 880) {
        log(HIT_CALLOUTS[Hit.Single]);
        return processConfirmedHit(Hit.Single, base, log, strategy);
      }
      log(HIT_CALLOUTS[Hit.Double]);
      return processConfirmedHit(Hit.Double, base, log, strategy);

    case "deep_fly":
      // 35% warning-track out (sac fly: 80%, tag-up from 2nd: 35%); 65% hit spread.
      // HR threshold shifts by strategy: power → more HRs; contact → fewer HRs.
      if (roll < 350) {
        log("Long fly ball — hauled in at the warning track.");
        return handleFlyOut(state, log, pitchKey, { sacFlyPct: 80, tagUp2ndPct: 35 });
      }
      if (roll < 650) {
        log(HIT_CALLOUTS[Hit.Double]);
        return processConfirmedHit(Hit.Double, base, log, strategy);
      }
      if (roll < hrThreshold) {
        log(HIT_CALLOUTS[Hit.Triple]);
        return processConfirmedHit(Hit.Triple, base, log, strategy);
      }
      log(HIT_CALLOUTS[Hit.Homerun]);
      return processConfirmedHit(Hit.Homerun, base, log, strategy);
  }
};

/**
 * Process a direct-outcome hit (walks, bunt singles, intentional walks).
 *
 * Still applies a pop-out filter for non-HR, non-Walk types so that bunt
 * singles can be popped up (realistic: a bunt that pops up is an out).
 * For the contact-path from usePitchDispatch, use `handleBallInPlay` instead.
 */
export const hitBall = (
  type: Hit,
  state: State,
  log: (msg: string) => void,
  strategy: Strategy = "balanced",
): State => {
  const pitchKey = (state.pitchKey ?? 0) + 1;
  const base = {
    ...state,
    balls: 0,
    strikes: 0,
    pendingDecision: null as DecisionType | null,
    onePitchModifier: null as OnePitchModifier,
    pinchHitterStrategy: null as Strategy | null,
    pitchKey,
  };
  const randomNumber = getRandomInt(1000);

  // Batter overrides
  const battingTeam = state.atBat as 0 | 1;
  const batterSlotIdx = state.batterIndex[battingTeam];
  const playerId = resolveBatterPlayerId(state, battingTeam, batterSlotIdx);
  const batterMods = playerId
    ? (state.resolvedMods?.[battingTeam]?.[playerId] ?? ZERO_MODS)
    : ZERO_MODS;

  // Pitcher overrides
  const pitchingTeam = (1 - (state.atBat as number)) as 0 | 1;
  const activePitcherId =
    state.rosterPitchers[pitchingTeam]?.[state.activePitcherIdx[pitchingTeam]];
  const pitcherMods = activePitcherId
    ? (state.resolvedMods?.[pitchingTeam]?.[activePitcherId] ?? ZERO_MODS)
    : ZERO_MODS;

  // Pitcher fatigue: more pitches thrown → higher factor → easier to get hits.
  const pitcherBattersFaced = (state.pitcherBattersFaced ?? [0, 0])[pitchingTeam];
  const pitcherPitchCount = (state.pitcherPitchCount ?? [0, 0])[pitchingTeam];
  const fatigueFactor = computeFatigueFactor(
    pitcherPitchCount,
    pitcherBattersFaced,
    pitcherMods.staminaMod,
  );

  // contactMod: higher contact = higher threshold (easier to get hits)
  // movementMod: higher movement = lower threshold (harder to hit clean)
  // velocityMod: higher velocity = slightly lower threshold (harder to make solid contact)
  // fatigueFactor > 1: tired pitcher → higher threshold → easier to hit (more balls in play)
  const contactFactor = 1 + batterMods.contactMod / 100;
  const pitchingFactor = 1 - (pitcherMods.movementMod + pitcherMods.velocityMod / 2) / 100;
  const popOutThreshold = Math.round(
    750 *
      stratMod(strategy, "contact") *
      (state.defensiveShift ? 0.85 : 1) *
      contactFactor *
      Math.max(0.5, pitchingFactor) *
      fatigueFactor,
  );

  if (
    randomNumber >= popOutThreshold &&
    type !== Hit.Homerun &&
    type !== Hit.Walk &&
    type !== Hit.HitByPitch
  ) {
    const powerBonus = Math.round(15 * (1 + batterMods.powerMod / 100));
    if (strategy === "power" && getRandomInt(100) < powerBonus) {
      type = Hit.Homerun;
      log("Power hitter turns it around — Home Run!");
    } else if (getRandomInt(100) < 40) {
      // ~40% of non-HR outs are ground balls; rest are fly balls / pop-ups.
      return handleGrounder(state, log, pitchKey);
    } else {
      log("Popped it up — that's an out.");
      // batterCompleted=true: the batter's at-bat ended with a pop-out.
      return playerOut({ ...state, pitchKey, hitType: undefined }, log, true);
    }
  }

  if (HIT_CALLOUTS[type]) log(HIT_CALLOUTS[type]);
  return processConfirmedHit(type, base, log, strategy);
};
