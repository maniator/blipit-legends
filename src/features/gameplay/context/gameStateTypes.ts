import { Hit } from "@shared/constants/hitTypes";
import type * as React from "react";

import type { DecisionType, OnePitchModifier } from "./decisionTypes";
import type { PitcherLogEntry, PlayLogEntry, StrikeoutEntry } from "./gameLogTypes";
import type { LogAction } from "./logReducer";
import type {
  Handedness,
  ResolvedPlayerMods,
  Strategy,
  TeamCustomPlayerOverrides,
} from "./playerTypes";

export interface State {
  /**
   * Stable identity for the current game run — generated once when a new game
   * starts (via the `reset` action) and carried in every subsequent save snapshot
   * of that run. Used as `GameDoc.id` to deduplicate career-history commits across
   * multiple mid-game save slots: finishing from Save A or Save B of the same run
   * both resolve to the same `gameInstanceId`, so only one `GameDoc` is ever written.
   *
   * Absent on saves created before this field was introduced — `useGameHistorySync`
   * falls back to `saveId` (legacy behaviour, same as before) for those saves.
   */
  gameInstanceId?: string;
  inning: number;
  score: [number, number];
  teams: [string, string];
  /** Human-readable display names for the two teams. Matches the indices of `teams`. */
  teamLabels: [string, string];
  baseLayout: [number, number, number];
  outs: number;
  strikes: number;
  balls: number;
  atBat: 0 | 1; // 0 = away batting, 1 = home batting
  hitType?: Hit;
  gameOver: boolean;
  pendingDecision: DecisionType | null;
  onePitchModifier: OnePitchModifier;
  pitchKey: number;
  decisionLog: string[];
  suppressNextDecision: boolean; // true after an intentional walk; clears on next pitch
  pinchHitterStrategy: Strategy | null; // overrides manager strategy for one batter
  defensiveShift: boolean; // pop-out threshold multiplied by 0.85 when true
  defensiveShiftOffered: boolean; // prevents re-offering shift during the same half-inning
  batterIndex: [number, number]; // 0–8 position in the 9-batter lineup per team
  inningRuns: [number[], number[]]; // runs scored per inning index per team (sparse)
  playLog: PlayLogEntry[]; // record of every hit/walk with batter attribution
  strikeoutLog: StrikeoutEntry[]; // record of every strikeout with batter attribution
  outLog: StrikeoutEntry[]; // record of every batter-completed out (K + pop-out + groundout + FC + sac-bunt)
  playerOverrides: [TeamCustomPlayerOverrides, TeamCustomPlayerOverrides]; // [away, home]
  lineupOrder: [string[], string[]]; // [away, home] batter IDs in batting order (empty = default)
  /** Bench player IDs available for substitution per team. [away, home] */
  rosterBench: [string[], string[]];
  /** Pitcher IDs in the bullpen per team. [away, home] */
  rosterPitchers: [string[], string[]];
  /** Index into rosterPitchers of the currently active pitcher per team. [away, home] */
  activePitcherIdx: [number, number];
  /**
   * Defensive slot assignment for each batting-order position per team. [away, home]
   * Each entry is the position (e.g. "SS", "CF") that the player in that batting slot
   * is assigned to play for this game. Populated from the roster at game-start via
   * `setTeams`; unchanged on substitution so the slot's assignment stays consistent
   * even after a bench player with a different natural position comes in.
   * Empty array = fall back to per-player natural position (stock teams / older saves).
   */
  lineupPositions: [string[], string[]];
  /**
   * Number of batters faced by the current pitcher per team since their last entry.
   * Reset to 0 when a new pitcher comes in. Used for fatigue tracking.
   * [away, home]
   */
  pitcherBattersFaced: [number, number];
  /**
   * Number of pitch events thrown to batters by the current pitcher per team since their last entry.
   * Reset to 0 when a new pitcher comes in. Primary workload signal for fatigue.
   * Counts every pitch event to a batter: strikes, balls, fouls, balls in play, and intentional walks.
   * An intentional walk (`intentional_walk`) is modeled as a single pitch event here (not four pitches).
   * Steal attempts do NOT count — they are baserunning events, not pitches to the batter.
   * [away, home]
   */
  pitcherPitchCount: [number, number];
  /**
   * Player IDs that have been substituted out (no-reentry rule) per team.
   * Once a player is in this set they may not re-enter the game.
   * [away, home]
   */
  substitutedOut: [string[], string[]];
  /**
   * Player IDs occupying each base. Index 0=1st, 1=2nd, 2=3rd.
   * null = empty or identity unknown (stock teams, older saves).
   */
  baseRunnerIds: [string | null, string | null, string | null];
  /**
   * Pre-computed flat mods per player per team. Derived from playerOverrides at setTeams time.
   * All fields are guaranteed to be numbers (defaulted to 0 if absent in playerOverrides).
   * [away, home]
   */
  resolvedMods: [Record<string, ResolvedPlayerMods>, Record<string, ResolvedPlayerMods>];
  /**
   * Per-team handedness lookup by player ID. Populated at setup time from custom rosters
   * and used by gameplay/manager logic to evaluate platoon matchups.
   */
  handednessByTeam: [Record<string, Handedness>, Record<string, Handedness>];
  /**
   * Per-game pitcher appearance log. Each entry accumulates stats for one pitcher appearance.
   * Indexed by [teamIdx][entryIndex] where teamIdx is the PITCHING team.
   * Updated incrementally during play; used to build PitcherGameStatDoc rows at FINAL.
   * Outer array: [away team pitchers (index 0), home team pitchers (index 1)].
   * Falls back to [[],[]] for older saves (backfilled by backfillRestoredState).
   */
  pitcherGameLog: [PitcherLogEntry[], PitcherLogEntry[]];
}

export interface ContextValue extends State {
  dispatch: React.Dispatch<GameAction>;
  dispatchLog: React.Dispatch<LogAction>;
  /** Play-by-play announcement log (most recent first). */
  log: string[];
}

export type GameAction = { type: string; payload?: unknown };
