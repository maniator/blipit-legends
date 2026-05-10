/**
 * Gameplay headless sim seam — Phase 2 v1 stub.
 *
 * This file is the sanctioned boundary between @feat/league/sim and the gameplay
 * engine internals. League sim code MUST import from here, never directly from
 * @feat/gameplay/context/*.
 *
 * v1: Returns a deterministic stub result driven by the already-reinit'd PRNG
 * (random() calls here consume from the same seed as the game would). The real
 * reducer integration ships in Phase 4.
 *
 * Why: the global mulberry32 PRNG in @shared/utils/rng is already reinitSeed()'d
 * by the caller (headlessSim step 5) before this function is called. Any calls to
 * random() here are deterministic from that seed — same seed = same scores.
 */
import { random } from "@shared/utils/rng";

export interface HeadlessGameResult {
  homeScore: number;
  awayScore: number;
  /** Epoch ms when the sim completed. */
  completedAt: number;
  /**
   * Minimal boxscore record stored on seasonGames.boxscore.
   * Shape is intentionally open (Record<string, unknown>) so Phase 4 can
   * enrich it without a schema migration.
   */
  boxscore: Record<string, unknown>;
}

/**
 * Runs a headless game sim and returns the result.
 *
 * PRE-CONDITION: `reinitSeed(derivedSeed)` has already been called by the
 * caller (runHeadlessGame step 5). This function must be called immediately
 * after — no async awaits, no other random() consumers, between reinitSeed
 * and this call.
 *
 * v1 stub: generates scores using random(). Phase 4 will replace this body
 * with the full reducer loop (see docs/league-mode/schedule-and-sim.md §Modes).
 */
export function runHeadlessGameSim(): HeadlessGameResult {
  // Each score is a bimodal sample: most games score 0–9 runs.
  // Two random() calls per team, matching the PRNG consumption a real game would use
  // at a high level so the call count is predictable for testing.
  const homeScore = Math.floor(random() * 10);
  const awayScore = Math.floor(random() * 10);

  const completedAt = Date.now();
  return {
    homeScore,
    awayScore,
    completedAt,
    boxscore: { homeScore, awayScore, stub: true },
  };
}
