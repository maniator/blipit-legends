import { HITTER_STAT_CAP, PITCHER_STAT_CAP } from "@feat/customTeams/statBudget";

import { generateSeed } from "@storage/generateId";
import { fnv1a } from "@storage/hash";
import type { TeamPlayer, TeamRoster } from "@storage/types";

import { buildPlayerSig } from "./customTeamSignatures";

export { HITTER_STAT_CAP, PITCHER_STAT_CAP };

export const STAT_MIN = 0;
export const STAT_MAX = 100;
export const ROSTER_SCHEMA_VERSION = 1;

export function requireNonEmpty(value: unknown, fieldPath: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldPath} must be a non-empty string`);
  }
  return value.trim();
}

/**
 * Sanitizes an abbreviation: trims, uppercases, and enforces 2–3 characters.
 * Throws if the result is outside that range so stored docs are always valid.
 */
export function sanitizeAbbreviation(value: string): string {
  const abbr = value.trim().toUpperCase();
  if (abbr.length < 2 || abbr.length > 3) {
    throw new Error(`abbreviation must be 2–3 characters (got "${abbr}")`);
  }
  return abbr;
}

/**
 * Clamps a stat value to [STAT_MIN, STAT_MAX].
 * Non-finite inputs (NaN, Infinity, null, undefined coerced via Number) default
 * to STAT_MIN so a crafted import bundle cannot bypass cap checks with NaN totals.
 */
export function clampStat(value: number): number {
  const n = Number(value);
  const finite = Number.isFinite(n) ? n : STAT_MIN;
  return Math.max(STAT_MIN, Math.min(STAT_MAX, finite));
}

/**
 * Returns a new player object with all individual stats clamped to [STAT_MIN, STAT_MAX].
 * Does not validate totals — call `validatePlayerStatCaps` after this if needed.
 */
export function clampPlayerStats(player: TeamPlayer): TeamPlayer {
  return {
    ...player,
    batting: {
      contact: clampStat(player.batting.contact),
      power: clampStat(player.batting.power),
      speed: clampStat(player.batting.speed),
    },
    ...(player.pitching && {
      pitching: {
        ...(player.pitching.velocity !== undefined && {
          velocity: clampStat(player.pitching.velocity),
        }),
        ...(player.pitching.control !== undefined && {
          control: clampStat(player.pitching.control),
        }),
        ...(player.pitching.movement !== undefined && {
          movement: clampStat(player.pitching.movement),
        }),
      },
    }),
  };
}

/**
 * Validates that a player's stat totals do not exceed the enforced caps:
 * - Hitter cap (HITTER_STAT_CAP): contact + power + speed ≤ 150 (non-pitchers)
 * - Pitcher cap (PITCHER_STAT_CAP): velocity + control + movement ≤ 160 (non-batters)
 *
 * Called after individual stats are clamped to 0–100 so that clamping always
 * runs first and the cap is the final gate.
 * Throws an Error with a message containing "stat cap" if the total exceeds the cap.
 *
 * @param section - Roster section name used in the error message (e.g. "lineup", "bench",
 *   "pitchers"). Defaults to "player" for backward-compatible direct calls.
 * @param index - Zero-based position of the player within the section.
 */
export function validatePlayerStatCaps(
  player: TeamPlayer,
  section: string,
  index: number,
): void {
  if (player.role !== "pitcher") {
    const { contact, power, speed } = player.batting;
    const total = contact + power + speed;
    if (total > HITTER_STAT_CAP) {
      throw new Error(
        `roster ${section}[${index}] batting stat cap exceeded: ` +
          `contact(${contact}) + power(${power}) + speed(${speed}) = ${total} > ${HITTER_STAT_CAP}`,
      );
    }
  }
  if (player.role !== "batter" && player.pitching) {
    const { velocity = 0, control = 0, movement = 0 } = player.pitching;
    const total = velocity + control + movement;
    if (total > PITCHER_STAT_CAP) {
      throw new Error(
        `roster ${section}[${index}] pitching stat cap exceeded: ` +
          `velocity(${velocity}) + control(${control}) + movement(${movement}) = ${total} > ${PITCHER_STAT_CAP}`,
      );
    }
  }
}

export function sanitizePlayer(player: TeamPlayer, index: number, section = "player"): TeamPlayer {
  const name = requireNonEmpty(player.name, `roster ${section}[${index}].name`);
  if (!["batter", "pitcher", "two-way"].includes(player.role)) {
    throw new Error(`roster ${section}[${index}].role must be "batter", "pitcher", or "two-way"`);
  }
  if (!player.batting || typeof player.batting !== "object") {
    throw new Error(`roster ${section}[${index}].batting is required`);
  }
  const sanitized: TeamPlayer = {
    ...player,
    name,
    batting: {
      contact: clampStat(Number(player.batting.contact) || 0),
      power: clampStat(Number(player.batting.power) || 0),
      speed: clampStat(Number(player.batting.speed) || 0),
    },
    ...(player.pitching && {
      pitching: {
        ...(player.pitching.velocity !== undefined && {
          velocity: clampStat(Number(player.pitching.velocity) || 0),
        }),
        ...(player.pitching.control !== undefined && {
          control: clampStat(Number(player.pitching.control) || 0),
        }),
        ...(player.pitching.movement !== undefined && {
          movement: clampStat(Number(player.pitching.movement) || 0),
        }),
      },
    }),
  };
  // Enforce stat caps AFTER clamping so individual-stat clamping always runs first.
  // e.g. {contact:150, power:0, speed:50} → clamps to {100,0,50} = 150 (valid).
  validatePlayerStatCaps(sanitized, section, index);
  // Preserve the existing playerSeed or generate a new one at creation time.
  // The seed is stored permanently so the fingerprint can be re-verified.
  const playerSeed = player.playerSeed ?? generateSeed();
  // Always persist a content fingerprint so global duplicate detection works
  // without re-reading all teams. The fingerprint covers the immutable identity
  // fields (name, role, batting, pitching) plus the per-player seed.
  const fingerprint = buildPlayerSig({ ...sanitized, playerSeed });
  // Derive a stable team-independent identity from the player's seed.
  // "pl_" prefix distinguishes it from team IDs and raw nanoid strings.
  // Using fnv1a(playerSeed) means the same player always gets the same globalPlayerId
  // regardless of which team they belong to, enabling cross-team career aggregation.
  const globalPlayerId = player.globalPlayerId ?? `pl_${fnv1a(playerSeed)}`;
  return { ...sanitized, playerSeed, fingerprint, globalPlayerId };
}

export function buildRoster(input: {
  lineup: TeamPlayer[];
  bench?: TeamPlayer[];
  pitchers?: TeamPlayer[];
}): TeamRoster {
  if (!Array.isArray(input.lineup) || input.lineup.length < 1) {
    throw new Error("roster.lineup must have at least 1 player");
  }
  return {
    schemaVersion: ROSTER_SCHEMA_VERSION,
    lineup: input.lineup.map((p, i) => sanitizePlayer(p, i, "lineup")),
    bench: (input.bench ?? []).map((p, i) => sanitizePlayer(p, i, "bench")),
    pitchers: (input.pitchers ?? []).map((p, i) => sanitizePlayer(p, i, "pitchers")),
  };
}
