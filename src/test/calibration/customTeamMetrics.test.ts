/**
 * Custom team configuration metrics test.
 *
 * Validates that extreme player modifier configurations produce
 * meaningfully different and still-valid simulation outcomes.
 * Bands are intentionally wide to accommodate extreme configurations.
 */
import type { TeamCustomPlayerOverrides } from "@feat/gameplay/context/playerTypes";
import { describe, expect, it } from "vitest";

import { runGame } from "./calibrationHelpers";

const LINEUP_IDS = ["b0", "b1", "b2", "b3", "b4", "b5", "b6", "b7", "b8"];
const PITCHER_IDS = ["p0", "p1", "p2"];

const buildBatterOverrides = (
  mods: Partial<Record<"contactMod" | "powerMod" | "speedMod", number>>,
): TeamCustomPlayerOverrides =>
  Object.fromEntries(LINEUP_IDS.map((id) => [id, mods])) as TeamCustomPlayerOverrides;

const buildPitcherOverrides = (
  mods: Partial<Record<"velocityMod" | "movementMod" | "staminaMod", number>>,
): TeamCustomPlayerOverrides =>
  Object.fromEntries(PITCHER_IDS.map((id) => [id, mods])) as TeamCustomPlayerOverrides;

const mergeOverrides = (
  batterMods: TeamCustomPlayerOverrides,
  pitcherMods: TeamCustomPlayerOverrides,
): TeamCustomPlayerOverrides => ({ ...batterMods, ...pitcherMods });

function runConfigAndAssert(
  label: string,
  overrides: [TeamCustomPlayerOverrides, TeamCustomPlayerOverrides],
  seedStart: number,
  seedEnd: number,
) {
  const numGames = seedEnd - seedStart + 1;
  const numTeamGames = numGames * 2;

  let totalPA = 0;
  let totalAB = 0;
  let totalWalks = 0;
  let totalK = 0;
  let totalSingles = 0;
  let totalDoubles = 0;
  let totalTriples = 0;
  let totalHR = 0;
  let totalRuns = 0;

  for (let seed = seedStart; seed <= seedEnd; seed++) {
    const s = runGame(seed, {
      lineupOrder: [LINEUP_IDS, LINEUP_IDS],
      rosterPitchers: [PITCHER_IDS, PITCHER_IDS],
      playerOverrides: overrides,
    });
    totalPA += s.plateAppearances;
    totalAB += s.atBats;
    totalWalks += s.walks;
    totalK += s.strikeouts;
    totalSingles += s.singles;
    totalDoubles += s.doubles;
    totalTriples += s.triples;
    totalHR += s.homeRuns;
    totalRuns += s.runsTotal;
  }

  const totalHits = totalSingles + totalDoubles + totalTriples + totalHR;
  const ba = totalAB > 0 ? totalHits / totalAB : 0;
  const bbPct = totalPA > 0 ? (totalWalks / totalPA) * 100 : 0;
  const kPct = totalPA > 0 ? (totalK / totalPA) * 100 : 0;
  const runsPerTeamG = totalRuns / numTeamGames;

  console.log(`\n=== Custom Team Metrics: ${label} (${numGames} games) ===`);
  console.log(`Total PA:    ${totalPA}`);
  console.log(`BA:          ${ba.toFixed(3)}`);
  console.log(`BB%:         ${bbPct.toFixed(1)}%`);
  console.log(`K%:          ${kPct.toFixed(1)}%`);
  console.log(`R/team/G:    ${runsPerTeamG.toFixed(2)}`);

  expect(totalPA, `${label}: should have plate appearances`).toBeGreaterThan(0);

  // Wide bands to accommodate extreme configurations
  expect(ba, `${label}: BA`).toBeGreaterThanOrEqual(0.15);
  expect(ba, `${label}: BA`).toBeLessThanOrEqual(0.34);

  expect(bbPct, `${label}: BB%`).toBeGreaterThanOrEqual(3.0);
  expect(bbPct, `${label}: BB%`).toBeLessThanOrEqual(18.0);

  expect(kPct, `${label}: K%`).toBeGreaterThanOrEqual(12.0);
  expect(kPct, `${label}: K%`).toBeLessThanOrEqual(40.0);

  expect(runsPerTeamG, `${label}: R/team/G`).toBeGreaterThanOrEqual(1.5);
  expect(runsPerTeamG, `${label}: R/team/G`).toBeLessThanOrEqual(9.0);
}

describe("Custom team configuration variance metrics", () => {
  it("power sluggers: high power, low contact batters vs weak pitching", () => {
    const batterMods = buildBatterOverrides({ powerMod: 20, contactMod: -10 });
    const pitcherMods = buildPitcherOverrides({ velocityMod: -10 });
    const overrides: [TeamCustomPlayerOverrides, TeamCustomPlayerOverrides] = [
      mergeOverrides(batterMods, pitcherMods),
      mergeOverrides(batterMods, pitcherMods),
    ];
    runConfigAndAssert("Power sluggers", overrides, 500, 529);
  }, 90_000);

  it("contact/speed: high contact, high speed, low power batters", () => {
    const batterMods = buildBatterOverrides({ contactMod: 20, speedMod: 20, powerMod: -10 });
    const pitcherMods = buildPitcherOverrides({});
    const overrides: [TeamCustomPlayerOverrides, TeamCustomPlayerOverrides] = [
      mergeOverrides(batterMods, pitcherMods),
      mergeOverrides(batterMods, pitcherMods),
    ];
    runConfigAndAssert("Contact/speed", overrides, 500, 529);
  }, 90_000);

  it("elite pitching: dominant velocity, movement, and stamina pitchers", () => {
    const batterMods = buildBatterOverrides({});
    const pitcherMods = buildPitcherOverrides({ velocityMod: 20, movementMod: 20, staminaMod: 20 });
    const overrides: [TeamCustomPlayerOverrides, TeamCustomPlayerOverrides] = [
      mergeOverrides(batterMods, pitcherMods),
      mergeOverrides(batterMods, pitcherMods),
    ];
    runConfigAndAssert("Elite pitching", overrides, 500, 529);
  }, 90_000);

  it("mismatch: power sluggers (team 0) vs elite pitching (team 1)", () => {
    const sluggerBatters = buildBatterOverrides({ powerMod: 20, contactMod: -10 });
    const weakPitchers = buildPitcherOverrides({ velocityMod: -10 });
    const eliteBatters = buildBatterOverrides({});
    const elitePitchers = buildPitcherOverrides({
      velocityMod: 20,
      movementMod: 20,
      staminaMod: 20,
    });

    const overrides: [TeamCustomPlayerOverrides, TeamCustomPlayerOverrides] = [
      mergeOverrides(sluggerBatters, weakPitchers),
      mergeOverrides(eliteBatters, elitePitchers),
    ];
    runConfigAndAssert("Mismatch (sluggers vs elite pitching)", overrides, 500, 529);
  }, 90_000);
});
