/**
 * Stale in_progress game resetter — run once on app startup.
 *
 * Any seasonGame left at status='in_progress' from a prior session (crashed tab,
 * reload during sim, etc.) is reset to 'scheduled' with claimedBy cleared.
 * The next sim run will re-claim and re-run from scratch — safe because
 * reinitSeed(derivedSeed) re-runs the game deterministically from the stored seed.
 *
 * RC5 (Winston CR): must also null out claimedBy so the next claim attempt
 * succeeds. A game reset to 'scheduled' with a non-null claimedBy from a dead
 * session would cause the next runner to observe a claimed-looking row and abort.
 *
 * RC2 (Winston CR): this is also the recovery pass for partial step-9 writes.
 * If a game was marked 'in_progress' but step 9 (seasonPlayerState update) never
 * completed, the resetter brings it back to 'scheduled' and the next sim run
 * replays the full flow, including the fatigue update.
 *
 * Call this once on app startup before enabling any season navigation, and await it.
 */
import { appLog } from "@shared/utils/logger";

import { getDb } from "@storage/db";

/**
 * Resets all stale in_progress season games to scheduled.
 * @returns Count of games that were reset.
 */
export async function resetStaleInProgressGames(): Promise<number> {
  const db = await getDb();
  const stale = await db.seasonGames.find({ selector: { status: "in_progress" } }).exec();

  if (stale.length === 0) return 0;

  await Promise.all(
    stale.map((doc) =>
      doc.patch({
        status: "scheduled",
        claimedBy: null,
      }),
    ),
  );

  appLog.log(
    `[league/resetStaleGames] Reset ${stale.length} stale in_progress game(s) to scheduled.`,
  );
  return stale.length;
}
