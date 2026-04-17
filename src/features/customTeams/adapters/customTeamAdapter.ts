import type { Handedness, TeamCustomPlayerOverrides } from "@feat/gameplay/context/index";
import { BATTING_POSITIONS } from "@shared/utils/roster";

import type { TeamRecord, TeamWithRoster } from "@storage/types";

/**
 * Returns the stable game-session ID for a team.
 * In v1 all teams use their plain `ct_*` ID — no namespace prefix.
 */
export function customTeamToGameId(team: TeamWithRoster): string {
  return team.id;
}

/**
 * Returns the display name for a custom team (city + name, or just name).
 */
export function customTeamToDisplayName(team: TeamWithRoster): string {
  if (team.city) return `${team.city} ${team.name}`;
  return team.name;
}

/**
 * Maps the lineup section of a TeamWithRoster into the ordered array of
 * player IDs expected by the game's `lineupOrder` setup field.
 */
export function customTeamToLineupOrder(team: TeamWithRoster): string[] {
  return team.roster.lineup.map((p) => p.id);
}

/**
 * Returns the abbreviation for a custom team, or a safe short fallback.
 * Used by compact UI surfaces like the line score.
 *
 * @param gameId - The game-session team string (e.g. `"ct_123"`).
 * @param teams  - List of known custom team docs for lookup.
 */
export function customTeamToAbbreviation(
  gameId: string,
  teams: TeamWithRoster[],
): string | undefined {
  const doc = teams.find((t) => t.id === gameId);
  if (!doc) return undefined;
  if (doc.abbreviation) return doc.abbreviation;
  // Fallback: first 3 chars of team name (uppercase)
  return doc.name.trim().toUpperCase().slice(0, 3) || undefined;
}

/**
 * Returns the full display label for a team.
 * In v1 all team IDs are plain `ct_*` strings — looked up directly by ID.
 *
 * @param gameId  - The game-session team string (e.g. `"ct_123"`).
 * @param teams   - Known custom team docs for lookup.
 */
export function resolveTeamLabel(
  gameId: string,
  teams: Pick<TeamRecord, "id" | "name" | "city" | "abbreviation">[],
): string {
  const doc = teams.find((t) => t.id === gameId);
  if (!doc) return "Unknown Team";
  return doc.city ? `${doc.city} ${doc.name}` : doc.name;
}

/**
 * Replaces all team ID tokens in a string with their resolved display labels.
 * Used to sanitize free-text fields (save names, TTS strings) that may contain
 * raw `ct_*` team IDs.
 */
