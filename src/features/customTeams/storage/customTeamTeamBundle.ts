import { fnv1a } from "@storage/hash";
import type { CustomTeamDoc, ExportedCustomTeams, TeamPlayer } from "@storage/types";

import {
  buildPlayerSig,
  buildTeamFingerprint,
  CUSTOM_TEAM_EXPORT_FORMAT_VERSION,
  stripPlayerSig,
  type TeamPlayerWithSig,
  TEAMS_EXPORT_KEY,
} from "./customTeamSignatures";

/** Attaches a `sig` to every player in the array. */
function signPlayers(players: TeamPlayer[]): TeamPlayer[] {
  return players.map((p) => ({ ...stripPlayerSig(p), sig: buildPlayerSig(p) }));
}

/**
 * Serializes teams into a portable signed JSON string.
 *
 * Signing order (important — bundle sig must cover player sigs):
 *   1. Compute each team's fingerprint.
 *   2. Compute per-player sigs over immutable player identity fields (name, role, stats).
 *   3. Compute the bundle-level sig over the whole payload (which now includes player sigs).
 */
export function exportCustomTeams(teams: CustomTeamDoc[]): string {
  const signedTeams = teams.map((team) => {
    const fingerprint = buildTeamFingerprint(team);
    return {
      ...team,
      fingerprint, // always embed for team-level duplicate detection on import
      roster: {
        ...team.roster,
        lineup: signPlayers(team.roster.lineup),
        bench: signPlayers(team.roster.bench),
        pitchers: signPlayers(team.roster.pitchers),
      },
    };
  });
  const payload = { teams: signedTeams };
  const sig = fnv1a(TEAMS_EXPORT_KEY + JSON.stringify(payload));
  const bundle: ExportedCustomTeams = {
    type: "customTeams",
    formatVersion: CUSTOM_TEAM_EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    payload,
    sig,
  };
  return JSON.stringify(bundle, null, 2);
}

/**
 * Parses and validates a custom-teams export JSON string.
 * Performs checks in order: (1) structural validation, (2) bundle-level FNV-1a
 * signature, (3) per-player signatures. Throws a descriptive error on any failure.
 */
export function parseExportedCustomTeams(json: string): ExportedCustomTeams {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Invalid JSON: could not parse custom teams file");
  }
  if (!parsed || typeof parsed !== "object")
    throw new Error("Invalid custom teams file: not an object");
  const obj = parsed as Record<string, unknown>;

  const INVALID_FORMAT_MSG =
    "Invalid custom teams file: missing or unrecognized format. Make sure to export using the BlipIt Baseball Legends app (Export All Teams or Export a single team).";
  if (typeof obj["formatVersion"] !== "number") throw new Error(INVALID_FORMAT_MSG);
  if (typeof obj["type"] !== "string") throw new Error(INVALID_FORMAT_MSG);
  if (obj["type"] !== "customTeams")
    throw new Error(`Invalid custom teams file: expected type "customTeams", got "${obj["type"]}"`);
  if (obj["formatVersion"] !== 1)
    throw new Error(
      `Invalid custom teams file (unsupported format version: ${obj["formatVersion"]}). ` +
        `Make sure to export using the BlipIt Baseball Legends app (Export All Teams or Export a single team).`,
    );
  if (!obj["payload"] || typeof obj["payload"] !== "object")
    throw new Error("Invalid custom teams file: missing payload");

  const payload = obj["payload"] as Record<string, unknown>;
  if (!Array.isArray(payload["teams"]))
    throw new Error("Invalid custom teams file: payload.teams must be an array");

  // ── Structural validation ──────────────────────────────────────────────────
  (payload["teams"] as unknown[]).forEach((t, i) => {
    if (!t || typeof t !== "object") throw new Error(`Team[${i}] is not an object`);
    const team = t as Record<string, unknown>;
    if (typeof team["id"] !== "string" || !team["id"])
      throw new Error(`Team[${i}] missing required field: id`);
    if (typeof team["name"] !== "string" || !team["name"])
      throw new Error(`Team[${i}] missing required field: name`);
    if (typeof team["source"] !== "string")
      throw new Error(`Team[${i}] missing required field: source`);
    // fingerprint is optional for legacy files (pre-v2 exports without fingerprints)
    if (!team["roster"] || typeof team["roster"] !== "object")
      throw new Error(`Team[${i}] missing required field: roster`);
    const roster = team["roster"] as Record<string, unknown>;
    if (!Array.isArray(roster["lineup"]) || (roster["lineup"] as unknown[]).length === 0)
      throw new Error(`Team[${i}] roster.lineup must be a non-empty array`);
  });

  // ── 1. Bundle signature ────────────────────────────────────────────────────
  const expectedBundleSig = fnv1a(TEAMS_EXPORT_KEY + JSON.stringify(obj["payload"]));
  if (typeof obj["sig"] !== "string" || obj["sig"] !== expectedBundleSig)
    throw new Error(
      "Teams signature mismatch — file may be corrupted or not a valid BlipIt Baseball Legends teams export",
    );

  // ── 2. Per-player signatures ───────────────────────────────────────────────
  (payload["teams"] as Record<string, unknown>[]).forEach((team, ti) => {
    const roster = team["roster"] as Record<string, unknown>;
    (["lineup", "bench", "pitchers"] as const).forEach((slot) => {
      const slotValue = roster[slot] ?? [];
      if (!Array.isArray(slotValue)) {
        throw new Error(`Team[${ti}] roster.${slot} is not an array — file may be malformed`);
      }
      (slotValue as unknown[]).forEach((rawPlayer, pi) => {
        // Structural validation: each player must be an object with required fields
        // before calling buildPlayerSig to avoid non-descriptive runtime errors.
        if (!rawPlayer || typeof rawPlayer !== "object") {
          throw new Error(`Team[${ti}] ${slot}[${pi}] is not an object — file may be malformed`);
        }
        const p = rawPlayer as Record<string, unknown>;
        if (typeof p["id"] !== "string" || !p["id"])
          throw new Error(`Team[${ti}] ${slot}[${pi}] missing required field: id`);
        if (typeof p["name"] !== "string" || !p["name"])
          throw new Error(`Team[${ti}] ${slot}[${pi}] missing required field: name`);
        if (typeof p["role"] !== "string" || !["batter", "pitcher", "two-way"].includes(p["role"]))
          throw new Error(
            `Team[${ti}] ${slot}[${pi}] invalid role "${p["role"]}" — must be "batter", "pitcher", or "two-way"`,
          );
        if (!p["batting"] || typeof p["batting"] !== "object")
          throw new Error(`Team[${ti}] ${slot}[${pi}] missing required field: batting`);

        const player = rawPlayer as TeamPlayerWithSig;
        // Skip sig validation for legacy files that pre-date per-player signatures.
        if (player.sig === undefined) return;
        const expectedPlayerSig = buildPlayerSig(player);
        if (player.sig !== expectedPlayerSig) {
          throw new Error(
            `Team[${ti}] ${slot}[${pi}] player signature mismatch — ` +
              `player data may have been tampered with after export`,
          );
        }
      });
    });
  });

  return parsed as ExportedCustomTeams;
}
