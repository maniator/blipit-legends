/**
 * Custom-team metrics harness — equivalent to the browser 100-game run.
 *
 * Loads the canonical `e2e/fixtures/metrics-teams.json` fixture, sets up each
 * matchup exactly as the browser metrics spec does (same MATCHUP_BLOCKS, same
 * seed strings), and runs the full reducer + AI pipeline in-process.
 *
 * This is the deterministic in-process equivalent of metrics-baseline.spec.ts.
 */
import { customTeamToPlayerOverrides } from "@feat/customTeams/adapters/customTeamAdapter";
import { selectPitchType } from "@feat/gameplay/constants/pitchTypes";
import {
  makeAiPitchingDecision,
  makeAiStrategyDecision,
  makeAiTacticalDecision,
} from "@feat/gameplay/context/aiManager";
import type { GameAction, LogAction, State } from "@feat/gameplay/context/index";
import { createFreshGameState } from "@feat/gameplay/context/initialState";
import {
  computeFatigueFactor,
  computeSwingRate,
  resolveBattedBallType,
  resolveSwingOutcome,
} from "@feat/gameplay/context/pitchSimulation";
import reducerFactory, { detectDecision } from "@feat/gameplay/context/reducer";
import { ZERO_MODS } from "@feat/gameplay/context/resolvePlayerMods";
import getRandomInt from "@feat/gameplay/utils/getRandomInt";
import { Hit } from "@shared/constants/hitTypes";
import { restoreRng } from "@shared/utils/rng";
import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

import type { TeamWithRoster } from "@storage/types";

// ── Fixture loading ────────────────────────────────────────────────────────

type TeamPlayer = {
  id: string;
  name: string;
  role: string;
  position?: string;
  pitchingRole?: string;
  batting: { contact: number; power: number; speed: number };
  pitching?: { velocity: number; control: number; movement: number };
};

type FixtureTeam = {
  id: string;
  name: string;
  roster: { lineup: TeamPlayer[]; bench: TeamPlayer[]; pitchers: TeamPlayer[] };
};

const FIXTURE_PATH = join(process.cwd(), "e2e/fixtures/metrics-teams.json");
const fixtureRaw = JSON.parse(readFileSync(FIXTURE_PATH, "utf-8")) as {
  payload: { teams: FixtureTeam[] };
};
const FIXTURE_TEAMS: FixtureTeam[] = fixtureRaw.payload.teams;

// ── Matchup blocks — exact mirror of metrics-baseline.spec.ts ─────────────

const MATCHUP_BLOCKS = [
  { away: "Charlotte Bears", home: "Denver Raiders", seedPrefix: "s1" },
  { away: "Denver Raiders", home: "Charlotte Bears", seedPrefix: "s2" },
  { away: "San Antonio Giants", home: "Portland Foxes", seedPrefix: "s3" },
  { away: "Portland Foxes", home: "Nashville Comets", seedPrefix: "s4" },
  { away: "Nashville Comets", home: "San Antonio Giants", seedPrefix: "s5" },
  { away: "Charlotte Bears", home: "San Antonio Giants", seedPrefix: "s6" },
  { away: "Denver Raiders", home: "Portland Foxes", seedPrefix: "s7" },
  { away: "San Antonio Giants", home: "Nashville Comets", seedPrefix: "s8" },
  { away: "Portland Foxes", home: "Charlotte Bears", seedPrefix: "s9" },
  { away: "Nashville Comets", home: "Denver Raiders", seedPrefix: "s10" },
] as const;

const GAMES_PER_BLOCK = 10;

// ── Seed conversion (mirrors browser reinitSeed → parseSeed exactly) ──────
// The browser's `parseSeed` detects letters and uses base-36:
//   const radix = /[a-z]/i.test(trimmed) ? 36 : 10;
//   return parseInt(trimmed, radix) >>> 0;
// This is the exact same conversion so individual game outcomes are identical
// at the RNG level — though extra random() calls in the browser UI (React
// re-renders, audio, animation) can still cause divergence after game start.

function seedStrToNumber(s: string): number {
  const trimmed = s.trim();
  if (!trimmed) return 0;
  const radix = /[a-z]/i.test(trimmed) ? 36 : 10;
  return parseInt(trimmed, radix) >>> 0;
}

