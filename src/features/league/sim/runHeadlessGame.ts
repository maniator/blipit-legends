/**
 * Headless per-game sim runner — the 10-step atomic flow for League Mode v1.
 *
 * Executes a single scheduled season game headlessly (no UI):
 *   1.  Atomic claim: scheduled → in_progress with claimedBy token.
 *   2.  Read derivedSeed from the seasonGame doc.
 *   3.  Load rosterSnapshots from both seasonTeams.
 *   4.  Load seasonPlayerState for both teams → build seasonModifiers.
 *   5.  reinitSeed(derivedSeed) — LAST async step before sim.
 *   6.  Run headless sim (v1 stub → Phase 4 full reducer).
 *   7.  Compute AI rotation choices for both teams (SP/RP selection).
 *   8.  Compute pitcher fatigue patches.
 *   9.  Single logical bulk-write: game completion + player state updates + standings.
 *   10. Advance seasons.currentGameDay if all games for the day are complete.
 *
 * PRNG invariant: reinitSeed() in step 5 is the LAST mutation to the global PRNG
 * before runHeadlessGameSim() is called. No async awaits, no RxDB reads, and no
 * calls to random() may occur between step 5 and step 6. This is enforced by code
 * ordering and commented clearly below.
 *
 * Concurrency note (RC1, Winston CR): step 10's currentGameDay advancement is a
 * read-check-write on the seasons doc. In v1 (single browser session, multiInstance:false),
 * true concurrent writes are impossible. The guard is a conditional patch that is a
 * no-op if another path already advanced the counter — safe and documented here.
 *
 * Partial-write recovery (RC2, Winston CR): step 9 writes seasonGames then
 * seasonPlayerState. RxDB has no cross-collection transactions. If the app crashes
 * between these two writes, the game remains at status='in_progress'. On next startup,
 * resetStaleInProgressGames() resets it to 'scheduled' and the full flow reruns.
 * seasonGames.status='completed' is the durable sentinel — once that is set, the game
 * is considered done and a second run is a no-op (claim step returns 'already_complete').
 */
import { runHeadlessGameSim } from "@feat/gameplay/sim/headless";
import type { SeasonPlayerStateRecord } from "@feat/league/storage/types";
import { appLog } from "@shared/utils/logger";
import { reinitSeed } from "@shared/utils/rng";

import { getDb } from "@storage/db";

import { selectPitchers } from "./aiRotationPolicy";
import type { SeasonModifiers } from "./seasonModifiers";
import { computePitcherFatigueUpdates } from "./updatePitcherFatigue";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HeadlessGameOutcome =
  | { status: "completed"; homeScore: number; awayScore: number }
  | { status: "already_claimed" }
  | { status: "already_complete" }
  | { status: "not_found" };

