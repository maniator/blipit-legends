import type { BallgameDb } from "@storage/db";
import type { CustomTeamDoc, PlayerDoc } from "@storage/types";

export type PlayerConflictResult =
  | { status: "conflict"; conflictingTeamId: string; conflictingTeamName: string }
  | { status: "alreadyOnThisTeam" }
  | { status: "noConflict" };

/**
 * Checks whether a player (identified by globalPlayerId) already exists on
 * another team or on the target team itself.
 *
 * Returns:
 *  - `{ status: "conflict" }` when the player belongs to a different team.
 *  - `{ status: "alreadyOnThisTeam" }` when the player is already on the target team.
 *  - `{ status: "noConflict" }` when the player is not yet assigned anywhere.
 */
export async function resolvePlayerConflict(
  db: BallgameDb,
  globalPlayerId: string,
  targetTeamId: string,
): Promise<PlayerConflictResult> {
  const matchingDocs = await db.players.find({ selector: { globalPlayerId } }).exec();

  if (matchingDocs.length === 0) {
    return { status: "noConflict" };
  }

  const matchingPlayerDocs = matchingDocs.map((doc) => doc.toJSON() as unknown as PlayerDoc);

  const conflictingMatch = matchingPlayerDocs.find(
    (doc) => doc.teamId !== null && doc.teamId !== undefined && doc.teamId !== targetTeamId,
  );
  if (conflictingMatch) {
    const owningTeamDoc = conflictingMatch.teamId
      ? await db.customTeams.findOne(conflictingMatch.teamId).exec()
      : null;
    const owningTeamName =
      (owningTeamDoc?.toJSON() as unknown as CustomTeamDoc | undefined)?.name ?? "another team";
    return {
      status: "conflict",
      conflictingTeamId: conflictingMatch.teamId ?? "",
      conflictingTeamName: owningTeamName,
    };
  }

  const alreadyOnThisTeam = matchingPlayerDocs.some((doc) => doc.teamId === targetTeamId);
  if (alreadyOnThisTeam) {
    return { status: "alreadyOnThisTeam" };
  }

  return { status: "noConflict" };
}
