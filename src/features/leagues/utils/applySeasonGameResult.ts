/**
 * Shared utility for recording the result of a completed season game.
 *
 * Performs three writes in order (no cross-collection transaction; partial-write
 * recovery relies on the seasonGames.status='completed' sentinel):
 *   1. Patch seasonGames record → status='completed', boxscore, completedAt.
 *   2. Update wins/losses/ties and runDifferential on both seasonTeam docs.
 *   3. Advance seasons.currentGameDay if all games for that day are complete.
 *
 * Used by both the headless path (runHeadlessGame) and the interactive path
 * (useSeasonGameSync) so standings logic stays in one place.
 *
 * Idempotent: if the seasonGames record is already 'completed', returns immediately.
 */
import { appLog } from "@shared/utils/logger";

import type { BallgameDb } from "@storage/db";

export interface SeasonGameResult {
  homeScore: number;
  awayScore: number;
}

export async function applySeasonGameResult(
  db: BallgameDb,
  seasonGameId: string,
  result: SeasonGameResult,
): Promise<void> {
  const { homeScore, awayScore } = result;

  // ── Step 1: Mark game completed ───────────────────────────────────────────
  const gameDoc = await db.seasonGames.findOne({ selector: { id: seasonGameId } }).exec();
  if (!gameDoc) {
    appLog.warn(`[applySeasonGameResult] seasonGame not found: ${seasonGameId}`);
    return;
  }
  if (gameDoc.status === "completed") {
    // Idempotency guard — already committed by another path (e.g. headless claim).
    return;
  }

  const completedAt = Date.now();
  const boxscore = { homeScore, awayScore };

  await gameDoc.patch({
    status: "completed",
    boxscore,
    completedAt,
    claimedBy: null,
  });

  // ── Step 2: Update standings on seasonTeam docs ───────────────────────────
  const [homeTeamDoc, awayTeamDoc] = await Promise.all([
    db.seasonTeams.findOne({ selector: { id: gameDoc.homeSeasonTeamId } }).exec(),
    db.seasonTeams.findOne({ selector: { id: gameDoc.awaySeasonTeamId } }).exec(),
  ]);

  if (!homeTeamDoc || !awayTeamDoc) {
    appLog.warn(`[applySeasonGameResult] missing seasonTeam docs for game ${seasonGameId}`);
    return;
  }

  const runDiff = homeScore - awayScore;

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

  // ── Step 3: Advance currentGameDay if all games for this day are done ─────
  const seasonDoc = await db.seasons.findOne({ selector: { id: gameDoc.seasonId } }).exec();

  if (!seasonDoc) return;

  const pendingOnDay = await db.seasonGames
    .find({
      selector: {
        seasonId: gameDoc.seasonId,
        gameDay: gameDoc.gameDay,
        status: { $in: ["scheduled", "in_progress"] },
      },
    })
    .exec();

  if (pendingOnDay.length === 0 && seasonDoc.currentGameDay === gameDoc.gameDay) {
    await seasonDoc.patch({ currentGameDay: gameDoc.gameDay + 1 });
  }
}