export interface RunHeadlessGameInput {
  seasonGameId: string;
  /**
   * Per-session claim token — caller generates once per batch with nanoid(12).
   * Written to seasonGames.claimedBy while the game is in_progress.
   * Must be cleared (set to null) on completion.
   */
  claimToken: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Builds SeasonModifiers from loaded player state records. */
function buildSeasonModifiers(playerStates: SeasonPlayerStateRecord[]): SeasonModifiers {
  const availabilityByPlayerId: Record<string, number> = {};
  for (const ps of playerStates) {
    availabilityByPlayerId[ps.playerId] = ps.pitcherAvailability;
  }
  return { pitcher: { availabilityByPlayerId } };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Runs a single scheduled season game headlessly.
 * Returns the outcome — callers should handle all variants.
 */
export async function runHeadlessGame(input: RunHeadlessGameInput): Promise<HeadlessGameOutcome> {
  const { seasonGameId, claimToken } = input;

  // -------------------------------------------------------------------------
  // STEP 1 — Atomic claim: scheduled → in_progress
  // Note (TOCTOU): findOne + patch is not an atomic CAS in IndexedDB. In v1,
  // multiInstance:false and single-session browser guarantee no true concurrency.
  // Document here so Phase 4 can add an optimistic-locking guard if needed.
  // -------------------------------------------------------------------------
  const db = await getDb();
  const gameDoc = await db.seasonGames.findOne(seasonGameId).exec();

  if (!gameDoc) {
    return { status: "not_found" };
  }
  if (gameDoc.status === "completed") {
    return { status: "already_complete" };
  }
  if (gameDoc.status === "in_progress") {
    return { status: "already_claimed" };
  }

  await gameDoc.patch({ status: "in_progress", claimedBy: claimToken });

  // Re-fetch after claim: RxDB snapshot docs use optimistic locking — the
  // stale _rev on `gameDoc` would cause CONFLICT on subsequent patches (step 3
  // rollback and step 9 completion write). Live re-fetch ensures we always
  // write against the current revision.
  const liveGameDoc = await db.seasonGames.findOne(seasonGameId).exec();
  if (!liveGameDoc) {
    // Extremely unlikely, but guard defensively.
    return { status: "not_found" };
  }

  // -------------------------------------------------------------------------
  // STEP 2 — Read derivedSeed (cached at schedule-generation time).
  // -------------------------------------------------------------------------
  const derivedSeed = liveGameDoc.derivedSeed;

  // -------------------------------------------------------------------------
  // STEP 3 — Load rosterSnapshots from both seasonTeams.
  // -------------------------------------------------------------------------
  const [homeTeamDoc, awayTeamDoc] = await Promise.all([
    db.seasonTeams.findOne(liveGameDoc.homeSeasonTeamId).exec(),
    db.seasonTeams.findOne(liveGameDoc.awaySeasonTeamId).exec(),
  ]);

  if (!homeTeamDoc || !awayTeamDoc) {
    appLog.warn(`[runHeadlessGame] Missing seasonTeam doc for game ${seasonGameId}`);
    await liveGameDoc.patch({ status: "scheduled", claimedBy: null });
    return { status: "not_found" };
  }

  // -------------------------------------------------------------------------
  // STEP 4 — Load seasonPlayerState for both teams → build seasonModifiers.
  // -------------------------------------------------------------------------
  const playerStates = await db.seasonPlayerState
    .find({
      selector: {
        seasonTeamId: { $in: [liveGameDoc.homeSeasonTeamId, liveGameDoc.awaySeasonTeamId] },
      },
    })
    .exec();

  const _modifiers: SeasonModifiers = buildSeasonModifiers(playerStates);

  // -------------------------------------------------------------------------
  // STEP 5 — reinitSeed(derivedSeed). MUST be the last async operation before sim.
  // No RxDB reads, no logging, no other random() consumers between here and step 6.
  // -------------------------------------------------------------------------
  reinitSeed(derivedSeed);

  // -------------------------------------------------------------------------
  // STEP 6 — Run headless sim (v1 stub; Phase 4 = full reducer integration).
  // runHeadlessGameSim() consumes random() calls from the just-reinit'd PRNG.
  // -------------------------------------------------------------------------
  const simResult = runHeadlessGameSim();
  const { homeScore, awayScore, completedAt, boxscore } = simResult;

  // -------------------------------------------------------------------------
  // STEP 7 — AI rotation policy for both teams.
  // -------------------------------------------------------------------------
  const homePlayerStates = playerStates.filter(
    (ps) => ps.seasonTeamId === liveGameDoc.homeSeasonTeamId,
  );
  const awayPlayerStates = playerStates.filter(
    (ps) => ps.seasonTeamId === liveGameDoc.awaySeasonTeamId,
  );

  const seasonDoc = await db.seasons.findOne(liveGameDoc.seasonId).exec();

  const homeRotation = selectPitchers({
    seasonTeamId: liveGameDoc.homeSeasonTeamId,
    rosterSnapshot: homeTeamDoc.rosterSnapshot,
    playerStates: homePlayerStates,
    rulesetVersion: seasonDoc?.rulesetVersion ?? 1,
  });
  const awayRotation = selectPitchers({
    seasonTeamId: liveGameDoc.awaySeasonTeamId,
    rosterSnapshot: awayTeamDoc.rosterSnapshot,
    playerStates: awayPlayerStates,
    rulesetVersion: seasonDoc?.rulesetVersion ?? 1,
  });

  // -------------------------------------------------------------------------
  // STEP 8 — Compute pitcher fatigue patches.
  // -------------------------------------------------------------------------
  const winnerSeasonTeamId =
    homeScore > awayScore ? liveGameDoc.homeSeasonTeamId : liveGameDoc.awaySeasonTeamId;
  const loserSeasonTeamId =
    homeScore > awayScore ? liveGameDoc.awaySeasonTeamId : liveGameDoc.homeSeasonTeamId;
  // Null pitcher IDs (no eligible pitcher found) are excluded from the pitched set;
  // only valid non-empty IDs are added to avoid ghost-pitcher fatigue updates.
  const winnerStartingPitcherId =
    homeScore > awayScore ? homeRotation.startingPitcherId : awayRotation.startingPitcherId;
  const loserStartingPitcherId =
    homeScore > awayScore ? awayRotation.startingPitcherId : homeRotation.startingPitcherId;

  const rosterSnapshotBySeasonTeamId: Record<string, Record<string, unknown>> = {
    [liveGameDoc.homeSeasonTeamId]: homeTeamDoc.rosterSnapshot,
    [liveGameDoc.awaySeasonTeamId]: awayTeamDoc.rosterSnapshot,
  };

  const fatiguePatches = computePitcherFatigueUpdates({
    seasonId: liveGameDoc.seasonId,
    rulesetVersion: seasonDoc?.rulesetVersion ?? 1,
    winnerSeasonTeamId,
    loserSeasonTeamId,
    winnerStartingPitcherId: winnerStartingPitcherId ?? "",
    loserStartingPitcherId: loserStartingPitcherId ?? "",
    allPlayerStates: playerStates.map((d) => d.toJSON()),
    rosterSnapshotBySeasonTeamId,
  });

  // -------------------------------------------------------------------------
  // STEP 9 — Single logical bulk-write.
  // Order: game completion (durable sentinel) → player state → standings.
  // If a crash occurs after game completion but before player state, the
  // resetStaleGames() recovery path on next startup handles it.
  // -------------------------------------------------------------------------
  const runDiff = homeScore - awayScore;

  // Commit game as completed.
  await liveGameDoc.patch({
    status: "completed",
    boxscore,
    completedAt,
    claimedBy: null,
  });

  // Update standings on seasonTeam docs.
  if (homeScore > awayScore) {
    await homeTeamDoc.patch({
      wins: homeTeamDoc.wins + 1,
      runDifferential: homeTeamDoc.runDifferential + runDiff,
    });
    await awayTeamDoc.patch({
      losses: awayTeamDoc.losses + 1,
      runDifferential: awayTeamDoc.runDifferential - runDiff,
    });
  } else if (awayScore > homeScore) {
    await awayTeamDoc.patch({
      wins: awayTeamDoc.wins + 1,
      runDifferential: awayTeamDoc.runDifferential + Math.abs(runDiff),
    });
    await homeTeamDoc.patch({
      losses: homeTeamDoc.losses + 1,
      runDifferential: homeTeamDoc.runDifferential - Math.abs(runDiff),
    });
  } else {
    await homeTeamDoc.patch({ ties: homeTeamDoc.ties + 1 });
    await awayTeamDoc.patch({ ties: awayTeamDoc.ties + 1 });
  }

  // Apply pitcher fatigue patches (includes pitcherStartsThisSeason increment for SPs).
  if (fatiguePatches.length > 0) {
    const allStatesById = new Map(playerStates.map((d) => [d.id, d]));
    await Promise.all(
      fatiguePatches.map((patch) => {
        const doc = allStatesById.get(patch.id);
        return doc?.patch({
          pitcherDaysRest: patch.pitcherDaysRest,
          pitcherAvailability: patch.pitcherAvailability,
          pitcherStartsThisSeason: patch.pitcherStartsThisSeason,
        });
      }),
    );
  }

  // -------------------------------------------------------------------------
  // STEP 10 — Advance seasons.currentGameDay if all games for this day are done.
  // RC1 (Winston CR): conditional patch — no-op if another writer already advanced.
  // -------------------------------------------------------------------------
  if (seasonDoc) {
    const pendingOnDay = await db.seasonGames
      .find({
        selector: {
          seasonId: liveGameDoc.seasonId,
          gameDay: liveGameDoc.gameDay,
          status: { $in: ["scheduled", "in_progress"] },
        },
      })
      .exec();

    if (pendingOnDay.length === 0) {
      // All games for this day complete — advance if still on this day.
      if (seasonDoc.currentGameDay === liveGameDoc.gameDay) {
        await seasonDoc.patch({ currentGameDay: liveGameDoc.gameDay + 1 });
      }
    }
  }

  return { status: "completed", homeScore, awayScore };
}
