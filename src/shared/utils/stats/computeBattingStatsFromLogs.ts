import type { PlayLogEntry, StrikeoutEntry } from "@feat/gameplay/context/index";
import { Hit } from "@shared/constants/hitTypes";

/** Accumulated batting statistics for a single player. */
export type BatterStat = {
  atBats: number;
  hits: number;
  walks: number;
  strikeouts: number;
  rbi: number;
  singles: number;
  doubles: number;
  triples: number;
  homers: number;
  /** Sacrifice flies: plate appearances where a caught fly ball drove in a run. Counts as PA but not AB. */
  sacFlies: number;
};

/** Returns a blank batting stat record. */
export const emptyBatterStat = (): BatterStat => ({
  atBats: 0,
  hits: 0,
  walks: 0,
  strikeouts: 0,
  rbi: 0,
  singles: 0,
  doubles: 0,
  triples: 0,
  homers: 0,
  sacFlies: 0,
});

/**
 * Returns the stat key for a log entry — always the batter's player ID.
 */
export const statKey = (entry: { playerId: string }): string => entry.playerId;

/**
 * Computes per-player batting statistics from the game's play logs.
 *
 * Used by both `PlayerStatsPanel` (this-game view) and
 * `commitCompletedGame` (writing permanent history rows).
 *
 * @param team - 0 = away, 1 = home
 * @param playLog - all hit/walk events with batter attribution
 * @param strikeoutLog - all strikeout events with batter attribution
 * @param outLog - all batter-completed out events (K + pop-out + groundout + FC + sac-bunt + sac-fly)
 * @returns map of statKey → BatterStat for the given team
 */
export const computeBattingStatsFromLogs = (
  team: 0 | 1,
  playLog: PlayLogEntry[],
  strikeoutLog: StrikeoutEntry[],
  outLog: StrikeoutEntry[],
): Record<string, BatterStat> => {
  const stats: Record<string, BatterStat> = {};
  const getOrCreate = (key: string): BatterStat => {
    if (!stats[key]) stats[key] = emptyBatterStat();
    return stats[key];
  };
  for (const entry of playLog) {
    if (entry.team !== team) continue;
    const s = getOrCreate(statKey(entry));
    if (entry.event === Hit.Walk || entry.event === Hit.HitByPitch) {
      s.walks++;
    } else {
      s.hits++;
      if (entry.event === Hit.Single) s.singles++;
      else if (entry.event === Hit.Double) s.doubles++;
      else if (entry.event === Hit.Triple) s.triples++;
      else if (entry.event === Hit.Homerun) s.homers++;
    }
    s.rbi += entry.rbi ?? 0;
  }
  for (const entry of strikeoutLog) {
    if (entry.team !== team) continue;
    getOrCreate(statKey(entry)).strikeouts++;
  }
  // AB = H + non-sac-fly outLog entries (sac flies count as PA but not AB).
  // Sac flies earn RBI and increment sacFlies instead of atBats.
  for (const entry of outLog) {
    if (entry.team !== team) continue;
    if (entry.isSacFly) {
      const s = getOrCreate(statKey(entry));
      s.sacFlies++;
      s.rbi += entry.rbi ?? 1;
    } else {
      getOrCreate(statKey(entry)).atBats++;
    }
  }
  // AB must also include hits (reached-base events are not in outLog)
  for (const key of Object.keys(stats)) {
    stats[key].atBats += stats[key].hits;
  }
  return stats;
};
