/**
 * Sim-to-next-user-game batch loop.
 *
 * Sequentially simulates every scheduled season game until the next game
 * involving the user's team is reached. Returns the ID of that game.
 *
 * PRNG contract: each call to runHeadlessGame internally calls reinitSeed(),
 * which mutates the global mulberry32 PRNG. Games MUST be processed sequentially
 * (one at a time) — never in parallel. Parallel execution would interleave PRNG
 * calls and break determinism.
 *
 * Sort order: games are ordered by [gameDay ASC, id ASC]. The `id` field uses
 * nanoid with an `sg_` prefix — lexicographic tie-breaking within a game day is
 * stable and consistent across runs.
 *
 * The user's own game is NOT simulated headlessly — it is returned as `nextGameId`
 * for the caller to handle (either watch mode or quick-sim).
 */
import { appLog } from "@shared/utils/logger";
import { nanoid } from "nanoid";

import { getDb } from "@storage/db";

import { runHeadlessGame } from "./runHeadlessGame";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface AdvanceToUserGameInput {
  seasonId: string;
  /** seasonTeamId of the user's enrolled team. */
  userSeasonTeamId: string;
}

export interface AdvanceToUserGameResult {
  /**
   * The seasonGameId of the next game involving the user's team,
   * or null if the season is complete (no more pending games).
   */
  nextGameId: string | null;
  gamesSimulated: number;
}

/**
 * Advances the season by simulating all scheduled games that precede the
 * user's next game, then returns the user's next game ID.
 */
export async function advanceToUserGame(
  input: AdvanceToUserGameInput,
): Promise<AdvanceToUserGameResult> {
  const { seasonId, userSeasonTeamId } = input;

  // Single claim token for the entire advance pass — helps with debugging.
  const claimToken = nanoid(12);
  let gamesSimulated = 0;

  while (true) {
    const db = await getDb();

    // Re-query every iteration so currentGameDay advances are reflected.
    const allPending = await db.seasonGames
      .find({
        selector: {
          seasonId,
          status: { $in: ["scheduled", "in_progress"] },
        },
      })
      .exec();

    if (allPending.length === 0) {
      // Season is complete — no more pending games.
      return { nextGameId: null, gamesSimulated };
    }

    // Sort by [gameDay ASC, id ASC] — deterministic ordering.
    const sorted = [...allPending].sort((a, b) => {
      if (a.gameDay !== b.gameDay) return a.gameDay - b.gameDay;
      return a.id.localeCompare(b.id);
    });

    // Find the next game involving the user's team.
    const nextUserGame = sorted.find(
      (g) => g.homeSeasonTeamId === userSeasonTeamId || g.awaySeasonTeamId === userSeasonTeamId,
    );

    if (!nextUserGame) {
      // User has no more games — season is functionally complete for this team.
      return { nextGameId: null, gamesSimulated };
    }

    // Find games that must be simulated before the user's next game.
    const headlessBefore = sorted.filter(
      (g) =>
        g.gameDay < nextUserGame.gameDay ||
        (g.gameDay === nextUserGame.gameDay && g.id < nextUserGame.id),
    );

    if (headlessBefore.length === 0) {
      // Nothing to sim — user's game is next.
      return { nextGameId: nextUserGame.id, gamesSimulated };
    }

    // Simulate one game at a time — must be sequential (global PRNG).
    let madeProgress = false;
    for (const game of headlessBefore) {
      const outcome = await runHeadlessGame({
        seasonGameId: game.id,
        claimToken,
      });

      if (outcome.status === "completed") {
        gamesSimulated++;
        madeProgress = true;
      } else if (outcome.status === "already_complete") {
        madeProgress = true; // treat existing-complete as forward progress
      } else {
        appLog.warn(
          `[advanceToUserGame] Unexpected outcome for game ${game.id}: ${outcome.status}`,
        );
      }
    }

    // If no progress was made (all headless games returned already_claimed /
    // not_found), the season is stuck — break to avoid an infinite busy loop.
    // The caller should run resetStaleInProgressGames() and retry.
    if (!madeProgress) {
      appLog.error(
        `[advanceToUserGame] No progress — ${headlessBefore.length} game(s) stuck ` +
          "(in_progress or not_found). Call resetStaleInProgressGames() and retry.",
      );
      return { nextGameId: nextUserGame.id, gamesSimulated };
    }
  }
}
