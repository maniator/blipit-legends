/** A sub-division / conference within a season. */
export interface SeasonLeague {
  id: string;
  name: string;
  teamIds: string[];
  dhEnabled: boolean;
}

/**
 * Persisted season header document — one per league season.
 * Contains all configuration and top-level state for the season.
 */
export interface SeasonRecord {
  id: string;
  name: string;
  status: "active" | "complete" | "abandoned";
  /** Epoch ms timestamp of season creation — used for display and sorting. */
  createdAt: number;
  completedAt?: number | null;
  preset: "mini" | "standard" | "full";
  seasonLength: "sprint" | "standard" | "marathon";
  /** Deterministic master seed used to derive per-game seeds. */
  masterSeed: string;
  /** One entry per league sub-division. */
  leagues: SeasonLeague[];
  tradeDeadlineGameDay?: number | null;
  playoffFormat?: string | null;
  featureFlags?: Record<string, unknown>;
  /** 0-based index of the current game day. Advances as the schedule progresses. */
  currentGameDay: number;
  championTeamId?: string | null;
  /** Monotonic ruleset version used for this season — checked on import. */
  rulesetVersion: number;
}

/**
 * Persisted season-team record — one per custom team enrolled in a season.
 * Captures a locked roster snapshot and accumulates standings stats.
 */
export interface SeasonTeamRecord {
  id: string;
  /** FK → SeasonRecord.id */
  seasonId: string;
  /** FK → SeasonRecord.leagues[].id */
  leagueId: string;
  /** FK → TeamRecord.id */
  customTeamId: string;
  /** Roster snapshot captured at enrollment — immutable during the season. */
  rosterSnapshot: Record<string, unknown>;
  wins: number;
  losses: number;
  ties: number;
  runDifferential: number;
}

/**
 * Persisted season-game record — one per scheduled or played game.
 * Status transitions: scheduled → in_progress → completed.
 */
export interface SeasonGameRecord {
  id: string;
  /** FK → SeasonRecord.id */
  seasonId: string;
  /** 0-based game day within the season schedule. */
  gameDay: number;
  /** FK → SeasonTeamRecord.id */
  homeSeasonTeamId: string;
  /** FK → SeasonTeamRecord.id */
  awaySeasonTeamId: string;
  /** Groups games belonging to the same series. */
  seriesId: string;
  status: "scheduled" | "in_progress" | "completed";
  /** Full boxscore once complete; null while pending. */
  boxscore?: Record<string, unknown> | null;
  /** Seed derived from the season masterSeed + game slot for deterministic RNG. */
  derivedSeed: string;
  completedAt?: number | null;
  /** Token identifying the session currently simulating this game. */
  claimedBy?: string | null;
}

/**
 * Persisted per-player season state — tracks pitcher fatigue and availability.
 * Primary key is composite: `${seasonId}:${playerId}`.
 */
export interface SeasonPlayerStateRecord {
  /** Composite key: `${seasonId}:${playerId}` */
  id: string;
  /** FK → SeasonRecord.id */
  seasonId: string;
  /** FK → SeasonTeamRecord.id */
  seasonTeamId: string;
  /** FK → PlayerRecord.id */
  playerId: string;
  /** Days since the pitcher's last appearance (0 = appeared today). */
  pitcherDaysRest: number;
  /** Fatigue availability (0.0–1.0). Checked against eligibility threshold before starts. */
  pitcherAvailability: number;
  /** Total starts accumulated this season. */
  pitcherStartsThisSeason: number;
}
