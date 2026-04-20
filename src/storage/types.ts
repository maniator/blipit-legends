// Central re-export hub — feature-owned types live in their feature's storage/types.ts.
// All public @storage/types imports remain valid through these re-exports.

export type {
  BatterGameStatRecord,
  BattingLeader,
  CompletedGameRecord,
  ExportedGameHistory,
  ImportGameHistoryResult,
  PitcherGameStatRecord,
  PitchingLeader,
  TeamCareerBattingStatsRow,
  TeamCareerPitchingStatsRow,
  TeamCareerSummary,
} from "@feat/careerStats/storage/types";
export type {
  BatterPlayerRecord,
  CreateCustomTeamInput,
  CustomTeamMetadata,
  ExportedCustomTeams,
  PitcherPlayerRecord,
  PlayerRecord,
  TeamBatterPlayer,
  TeamPitcherPlayer,
  TeamPlayer,
  TeamPlayerBatting,
  TeamPlayerPitching,
  TeamRecord,
  TeamRoster,
  TeamWithRoster,
  UpdateCustomTeamInput,
} from "@feat/customTeams/storage/types";
export type {
  LeagueGameContext,
  LeagueRecord,
  LeagueSeasonRecord,
  ScheduledGameRecord,
} from "@feat/leagueMode/storage/types";
export type {
  EventRecord,
  GameEvent,
  GameSaveSetup,
  GameSetup,
  InningSnapshot,
  ProgressSummary,
  RxdbExportedSave,
  SaveRecord,
  ScoreSnapshot,
  StateSnapshot,
} from "@feat/saves/storage/types";

// Cross-feature / app-shell types (genuinely shared)
import type { Handedness, TeamCustomPlayerOverrides } from "@feat/gameplay/context/index";
import type { LeagueGameContext } from "@feat/leagueMode/storage/types";
import type { SaveRecord } from "@feat/saves/storage/types";

export type PlayerOverrides = {
  away: TeamCustomPlayerOverrides;
  home: TeamCustomPlayerOverrides;
  awayOrder: string[];
  homeOrder: string[];
  awayBench?: string[];
  homeBench?: string[];
  awayPitchers?: string[];
  homePitchers?: string[];
  awayHandedness?: Record<string, Handedness>;
  homeHandedness?: Record<string, Handedness>;
  /**
   * Starting pitcher index into awayPitchers/homePitchers for each team.
   * null = use index 0 (default). Only meaningful for managed custom-team games.
   */
  startingPitcherIdx?: [number | null, number | null];
};

// --- App Shell / Route types ---

/** Shape for a game setup originating from the /exhibition/new page. */
export type ExhibitionGameSetup = {
  homeTeam: string;
  awayTeam: string;
  /** Human-readable display name for the home team. */
  homeTeamLabel: string;
  /** Human-readable display name for the away team. */
  awayTeamLabel: string;
  managedTeam: 0 | 1 | null;
  playerOverrides: PlayerOverrides;
};

/** Context shape provided by AppShell through the React Router Outlet. */
export type AppShellOutletContext = {
  onStartGame: (setup: ExhibitionGameSetup) => void;
  /** Called from the saves page when the user picks a save to load. */
  onLoadSave: (slot: SaveRecord) => void;
  /** Called by GamePage when a game session starts, to update hasActiveSession. */
  onGameSessionStarted: () => void;
  // Navigation callbacks consumed by route-level page components
  onNewGame: () => void;
  onLoadSaves: () => void;
  onManageTeams: () => void;
  onResumeCurrent: () => void;
  onHelp: () => void;
  onContact?: () => void;
  onCareerStats: () => void;
  /** True once at least one completed game has been persisted or a game just ended — gates the Career Stats entry. */
  hasCareerStats: boolean;
  onBackToHome: () => void;
  hasActiveSession: boolean;
  /** Called by GameInner (via GamePage/Game) when a game reaches FINAL, so AppShell clears hasActiveSession. */
  onGameOver: () => void;
  onLeague: () => void;
  hasLeague: boolean;
  activeLeagueId?: string;
};

/** Shape of the React Router location state used when navigating to /game from league mode. */
export type LeagueGameLocationState = {
  leagueGameContext: LeagueGameContext;
  pendingGameSetup: null;
  pendingLoadSave: null;
} | null;

/** Shape of the React Router location state used when navigating to /game. */
export type GameLocationState =
  | {
      pendingGameSetup: ExhibitionGameSetup | null;
      pendingLoadSave: SaveRecord | null;
    }
  | LeagueGameLocationState;
