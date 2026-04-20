import { appLog } from "@shared/utils/logger";

import type { BallgameDb } from "@storage/db";
import { generatePlayerId } from "@storage/generateId";
import type { TeamPlayer, TeamWithRoster, UpdateCustomTeamInput } from "@storage/types";

import { type ImportPlayerResult } from "./customTeamExportBundles";
import { resolvePlayerConflict } from "./customTeamIdentity";
import { removeTeamPlayerRecords, writePlayerRecords } from "./customTeamPlayerDocs";
import {
  DEFAULT_BATTING_STAMINA,
  DEFAULT_PITCHING_STAMINA,
  sanitizePlayer,
} from "./customTeamSanitizers";

const DEFAULT_BATTER_POSITION = "DH";
const DEFAULT_PITCHER_POSITION = "RP";
const DEFAULT_HANDEDNESS = "R" as const;

function normalizeImportedPlayer(
  player: TeamPlayer,
  section: "lineup" | "bench" | "pitchers",
): TeamPlayer {
  const isPitcher = player.role === "pitcher";
  const rawPosition = typeof player.position === "string" ? player.position.trim() : "";
  const normalizedPitcherPosition =
    rawPosition.length === 0 || rawPosition === "P"
      ? player.role === "pitcher" && player.pitchingRole === "SP"
        ? "SP"
        : DEFAULT_PITCHER_POSITION
      : rawPosition;
  const normalizedPosition =
    rawPosition.length === 0
      ? isPitcher || section === "pitchers"
        ? normalizedPitcherPosition
        : DEFAULT_BATTER_POSITION
      : rawPosition === "P" && (isPitcher || section === "pitchers")
        ? normalizedPitcherPosition
        : player.position;
  const normalizedHandedness =
    player.handedness === undefined ? DEFAULT_HANDEDNESS : player.handedness;

  if (isPitcher) {
    const pitching = player.pitching;
    return {
      ...player,
      position: normalizedPosition,
      handedness: normalizedHandedness,
      pitching: {
        ...pitching,
        stamina: pitching.stamina === undefined ? DEFAULT_PITCHING_STAMINA : pitching.stamina,
      },
    };
  }

  const batting = player.batting;
  return {
    ...player,
    position: normalizedPosition,
    handedness: normalizedHandedness,
    batting: {
      ...batting,
      stamina: batting.stamina === undefined ? DEFAULT_BATTING_STAMINA : batting.stamina,
    },
  };
}

/**
 * Orchestrates the upsert of a single team and its player docs during an import.
 * Stores the team doc with empty embedded roster arrays (players live in the
 * `players` collection), then upserts all player docs and removes any stale ones.
 * On failure, rolls back the team upsert so no empty-roster team is left behind.
 */
export async function orchestrateTeamImport(
  db: BallgameDb,
  team: TeamWithRoster,
  rosterSchemaVersion: number,
): Promise<void> {
  const teamDoc: TeamWithRoster = {
    ...team,
    roster: { schemaVersion: rosterSchemaVersion, lineup: [], bench: [], pitchers: [] },
  };
  await db.teams.upsert(teamDoc);
  try {
    // Run the same strict sanitizer used by create/update so imported players
    // must include required identity/stat fields and valid role-specific stats.
    const sanitizeImported = (
      p: TeamPlayer,
      section: "lineup" | "bench" | "pitchers",
      index: number,
    ): TeamPlayer => sanitizePlayer(normalizeImportedPlayer(p, section), { section, index });
    const clampedRoster = {
      ...team.roster,
      lineup: team.roster.lineup.map((p, i) => sanitizeImported(p, "lineup", i)),
      bench: (team.roster.bench ?? []).map((p, i) => sanitizeImported(p, "bench", i)),
      pitchers: team.roster.pitchers.map((p, i) => sanitizeImported(p, "pitchers", i)),
    };
    const newDocIds = await writePlayerRecords(db, team.id, clampedRoster);
    await removeTeamPlayerRecords(db, team.id, newDocIds);
  } catch (err) {
    // Roll back the team doc AND any player docs that were partially written,
    // so no orphaned players (pointing at a non-existent teamId) are left behind.
    await Promise.all([
      db.teams
        .findOne(team.id)
        .exec()
        .then((d) => d?.remove())
        .catch((rollbackErr) => {
          appLog.warn(
            `[importCustomTeams] rollback (team doc) failed for team ${team.id}:`,
            rollbackErr,
          );
        }),
      removeTeamPlayerRecords(db, team.id).catch((rollbackErr) => {
        appLog.warn(
          `[importCustomTeams] rollback (player docs) failed for team ${team.id}:`,
          rollbackErr,
        );
      }),
    ]);
    throw err;
  }
}

/**
 * Performs the cross-team identity check and roster-append for a single-player import.
 * Extracted from `CustomTeamStore.importPlayer` to keep the store method thin.
 *
 * @param db - Live DB instance (used for conflict resolution).
 * @param options.player - The parsed, sig-stripped player to import.
 * @param options.targetTeamId - ID of the team to import into.
 * @param options.targetTeam - Fully-hydrated target team doc (roster already populated).
 * @param options.section - Roster slot to append the player to.
 * @param options.updateFn - Callback that persists roster updates (injected to avoid coupling
 *   this pure orchestration function to the store's `this`).
 */
export interface ImportPlayerIntoTeamOptions {
  player: TeamPlayer;
  targetTeamId: string;
  targetTeam: TeamWithRoster;
  section: "lineup" | "bench" | "pitchers";
  updateFn: (id: string, updates: UpdateCustomTeamInput) => Promise<void>;
}

export async function importPlayerIntoTeam(
  db: BallgameDb,
  { player, targetTeamId, targetTeam, section, updateFn }: ImportPlayerIntoTeamOptions,
): Promise<ImportPlayerResult> {
  // Cross-team identity check
  const conflictResult = await resolvePlayerConflict(db, player.id, targetTeamId);
  if (conflictResult.status === "conflict") {
    return {
      status: "conflict",
      conflictingTeamId: conflictResult.conflictingTeamId,
      conflictingTeamName: conflictResult.conflictingTeamName,
    };
  }
  if (conflictResult.status === "alreadyOnThisTeam") {
    return { status: "alreadyOnThisTeam" };
  }

  // Append to the target section and persist.
  const allTargetIds = new Set([
    ...targetTeam.roster.lineup.map((p) => p.id),
    ...(targetTeam.roster.bench ?? []).map((p) => p.id),
    ...targetTeam.roster.pitchers.map((p) => p.id),
  ]);
  const playerToInsert: TeamPlayer = allTargetIds.has(player.id)
    ? { ...player, id: generatePlayerId() }
    : player;
  const currentSection =
    section === "lineup"
      ? targetTeam.roster.lineup
      : section === "bench"
        ? (targetTeam.roster.bench ?? [])
        : targetTeam.roster.pitchers;
  const updatedSection = [...currentSection, playerToInsert];
  await updateFn(targetTeamId, {
    roster: {
      lineup: section === "lineup" ? updatedSection : targetTeam.roster.lineup,
      bench: section === "bench" ? updatedSection : (targetTeam.roster.bench ?? []),
      pitchers: section === "pitchers" ? updatedSection : targetTeam.roster.pitchers,
    },
  });

  return { status: "success", finalLocalId: playerToInsert.id };
}