// ── Single-game runner ─────────────────────────────────────────────────────

interface GameResult {
  ab: number;
  bb: number;
  k: number;
  h: number;
  runs: number;
  pitchingChanges: number;
}

function runGame(awayTeam: FixtureTeam, homeTeam: FixtureTeam, seedStr: string): GameResult {
  restoreRng(seedStrToNumber(seedStr));

  const logs: string[] = [];
  const dispatchLog = (action: LogAction) => {
    if (action.type === "log" && action.payload) logs.push(action.payload);
  };

  const gameReducer = reducerFactory(dispatchLog);
  let state: State = createFreshGameState([awayTeam.id, homeTeam.id]);

  const dispatch = (action: GameAction): void => {
    state = gameReducer(state, action);
  };

  // Set up teams with full custom overrides — mirrors useExhibitionSetup dispatch
  dispatch({
    type: "setTeams",
    payload: {
      teams: [awayTeam.id, homeTeam.id],
      teamLabels: [awayTeam.name, homeTeam.name],
      playerOverrides: [
        customTeamToPlayerOverrides(awayTeam as unknown as TeamWithRoster),
        customTeamToPlayerOverrides(homeTeam as unknown as TeamWithRoster),
      ] as [Record<string, Record<string, number>>, Record<string, Record<string, number>>],
      lineupOrder: [
        awayTeam.roster.lineup.map((p) => p.id),
        homeTeam.roster.lineup.map((p) => p.id),
      ],
      rosterBench: [awayTeam.roster.bench.map((p) => p.id), homeTeam.roster.bench.map((p) => p.id)],
      rosterPitchers: [
        awayTeam.roster.pitchers.map((p) => p.id),
        homeTeam.roster.pitchers.map((p) => p.id),
      ],
    },
  });

  // Build pitcher roles for AI from fixture `pitchingRole` (SP/RP/SP/RP per pitcher)
  const pitcherRoles: [Record<string, string>, Record<string, string>] = [
    awayTeam.roster.pitchers.reduce<Record<string, string>>((acc, pitcher) => {
      if (pitcher.pitchingRole) acc[pitcher.id] = pitcher.pitchingRole;
      return acc;
    }, {}),
    homeTeam.roster.pitchers.reduce<Record<string, string>>((acc, pitcher) => {
      if (pitcher.pitchingRole) acc[pitcher.id] = pitcher.pitchingRole;
      return acc;
    }, {}),
  ];

  let maxTicks = 50000;
  let pitchingChanges = 0;

  while (!state.gameOver) {
    if (maxTicks-- <= 0) {
      throw new Error("customTeamMetrics harness exceeded maxTicks without reaching gameOver");
    }
    const pitchingTeamIdx = (1 - state.atBat) as 0 | 1;

    if (state.balls === 0 && state.strikes === 0) {
      const aiPitchDecision = makeAiPitchingDecision(
        state,
        pitchingTeamIdx,
        pitcherRoles[pitchingTeamIdx],
      );
      if (aiPitchDecision.kind === "pitching_change") {
        pitchingChanges++;
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
      const battingDecision = detectDecision(state, aiStrategy, true);
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

  let bb = 0;
  let h = 0;
  for (const entry of state.playLog) {
    if (entry.event === Hit.Walk || entry.event === Hit.HitByPitch) bb++;
    else if ([Hit.Single, Hit.Double, Hit.Triple, Hit.Homerun].includes(entry.event as Hit)) h++;
  }
  const k = state.strikeoutLog.length;
  const ab = h + state.outLog.length;

  return { ab, bb, k, h, runs: state.score[0] + state.score[1], pitchingChanges };
}

// ── Test ───────────────────────────────────────────────────────────────────

describe("Custom-team metrics harness — 100 games (metrics-teams.json fixture)", () => {
  it("runs 100 games with canonical fixture teams and reports aggregate metrics", () => {
    // Build team lookup by name
    const teamByName = new Map(FIXTURE_TEAMS.map((t) => [t.name, t]));

    // Build full game list (same as metrics-baseline.spec.ts)
    const games: Array<{ away: FixtureTeam; home: FixtureTeam; seed: string }> = [];
    for (const block of MATCHUP_BLOCKS) {
      for (let g = 1; g <= GAMES_PER_BLOCK; g++) {
        const away = teamByName.get(block.away)!;
        const home = teamByName.get(block.home)!;
        games.push({ away, home, seed: `${block.seedPrefix}g${g}` });
      }
    }

    let totalAB = 0,
      totalBB = 0,
      totalK = 0,
      totalH = 0,
      totalRuns = 0,
      totalPitchingChanges = 0;
    const perGameRuns: number[] = [];

    for (let i = 0; i < games.length; i++) {
      const { away, home, seed } = games[i];
      const result = runGame(away, home, seed);
      totalAB += result.ab;
      totalBB += result.bb;
      totalK += result.k;
      totalH += result.h;
      totalRuns += result.runs;
      totalPitchingChanges += result.pitchingChanges;
      perGameRuns.push(result.runs);

      if ((i + 1) % 10 === 0) {
        const pa = totalAB + totalBB;
        const bbPctNow = pa > 0 ? ((totalBB / pa) * 100).toFixed(1) : "?";
        console.log(`  [${i + 1}/100] ${away.name} @ ${home.name} seed=${seed} BB%=${bbPctNow}%`);
      }
    }

    const totalPA = totalAB + totalBB;
    const bbPct = (totalBB / totalPA) * 100;
    const kPct = (totalK / totalPA) * 100;
    const hPerPA = totalH / totalPA;
    const runsPerGame = totalRuns / games.length;
    const bbPerGame = totalBB / games.length;
    const avgPitchingChanges = totalPitchingChanges / games.length;

    const sortedRuns = [...perGameRuns].sort((a, b) => a - b);
    const medianRuns = sortedRuns[Math.floor(sortedRuns.length / 2)];

    console.log("\n");
    console.log("╔══════════════════════════════════════════════════════╗");
    console.log("║  CUSTOM-TEAM METRICS HARNESS (in-process)            ║");
    console.log("╠══════════════════════════════════════════════════════╣");
    console.log(`║  Games:             100 (10 matchups × 10 seeds)     ║`);
    console.log(`║  Teams:             metrics-teams.json fixture        ║`);
    console.log("╠══════════════════════════════════════════════════════╣");
    console.log(`║  Total PA:          ${String(totalPA).padEnd(33)}║`);
    console.log(
      `║  BB%:               ${bbPct.toFixed(2)}%${" ".repeat(32 - bbPct.toFixed(2).length)}║`,
    );
    console.log(
      `║  K%:                ${kPct.toFixed(2)}%${" ".repeat(32 - kPct.toFixed(2).length)}║`,
    );
    console.log(
      `║  H/PA:              ${hPerPA.toFixed(3)}${" ".repeat(34 - hPerPA.toFixed(3).length)}║`,
    );
    console.log(
      `║  BB/game:           ${bbPerGame.toFixed(1)}${" ".repeat(34 - bbPerGame.toFixed(1).length)}║`,
    );
    console.log(
      `║  Runs/game (mean):  ${runsPerGame.toFixed(1)}${" ".repeat(34 - runsPerGame.toFixed(1).length)}║`,
    );
    console.log(`║  Runs/game (median):${String(medianRuns).padEnd(35)}║`);
    console.log(`║  Total BB:          ${String(totalBB).padEnd(33)}║`);
    console.log(`║  Total K:           ${String(totalK).padEnd(33)}║`);
    console.log(`║  Total H:           ${String(totalH).padEnd(33)}║`);
    console.log(
      `║  Pitching changes:  ${avgPitchingChanges.toFixed(1)}/game${" ".repeat(29 - avgPitchingChanges.toFixed(1).length)}║`,
    );
    console.log("╚══════════════════════════════════════════════════════╝");

    // Sanity bounds only — do not gate on specific tuning targets
    expect(games.length).toBe(100);
    expect(totalBB).toBeGreaterThan(0);
    expect(totalK).toBeGreaterThan(0);
    expect(totalRuns).toBeGreaterThan(0);
  }, 120_000);
});
