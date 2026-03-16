import { fnv1a } from "@storage/hash";
import type { TeamPlayer } from "@storage/types";

import {
  buildPlayerSig,
  PLAYER_EXPORT_FORMAT_VERSION,
  PLAYER_EXPORT_KEY,
  stripPlayerSig,
} from "./customTeamSignatures";

/**
 * Result shape returned by `CustomTeamStore.importPlayer`.
 *
 * Exactly one of the following statuses is returned for each call:
 *   - `{ status: "success" }` — player was appended to the target roster section.
 *   - `{ status: "alreadyOnThisTeam" }` — player's `globalPlayerId` already existed on the
 *     target team; no change was made (idempotent).
 *   - `{ status: "conflict", conflictingTeamId, conflictingTeamName }` — player's
 *     `globalPlayerId` already exists on a *different* team; import was blocked to
 *     prevent duplicate identities.
 */
export type ImportPlayerResult =
  | {
      /** Player was successfully added to the target team. */
      status: "success";
      /**
       * The local `id` the player was appended with. This may differ from the `id` in the
       * import bundle if there was a collision with an existing player in the target roster.
       * UI callers should use this value to keep their in-memory editor state aligned with
       * what was persisted in the DB.
       */
      finalLocalId: string;
    }
  | {
      /**
       * Player already belongs to the target team — no change was made.
       * The caller may treat this as a silent no-op or show a short informational message.
       */
      status: "alreadyOnThisTeam";
    }
  | {
      /**
       * Player's `globalPlayerId` already exists on a different team.
       * The import is blocked and the caller should surface `conflictingTeamName` to
       * the user so they can remove the player from their current team first.
       */
      status: "conflict";
      /** Identifier of the team that currently owns the player. */
      conflictingTeamId: string;
      /** Human-readable display name of the team that currently owns the player. */
      conflictingTeamName: string;
    };

/**
 * Serializes a single player into a portable signed JSON string.
 * The player gets a `sig` field covering its immutable identity fields, and
 * the bundle gets its own FNV-1a signature so tampering is detectable on import.
 */
export function exportCustomPlayer(player: TeamPlayer): string {
  const playerWithSig: TeamPlayer & { sig: string } = {
    ...stripPlayerSig(player),
    sig: buildPlayerSig(player),
  };
  const payload = { player: playerWithSig };
  const sig = fnv1a(PLAYER_EXPORT_KEY + JSON.stringify(payload));
  const bundle = {
    type: "customPlayer" as const,
    formatVersion: PLAYER_EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    payload,
    sig,
  };
  return JSON.stringify(bundle, null, 2);
}

/**
 * Parses and validates a single-player export JSON string.
 * Verifies both the bundle-level FNV-1a signature and the per-player content
 * signature. Throws a descriptive error on any validation failure.
 * Returns the player with `sig` stripped (not stored in DB).
 */
export function parseExportedCustomPlayer(json: string): TeamPlayer {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Invalid JSON: could not parse player file");
  }
  if (!parsed || typeof parsed !== "object") throw new Error("Invalid player file: not an object");
  const obj = parsed as Record<string, unknown>;

  if (obj["type"] !== "customPlayer")
    throw new Error(
      `Invalid player file: expected type "customPlayer", got "${obj["type"] as string}"`,
    );
  if (obj["formatVersion"] !== 1)
    throw new Error(`Unsupported player format version: ${obj["formatVersion"] as number}`);
  if (!obj["payload"] || typeof obj["payload"] !== "object")
    throw new Error("Invalid player file: missing payload");

  const payload = obj["payload"] as Record<string, unknown>;
  if (!payload["player"] || typeof payload["player"] !== "object")
    throw new Error("Invalid player file: missing payload.player");

  const playerObj = payload["player"] as Record<string, unknown>;
  if (typeof playerObj["id"] !== "string" || !playerObj["id"])
    throw new Error("Invalid player file: missing required field: id");
  if (typeof playerObj["name"] !== "string" || !playerObj["name"])
    throw new Error("Invalid player file: missing required field: name");
  if (typeof playerObj["role"] !== "string")
    throw new Error("Invalid player file: missing required field: role");
  if (!["batter", "pitcher", "two-way"].includes(playerObj["role"] as string))
    throw new Error(
      `Invalid player file: invalid role "${playerObj["role"] as string}" — must be "batter", "pitcher", or "two-way"`,
    );
  if (!playerObj["batting"] || typeof playerObj["batting"] !== "object")
    throw new Error("Invalid player file: missing required field: batting");

  // ── Bundle signature ───────────────────────────────────────────────────────
  const expectedBundleSig = fnv1a(PLAYER_EXPORT_KEY + JSON.stringify(obj["payload"]));
  if (typeof obj["sig"] !== "string" || obj["sig"] !== expectedBundleSig)
    throw new Error(
      "Player signature mismatch — file may be corrupted or not a valid BlipIt Baseball Legends player export",
    );

  // ── Per-player content signature ───────────────────────────────────────────
  // Note: unlike the teams import path (which skips sig validation when player.sig is
  // undefined for legacy pre-v2 bundles), single-player bundles always require a sig
  // because exportCustomPlayer is new in this codebase — no legacy single-player files exist.
  const player = payload["player"] as TeamPlayer & { sig?: string };
  const expectedPlayerSig = buildPlayerSig(player);
  if (player.sig !== expectedPlayerSig)
    throw new Error("Player content signature mismatch — player data may have been tampered with");

  // Return the player with `sig` stripped — export-only metadata, not stored in DB.
  return stripPlayerSig(player);
}
