// Status types
export type LeagueStatus = "active" | "archived";
export type LeagueSeasonStatus = "pending" | "active" | "complete";
export type ScheduledGameStatus = "scheduled" | "completed" | "bye";

// Champion tie-break policy (v1):
// (1) head-to-head record among tied teams,
// (2) total runs scored — higher wins,
// (3) lower teamId string wins lexicographically.

export interface LeagueRecord {
  id: string;
  name: string;
  teamIds: string[];
  divisionCount: number;
  tradeDeadlineGameDay?: number;
  activeLeagueSeasonId?: string;
  status: LeagueStatus;
  schemaVersion: number;
  createdAt: number;
  updatedAt: number;
}

export interface LeagueSeasonRecord {
  id: string;
  leagueId: string;
  seasonNumber: number;
  status: LeagueSeasonStatus;
  currentGameDay: number;
  totalGameDays: number;
  /** Default games per team for this season. Default: 30. */
  defaultGamesPerTeam: number;
  seed: string;
  /** Team ID of the season champion. Only set when status is 'complete'. */
  championTeamId?: string;
  schemaVersion: number;
  createdAt: number;
  updatedAt: number;
}

export interface ScheduledGameRecord {
  id: string;
  leagueSeasonId: string;
  gameDay: number;
  awayTeamId: string;
  homeTeamId: string;
  status: ScheduledGameStatus;
  completedGameId?: string;
  schemaVersion: number;
}

/** Carried through GameSaveSetup.leagueContext and GamePage for post-game reconciliation. */
export interface LeagueGameContext {
  leagueId: string;
  leagueSeasonId: string;
  scheduledGameId: string;
}
