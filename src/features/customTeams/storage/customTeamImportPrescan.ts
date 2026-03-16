import type { CustomTeamDoc, TeamPlayer } from "@storage/types";

import {
  buildPlayerSig,
  buildTeamFingerprint,
  type TeamPlayerWithSig,
} from "./customTeamSignatures";

export interface ImportCustomTeamsResult {
  teams: CustomTeamDoc[];
  created: number;
  remapped: number;
  /**
   * Number of incoming teams that were exact fingerprint duplicates of an existing team
   * and were silently skipped (not imported) to prevent creating duplicate entries.
   */
  skipped: number;
  /** Team-level duplicate warnings (same team fingerprint already in DB). */
  duplicateWarnings: string[];
  /**
   * Player-level duplicate warnings. Populated when an imported player's signature
   * matches a player already stored in the local DB, indicating the player may already
   * exist. The UI should surface these so the user can review before accepting the import.
   */
  duplicatePlayerWarnings: string[];
  /**
   * When true the import was blocked because one or more players in the incoming
   * bundle already exist in the local DB (by content fingerprint).
   * The caller should prompt the user to confirm before re-trying with
   * `options.allowDuplicatePlayers = true` to proceed despite the duplicates.
   */
  requiresDuplicateConfirmation: boolean;
}

export interface ImportIdFactories {
  /** Factory for new team IDs on collision. */
  makeTeamId?: () => string;
  /** Factory for new player IDs on collision. */
  makePlayerId?: () => string;
}

export interface ImportCustomTeamsOptions {
  /**
   * When true, imports teams even if some players already exist in the local DB.
   * When false (the default), the import is blocked and `requiresDuplicateConfirmation`
   * is set to true so the caller can prompt the user for confirmation.
   */
  allowDuplicatePlayers?: boolean;
}

/** Shape returned by the pre-scan pass. */
export interface PreScanResult {
  /** Duplicate-player warning messages (one per flagged player). */
  warnings: string[];
  /** Number of teams that were fingerprint-matched and skipped during the pre-scan. */
  skippedCount: number;
}

/**
 * Pre-scan a list of incoming teams for duplicate players without committing any imports.
 *
 * Iterates over `teams`, skipping any whose fingerprint already exists in
 * `existingFingerprints`, and collects a warning for each player whose sig matches
 * one in `existingPlayerSigs`. Returns the warnings and the count of skipped teams.
 *
 * This is a pure, side-effect-free function — it does not mutate any of its arguments.
 */
export function preScanForDuplicatePlayers(
  teams: CustomTeamDoc[],
  existingFingerprints: Map<string, string>,
  existingPlayerSigs: Set<string>,
): PreScanResult {
  const warnings: string[] = [];
  let skippedCount = 0;

  for (const team of teams) {
    const incomingFp = team.fingerprint ?? buildTeamFingerprint(team);
    if (existingFingerprints.has(incomingFp)) {
      skippedCount++;
      continue;
    }
    const allPlayers: TeamPlayer[] = [
      ...team.roster.lineup,
      ...(team.roster.bench ?? []),
      ...(team.roster.pitchers ?? []),
    ];
    for (const player of allPlayers) {
      const pSig = (player as TeamPlayerWithSig).sig ?? buildPlayerSig(player);
      if (existingPlayerSigs.has(pSig)) {
        warnings.push(`Player "${player.name}" in "${team.name}" may already exist in your teams.`);
      }
    }
  }

  return { warnings, skippedCount };
}
