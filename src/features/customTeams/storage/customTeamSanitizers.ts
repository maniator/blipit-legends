import { HITTER_STAT_CAP, PITCHER_STAT_CAP } from "@feat/customTeams/statBudget";

import { generatePlayerId } from "@storage/generateId";
import type { TeamPlayer, TeamRoster } from "@storage/types";

import { buildPlayerSig } from "./customTeamSignatures";

export { HITTER_STAT_CAP, PITCHER_STAT_CAP };

export const STAT_MIN = 0;
export const STAT_MAX = 100;
export const ROSTER_SCHEMA_VERSION = 1;
export const DEFAULT_BATTING_STAMINA = 50;
export const DEFAULT_PITCHING_STAMINA = 60;

export function requireNonEmpty(value: unknown, fieldPath: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldPath} must be a non-empty string`);
  }
  return value.trim();
}

function requireFiniteNumber(value: unknown, fieldPath: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${fieldPath} must be a finite number`);
  }
  return value;
}

function requireHandedness(value: unknown, fieldPath: string): "R" | "L" | "S" {
  if (value !== "R" && value !== "L" && value !== "S") {
    throw new Error(`${fieldPath} must be one of "R", "L", or "S"`);
  }
  return value;
}

function sanitizeOptionalBoolean(value: unknown, fieldPath: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") {
    throw new Error(`${fieldPath} must be a boolean`);
  }
  return value;
}

function sanitizeOptionalJerseyNumber(
  value: unknown,
  fieldPath: string,
): number | null | undefined {
  if (value === undefined || value === null) return value;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${fieldPath} must be a finite number or null`);
  }
  return value;
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
  const clampedBatting = (batting: NonNullable<TeamPlayer["batting"]>) => ({
    contact: clampStat(batting.contact),
    power: clampStat(batting.power),
    speed: clampStat(batting.speed),
    stamina: clampStat(batting.stamina ?? DEFAULT_BATTING_STAMINA),
  });

  const clampedPitching = (pitching: NonNullable<TeamPlayer["pitching"]>) => ({
    velocity: clampStat(pitching.velocity),
    control: clampStat(pitching.control),
    movement: clampStat(pitching.movement),
    stamina: clampStat(pitching.stamina ?? DEFAULT_PITCHING_STAMINA),
  });

  if (player.role === "pitcher") {
    return {
      ...player,
      pitching: clampedPitching(player.pitching),
    };
  }

  return {
    ...player,
    batting: clampedBatting(player.batting),
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
 * @param options.section - Roster section name used in the error message (e.g. "lineup",
 *   "bench", "pitchers").
 * @param options.index - Zero-based position of the player within the section.
 */
export interface ValidatePlayerStatCapsOptions {
  section: string;
  index: number;
}

export function validatePlayerStatCaps(
  player: TeamPlayer,
  { section, index }: ValidatePlayerStatCapsOptions,
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

export interface SanitizePlayerOptions {
  index: number;
  section?: string;
}

export function sanitizePlayer(
  player: TeamPlayer,
  { index, section = "player" }: SanitizePlayerOptions,
): TeamPlayer {
  const name = requireNonEmpty(player.name, `roster ${section}[${index}].name`);
  const position = requireNonEmpty(player.position, `roster ${section}[${index}].position`);
  const handedness = requireHandedness(player.handedness, `roster ${section}[${index}].handedness`);
  if (player.role !== "batter" && player.role !== "pitcher") {
    throw new Error(`roster ${section}[${index}].role must be "batter" or "pitcher"`);
  }
  if (player.role === "batter" && (!player.batting || typeof player.batting !== "object")) {
    throw new Error(`roster ${section}[${index}].batting is required`);
  }
  if (player.role === "pitcher" && (!player.pitching || typeof player.pitching !== "object")) {
    throw new Error(`roster ${section}[${index}].pitching is required`);
  }
  const sanitizedBase = {
    id: player.id,
    name,
    position,
    handedness,
    isBenchEligible: sanitizeOptionalBoolean(
      player.isBenchEligible,
      `roster ${section}[${index}].isBenchEligible`,
    ),
    isPitcherEligible: sanitizeOptionalBoolean(
      player.isPitcherEligible,
      `roster ${section}[${index}].isPitcherEligible`,
    ),
    jerseyNumber: sanitizeOptionalJerseyNumber(
      player.jerseyNumber,
      `roster ${section}[${index}].jerseyNumber`,
    ),
    fingerprint: player.fingerprint,
    sig: player.sig,
  };

  const sanitizeBatting = (batting: NonNullable<TeamPlayer["batting"]>) => ({
    contact: clampStat(
      requireFiniteNumber(batting.contact, `roster ${section}[${index}].batting.contact`),
    ),
    power: clampStat(
      requireFiniteNumber(batting.power, `roster ${section}[${index}].batting.power`),
    ),
    speed: clampStat(
      requireFiniteNumber(batting.speed, `roster ${section}[${index}].batting.speed`),
    ),
    stamina: clampStat(
      requireFiniteNumber(batting.stamina, `roster ${section}[${index}].batting.stamina`),
    ),
  });

  const sanitizePitching = (pitching: NonNullable<TeamPlayer["pitching"]>) => ({
    velocity: clampStat(
      requireFiniteNumber(pitching.velocity, `roster ${section}[${index}].pitching.velocity`),
    ),
    control: clampStat(
      requireFiniteNumber(pitching.control, `roster ${section}[${index}].pitching.control`),
    ),
    movement: clampStat(
      requireFiniteNumber(pitching.movement, `roster ${section}[${index}].pitching.movement`),
    ),
    stamina: clampStat(
      requireFiniteNumber(pitching.stamina, `roster ${section}[${index}].pitching.stamina`),
    ),
  });

  const pitchingRole = player.role === "pitcher" ? player.pitchingRole : undefined;
  if (
    pitchingRole !== undefined &&
    pitchingRole !== "SP" &&
    pitchingRole !== "RP" &&
    pitchingRole !== "SP/RP"
  ) {
    throw new Error(
      `roster ${section}[${index}].pitchingRole must be "SP", "RP", "SP/RP", or undefined — got "${String(pitchingRole)}"`,
    );
  }

  const sanitized: TeamPlayer =
    player.role === "pitcher"
      ? {
          ...sanitizedBase,
          role: "pitcher",
          pitching: sanitizePitching(player.pitching),
          pitchingRole,
        }
      : {
          ...sanitizedBase,
          role: "batter",
          batting: sanitizeBatting(player.batting),
        };
  // Enforce stat caps AFTER clamping so individual-stat clamping always runs first.
  // e.g. {contact:150, power:0, speed:50} → clamps to {100,0,50} = 150 (valid).
  validatePlayerStatCaps(sanitized, { section, index });
  // Preserve stable imported IDs to keep long-term player identity intact.
  // Only editor-temporary IDs (ep_*) or empty IDs are remapped to a fresh DB ID.
  const incomingId = typeof player.id === "string" ? player.id.trim() : "";
  const resolvedId =
    incomingId.length > 0 && !incomingId.startsWith("ep_") ? incomingId : generatePlayerId();
  const fingerprint = buildPlayerSig(sanitized);
  return { ...sanitized, id: resolvedId, fingerprint };
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
    lineup: input.lineup.map((p, i) => sanitizePlayer(p, { index: i, section: "lineup" })),
    bench: (input.bench ?? []).map((p, i) => sanitizePlayer(p, { index: i, section: "bench" })),
    pitchers: (input.pitchers ?? []).map((p, i) =>
      sanitizePlayer(p, { index: i, section: "pitchers" }),
    ),
  };
}
