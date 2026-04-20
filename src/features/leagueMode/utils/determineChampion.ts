import type { TeamStanding } from "./calculateStandings";

/**
 * Returns the teamId of the first entry in standings (already sorted by winPct desc).
 * Returns null if standings is empty.
 */
export function determineChampion(standings: TeamStanding[]): string | null {
  if (standings.length === 0) return null;
  return standings[0].teamId;
}