export function resolveCustomIdsInString(
  text: string,
  teams: Pick<TeamRecord, "id" | "name" | "city" | "abbreviation">[],
): string {
  return text.replace(/ct_[^\s"',]+/g, (id) => resolveTeamLabel(id, teams));
}

/**
 * Resolves human-readable team labels for a restored save's game state.
 *
 * The parameter uses `teamLabels?: [string, string]` (optional) rather than the
 * full `State` type because legacy saves may not carry this field at all at
 * runtime, even though `State` declares it as required. The optional shape
 * accurately reflects the actual runtime data coming from persisted snapshots.
 *
 * Legacy saves may lack `teamLabels` or carry raw game IDs as labels (when
 * `teamLabels` was auto-populated from the `teams` array before display names
 * were stored separately). In those cases the labels are resolved from the
 * current custom team docs so reducer log messages use readable names.
 * New saves that already carry display names are returned unchanged.
 */
export function resolveRestoreLabels(
  state: { teams: [string, string]; teamLabels?: [string, string] },
  customTeams: TeamWithRoster[],
): [string, string] {
  const existing = state.teamLabels;
  const needsResolution =
    !existing || existing.some((l, i) => typeof l === "string" && l === state.teams[i]);
  return needsResolution
    ? [resolveTeamLabel(state.teams[0], customTeams), resolveTeamLabel(state.teams[1], customTeams)]
    : existing;
}

type ModPreset = -20 | -10 | -5 | 0 | 5 | 10 | 20;

/** Rounds a raw offset to the nearest valid ModPreset value. */
function clampMod(offset: number): ModPreset {
  const presets: ModPreset[] = [-20, -10, -5, 0, 5, 10, 20];
  return presets.reduce((best, p) => (Math.abs(p - offset) < Math.abs(best - offset) ? p : best));
}

/**
 * Maps a TeamWithRoster's batting stats into the `TeamCustomPlayerOverrides`
 * shape consumed by the game's `setTeams` action.
 *
 * Stat modifier scale: the game uses ModPreset offsets (-20…+20) relative to
 * a baseline. For custom teams we store absolute stats (0–100), so we convert
 * by expressing each stat as an offset from 60 (the midpoint of 40–80 typical
 * range), clamped to valid ModPreset values.
 */
export function customTeamToPlayerOverrides(team: TeamWithRoster): TeamCustomPlayerOverrides {
  const overrides: TeamCustomPlayerOverrides = {};
  const allPlayers = [...team.roster.lineup, ...team.roster.bench, ...team.roster.pitchers];
  for (const player of allPlayers) {
    const staminaBase = player.pitching
      ? (player.pitching.stamina ?? 60)
      : (player.batting.stamina ?? 60);
    overrides[player.id] = {
      nickname: player.name,
      ...(player.position ? { position: player.position } : {}),
      ...(player.handedness ? { handedness: player.handedness } : {}),
      contactMod: clampMod(player.batting.contact - 60),
      powerMod: clampMod(player.batting.power - 60),
      speedMod: clampMod(player.batting.speed - 60),
      staminaMod: clampMod(staminaBase - 60),
      ...(player.pitching && {
        velocityMod: clampMod((player.pitching.velocity ?? 60) - 60),
        controlMod: clampMod((player.pitching.control ?? 60) - 60),
        movementMod: clampMod((player.pitching.movement ?? 60) - 60),
      }),
    };
  }
  return overrides;
}

/**
 * Returns a lookup of playerId -> handedness for every rostered player.
 * Players missing explicit handedness are omitted and resolved later via
 * deterministic fallback in gameplay.
 */
export function customTeamToHandednessMap(team: TeamWithRoster): Record<string, Handedness> {
  const handednessByPlayer: Record<string, Handedness> = {};
  const allPlayers = [...team.roster.lineup, ...team.roster.bench, ...team.roster.pitchers];
  for (const player of allPlayers) {
    if (player.handedness) handednessByPlayer[player.id] = player.handedness;
  }
  return handednessByPlayer;
}

/**
 * Returns the ordered list of bench player IDs for a custom team.
 * Used to populate `rosterBench` when a custom team game is started.
 */
export function customTeamToBenchRoster(team: TeamWithRoster): string[] {
  return team.roster.bench.map((p) => p.id);
}

/**
 * Returns the ordered list of pitcher IDs for a custom team.
 * Used to populate `rosterPitchers` when a custom team game is started.
 */
export function customTeamToPitcherRoster(team: TeamWithRoster): string[] {
  return team.roster.pitchers.map((p) => p.id);
}

/**
 * Validates a custom team document for use in a game.
 * Returns null if valid, or an error message string describing what's wrong.
 *
 * Used by NewGameDialog to block game start with invalid (including legacy) teams.
 */
export function validateCustomTeamForGame(team: TeamWithRoster): string | null {
  if (!team.name || !team.name.trim()) {
    return `Team has no name. Please edit it before starting a game.`;
  }
  const lineup = team.roster?.lineup ?? [];
  if (lineup.length === 0) {
    return `"${team.name}" has no lineup players. Edit the team to add batters before starting.`;
  }
  const pitchers = team.roster?.pitchers ?? [];
  if (pitchers.length === 0) {
    return `"${team.name}" has no pitchers. Edit the team to add at least one pitcher before starting.`;
  }
  // Validate each lineup player has a non-empty name.
  for (const player of lineup) {
    if (!player.name || !player.name.trim()) {
      return `"${team.name}" has a lineup player with no name. Edit the team to fix it before starting.`;
    }
  }
  // Validate each pitcher has a non-empty name.
  for (const pitcher of pitchers) {
    if (!pitcher.name || !pitcher.name.trim()) {
      return `"${team.name}" has a pitcher with no name. Edit the team to fix it before starting.`;
    }
  }
  // Validate starting lineup has exactly one of each required position (no duplicates, no missing).
  const lineupPosCounts = new Map<string, number>();
  for (const player of lineup) {
    const pos = player.position ?? "";
    if (pos) lineupPosCounts.set(pos, (lineupPosCounts.get(pos) ?? 0) + 1);
  }
  const duplicatePos = BATTING_POSITIONS.filter((pos) => (lineupPosCounts.get(pos) ?? 0) > 1);
  const missingPos = BATTING_POSITIONS.filter((pos) => !lineupPosCounts.has(pos));
  if (duplicatePos.length > 0) {
    return `"${team.name}" starting lineup has duplicate position(s): ${duplicatePos.join(", ")}. Edit the team to fix it.`;
  }
  if (missingPos.length > 0) {
    return `"${team.name}" starting lineup is missing position(s): ${missingPos.join(", ")}. Edit the team to fix it.`;
  }
  return null;
}
