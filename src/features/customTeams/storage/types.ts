/** Batting statistics for a custom team player. */
export interface TeamPlayerBatting {
  contact: number;
  power: number;
  speed: number;
  /** Stamina (0–100). Drives per-game batter fatigue: higher values reduce contact/power penalties as plate appearances accumulate. */
  stamina: number;
}

/** Pitching statistics for a custom team pitcher. */
export interface TeamPlayerPitching {
  velocity: number;
  control: number;
  movement: number;
  /** Stamina (0–100). Higher values keep pitchers effective for longer before fatigue sets in. */
  stamina: number;
}

/** A single player on a custom team roster. */
interface TeamPlayerBase {
  /** Stable ID within the team. */
  id: string;
  name: string;
  position: string;
  handedness: "R" | "L" | "S";
  isBenchEligible?: boolean;
  isPitcherEligible?: boolean;
  jerseyNumber?: number | null;
  /**
   * Pitcher role eligibility: SP = starter only, RP = reliever only, SP/RP = both (swingman).
   * Only meaningful for pitchers (role === "pitcher").
   * Absent on older saves — backfill as "SP" for index 0, "RP" for others when needed.
   */
  pitchingRole?: "SP" | "RP" | "SP/RP";
  /**
   * Persistent FNV-1a content fingerprint stored in the DB.
   * Covers the player's immutable identity fields: `name`, `role`, `batting`, and `pitching`.
   * Used for global duplicate detection across all teams in the local install.
   * Computed by `buildPlayerSig` in `customTeamExportImport.ts` and stored by
   * `sanitizePlayer` in `customTeamStore.ts`. Absent on documents created before
   * schema v2 — backfilled by the v1→v2 migration strategy in `db.ts`.
   */
  fingerprint?: string;
  /**
   * FNV-1a integrity signature covering the player's immutable identity fields:
   * `name`, `role`, `batting`, and `pitching`. Editable fields (`position`,
   * `handedness`, `jerseyNumber`, `pitchingRole`) and local IDs are intentionally
   * excluded so the sig remains valid after position edits, team moves, or ID remapping.
   * Present only in export bundles; stripped before DB storage.
   */
  sig?: string;
}

export interface TeamBatterPlayer extends TeamPlayerBase {
  role: "batter";
  batting: TeamPlayerBatting;
  pitching?: never;
  pitchingRole?: never;
}

export interface TeamPitcherPlayer extends TeamPlayerBase {
  role: "pitcher";
  batting?: never;
  pitching: TeamPlayerPitching;
  pitchingRole?: "SP" | "RP" | "SP/RP";
}

export type TeamPlayer = TeamBatterPlayer | TeamPitcherPlayer;

/** Roster embedded in a custom team document. */
export interface TeamRoster {
  schemaVersion: number;
  lineup: TeamPlayer[];
  bench?: TeamPlayer[];
  pitchers: TeamPlayer[];
}

/** Freeform metadata on a custom team document. */
export interface CustomTeamMetadata {
  notes?: string;
  tags?: string[];
  archived?: boolean;
}

/**
 * v1 persisted team record — metadata/identity only.
 * Does NOT store an authoritative embedded roster.
 * Players belong to teams via PlayerRecord.teamId.
 */
export interface TeamRecord {
  id: string;
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
  name: string;
  /** Lowercase version of name — stored for O(1) indexed dedup lookup. */
  nameLowercase: string;
  /** 2–3 char compact label for line score / scoreboard contexts. */
  abbreviation?: string;
  nickname?: string;
  city?: string;
  slug?: string;
  metadata: CustomTeamMetadata;
  /** Optional future hint for stat generation (e.g. "balanced", "power"). */
  statsProfile?: string;
  /** FNV-1a fingerprint of name+abbreviation+id — used for duplicate detection on import. */
  fingerprint?: string;
}

/**
 * v1 persisted player record.
 * `id` is a stable global player ID (e.g. "pl_<fnv1a(id)>") — NOT team-scoped.
 * Moving a player between teams updates `teamId` without changing player identity.
 */
interface PlayerRecordBase {
  /**
   * Stable global player ID — e.g. the player's `globalPlayerId`.
   * Primary key. NOT team-scoped or composite.
   * This IS the globalPlayerId: no separate globalPlayerId field needed.
   */
  id: string;
  /**
   * FK → TeamRecord.id. Use FREE_AGENT_TEAM_ID for players not assigned to any user team.
   */
  teamId: string;
  section: "lineup" | "bench" | "pitchers";
  /** Zero-based position within the section — used for ordering when assembling the roster. */
  orderIndex: number;
  name: string;
  position: string;
  handedness: "R" | "L" | "S";
  isBenchEligible?: boolean;
  isPitcherEligible?: boolean;
  jerseyNumber?: number | null;
  /** Persistent FNV-1a content fingerprint covering immutable identity fields. */
  fingerprint?: string;
  createdAt: string;
  updatedAt: string;
  schemaVersion: number;
}

export interface BatterPlayerRecord extends PlayerRecordBase {
  role: "batter";
  batting: TeamPlayerBatting;
  pitching?: never;
  pitchingRole?: never;
}

export interface PitcherPlayerRecord extends PlayerRecordBase {
  role: "pitcher";
  batting?: never;
  pitching: TeamPlayerPitching;
  pitchingRole?: "SP" | "RP" | "SP/RP";
}

export type PlayerRecord = BatterPlayerRecord | PitcherPlayerRecord;

/** View type: TeamRecord with an assembled roster attached. Not a stored document.
 *  Returned by `populateRoster` and used throughout the adapter/component layer.
 */
export interface TeamWithRoster extends TeamRecord {
  roster: TeamRoster;
}

/** Input shape for creating a new custom team. */
export interface CreateCustomTeamInput {
  name: string;
  /** 2–3 char compact label for compact UI contexts. */
  abbreviation?: string;
  nickname?: string;
  city?: string;
  slug?: string;
  roster: {
    lineup: TeamPlayer[];
    bench?: TeamPlayer[];
    pitchers?: TeamPlayer[];
  };
  metadata?: {
    notes?: string;
    tags?: string[];
    archived?: boolean;
  };
  statsProfile?: string;
}

/** Input shape for updating an existing custom team (all fields optional). */
export interface UpdateCustomTeamInput {
  name?: string;
  /** 2–3 char compact label for compact UI contexts. */
  abbreviation?: string;
  nickname?: string;
  city?: string;
  slug?: string;
  roster?: {
    lineup?: TeamPlayer[];
    bench?: TeamPlayer[];
    pitchers?: TeamPlayer[];
  };
  metadata?: Partial<CustomTeamMetadata>;
  statsProfile?: string;
}

/** Keyed JSON export format for custom teams. */
export interface ExportedCustomTeams {
  type: "customTeams";
  formatVersion: 1;
  exportedAt: string;
  appVersion?: string;
  payload: {
    teams: TeamWithRoster[];
  };
  /** FNV-1a 32-bit signature of TEAMS_EXPORT_KEY + JSON.stringify(payload) */
  sig: string;
}
