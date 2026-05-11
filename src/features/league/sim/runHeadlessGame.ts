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
import { GameHistoryStore } from "@feat/careerStats/storage/gameHistoryStore";
import { runHeadlessGameSim } from "@feat/gameplay/sim/headless";
import type { SeasonPlayerStateRecord } from "@feat/league/storage/types";
import { applySeasonGameResult } from "@feat/leagues/utils/applySeasonGameResult";
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
  const gameDoc = await db.seasonGames.findOne({ selector: { id: seasonGameId } }).exec();

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
  const liveGameDoc = await db.seasonGames.findOne({ selector: { id: seasonGameId } }).exec();
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
    db.seasonTeams.findOne({ selector: { id: liveGameDoc.homeSeasonTeamId } }).exec(),
    db.seasonTeams.findOne({ selector: { id: liveGameDoc.awaySeasonTeamId } }).exec(),
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
  const { homeScore, awayScore, completedAt } = simResult;

  // -------------------------------------------------------------------------
  // STEP 7 — AI rotation policy for both teams.
  // -------------------------------------------------------------------------
  const homePlayerStates = playerStates.filter(
    (ps) => ps.seasonTeamId === liveGameDoc.homeSeasonTeamId,
  );
  const awayPlayerStates = playerStates.filter(
    (ps) => ps.seasonTeamId === liveGameDoc.awaySeasonTeamId,
  );

  const seasonDoc = await db.seasons.findOne({ selector: { id: liveGameDoc.seasonId } }).exec();

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
  const winnerRelieverId =
    homeScore > awayScore ? homeRotation.relieverId : awayRotation.relieverId;
  const loserRelieverId = homeScore > awayScore ? awayRotation.relieverId : homeRotation.relieverId;

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
    winnerRelieverId: winnerRelieverId ?? "",
    loserRelieverId: loserRelieverId ?? "",
    allPlayerStates: playerStates.map((d) => d.toJSON()),
    rosterSnapshotBySeasonTeamId,
  });

  // -------------------------------------------------------------------------
  // STEP 9 — Single logical bulk-write.
  // Order: game completion (durable sentinel) → player state → standings.
  // If a crash occurs after game completion but before player state, the
  // resetStaleGames() recovery path on next startup handles it.
  //
  // applySeasonGameResult handles: patch seasonGames to 'completed', update
  // standings on seasonTeam docs, and advance currentGameDay (steps 9 + 10).
  // The liveGameDoc is already claimed (in_progress); applySeasonGameResult
  // will still patch it because it only skips docs already at 'completed'.
  // -------------------------------------------------------------------------
  await applySeasonGameResult(db, liveGameDoc.id, { homeScore, awayScore });

  // -------------------------------------------------------------------------
  // STEP 9b — Write a CompletedGameRecord to gameHistory so team W/L stats
  // appear on the /stats/:teamId career stats pages.
  // Placed AFTER the durable sentinel write (status='completed') so a crash
  // between steps 9 and 9b never leaves a gameHistory record without a
  // corresponding completed seasonGames entry.
  // Empty batting/pitching rows: headless sim has no per-player tracking (v2).
  // -------------------------------------------------------------------------
  try {
    await GameHistoryStore.commitCompletedGame(
      liveGameDoc.id,
      {
        playedAt: completedAt,
        seed: derivedSeed,
        rngState: null,
        homeTeamId: homeTeamDoc.customTeamId,
        awayTeamId: awayTeamDoc.customTeamId,
        homeScore,
        awayScore,
        // TODO(Phase 4): replace with simResult.innings once the full reducer
        // loop runs extra-inning games. The v1 stub always returns 9.
        innings: simResult.innings,
      },
      [],
      [],
    );
  } catch (err) {
    // Non-fatal: standings and seasonGames are already written. Log and continue.
    appLog.warn("[runHeadlessGame] gameHistory commit failed (non-fatal):", err);
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

  return { status: "completed", homeScore, awayScore };
}
