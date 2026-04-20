/**
 * Persisted completed-game document (one per finished game).
 *
 * Written exactly once when a game reaches FINAL. Loading an already-FINAL save
 * must never create a new CompletedGameRecord.
 */
export interface CompletedGameRecord {
  /**
   * Primary key — the `gameInstanceId` stored in `State` for the completed run.
   * Using `gameInstanceId` (not `saveId`) ensures that loading any mid-game
   * save slot from the same run and finishing it does NOT produce a second entry.
   */
  id: string;
  /** Wall-clock timestamp when the game was committed (ms since epoch). */
  playedAt: number;
  /** PRNG seed used for this game. */
  seed: string;
  /** RNG state captured at game-over for replay verification. */
  rngState: number | null;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  /** Number of innings played (9 normally; more for extras). */
  innings: number;
  /** The save ID (`SaveRecord.id`) that triggered the commit — for debug/traceability only. */
  committedBySaveId?: string;
  /** League season this game belongs to. Only present for league games. */
  leagueSeasonId?: string;
  /** Scheduled game record this result fulfills. Only present for league games. */
  scheduledGameId?: string;
  schemaVersion: number;
}

/** Batting statistics for a single player in a single completed game. */
export interface BatterGameStatRecord {
  /** Primary key — composite: `${gameId}:${teamId}:${playerId}`. */
  id: string;
  /** FK → CompletedGameRecord.id */
  gameId: string;
  teamId: string;
  opponentTeamId: string;
  /** Stable batter identity — `TeamPlayer.id`. */
  playerId: string;
  /** Player name captured at game time — so history is readable even if the name changes later. */
  nameAtGameTime: string;
  role: "batter" | "pitcher";
  batting: {
    atBats: number;
    hits: number;
    walks: number;
    strikeouts: number;
    rbi: number;
    singles: number;
    doubles: number;
    triples: number;
    homers: number;
    /** Sacrifice flies: plate appearances where a caught fly ball drove in a run (PA but not AB). */
    sacFlies: number;
  };
  /** Wall-clock timestamp when this row was created (ms since epoch). */
  createdAt: number;
  schemaVersion: number;
}

/**
 * Pitching statistics for a single pitcher in a single completed game.
 *
 * Outs are stored as integers; display IP as `Math.floor(outsPitched/3).Y` where
 * Y = outsPitched % 3.
 *
 * v1 simplification: earnedRuns = runsAllowed (error-tracking not yet implemented).
 */
export interface PitcherGameStatRecord {
  /** Primary key — composite: `${gameId}:${teamId}:${playerId}`. */
  id: string;
  /** FK → CompletedGameRecord.id */
  gameId: string;
  teamId: string;
  opponentTeamId: string;
  /** Stable player identity — `TeamPlayer.id`. */
  playerId: string;
  /** Pitcher name captured at game time for readable history. */
  nameAtGameTime: string;
  /** Total outs recorded while this pitcher was in the game. Display as X.Y (Y = outsPitched%3). */
  outsPitched: number;
  /** Total batters faced. */
  battersFaced: number;
  /**
   * Total pitch events thrown to batters (balls, strikes, fouls, balls in play, intentional walks).
   * Uses the simulation's pitch-event model: an intentional walk is a single event (IBB = 1),
   * not four separate pitches as in real-world pitch counts.
   */
  pitchesThrown: number;
  /** Hits allowed by this pitcher. */
  hitsAllowed: number;
  /** Walks (and intentional walks) allowed. */
  walksAllowed: number;
  /** Strikeouts recorded (batters K'd). */
  strikeoutsRecorded: number;
  /** Home runs allowed. */
  homersAllowed: number;
  /** Runs allowed (all, not just earned). */
  runsAllowed: number;
  /**
   * Earned runs. v1 approximation: equals runsAllowed.
   * Will be refined when error/earned-run tracking is added.
   */
  earnedRuns: number;
  /** Save recorded (1) or not (0). See SV rules in computePitcherGameStats.ts. */
  saves: number;
  /** Hold recorded (1) or not (0). */
  holds: number;
  /** Blown save recorded (1) or not (0). */
  blownSaves: number;
  /** Wall-clock timestamp when this row was created (ms since epoch). */
  createdAt: number;
  schemaVersion: number;
}

/** Portable signed export format for completed-game history. */
export interface ExportedGameHistory {
  type: "gameHistory";
  formatVersion: 1;
  exportedAt: string;
  payload: {
    games: CompletedGameRecord[];
    playerGameStats: BatterGameStatRecord[];
    pitcherGameStats: PitcherGameStatRecord[];
    /** Team IDs referenced by stats rows — must exist locally for import to succeed. */
    requiredTeamIds: string[];
  };
  /** FNV-1a 32-bit signature of GAME_HISTORY_EXPORT_KEY + JSON.stringify(payload) */
  sig: string;
}

/** Summary returned after importing a game history bundle. */
export interface ImportGameHistoryResult {
  gamesCreated: number;
  gamesSkipped: number;
  statsCreated: number;
  statsSkipped: number;
  pitcherStatsCreated: number;
  pitcherStatsSkipped: number;
}

// ── Team Career Aggregates ────────────────────────────────────────────────────

/** Aggregated team career statistics derived from completed games. */
export interface TeamCareerSummary {
  gamesPlayed: number;
  wins: number;
  losses: number;
  /** Number of tied games (rs === ra). Ties are excluded from W/L% calculation. */
  ties: number;
  /** Win percentage (0–1), computed as wins / (wins + losses), excluding ties. */
  winPct: number;
  runsScored: number;
  runsAllowed: number;
  /** RS − RA */
  runDiff: number;
  /** Runs scored per game. */
  rsPerGame: number;
  /** Runs allowed per game. */
  raPerGame: number;
  /** Current streak string (e.g. "W3", "L2", "T1", or "-" when no games played). */
  streak: string;
  /** W-L-T record from the last 10 games played. */
  last10: { wins: number; losses: number; ties: number };
}

/** A single batting leader entry for a team. */
export interface BattingLeader {
  playerId: string;
  nameAtGameTime: string;
  /** The stat value (e.g. HR count, batting average, RBI count). */
  value: number;
  gamesPlayed: number;
}

/** A single pitching leader entry for a team. */
export interface PitchingLeader {
  playerId: string;
  nameAtGameTime: string;
  /** The stat value (e.g. ERA, saves, strikeouts). */
  value: number;
  gamesPlayed: number;
}

/** Team career batting row shape consumed by career stats views. */
export type TeamCareerBattingStatsRow = BatterGameStatRecord["batting"] & {
  playerId: string;
  nameAtGameTime: string;
  gamesPlayed: number;
};

/** Team career pitching row shape consumed by career stats views. */
export type TeamCareerPitchingStatsRow = Omit<
  PitcherGameStatRecord,
  "id" | "gameId" | "teamId" | "opponentTeamId" | "createdAt" | "schemaVersion"
> & { gamesPlayed: number };
