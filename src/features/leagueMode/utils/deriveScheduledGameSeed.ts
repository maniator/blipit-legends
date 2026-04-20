import { fnv1a } from "@storage/hash";

/**
 * Canonical seed derivation for scheduled games.
 * Algorithm: FNV-1a hash of "${leagueSeasonId}:${scheduledGameId}" → parse as unsigned 32-bit int → base-36.
 * Algorithm is stable — do not change.
 */
export const deriveScheduledGameSeed = (
  leagueSeasonId: string,
  scheduledGameId: string,
): string => {
  const hash = fnv1a(`${leagueSeasonId}:${scheduledGameId}`);
  return (parseInt(hash, 16) >>> 0).toString(36);
};
