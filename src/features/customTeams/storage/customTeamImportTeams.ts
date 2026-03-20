import { generatePlayerId, generateTeamId } from "@storage/generateId";
import type { TeamPlayer, TeamWithRoster } from "@storage/types";

import {
  type ImportCustomTeamsOptions,
  type ImportCustomTeamsResult,
  type ImportIdFactories,
  preScanForDuplicatePlayers,
} from "./customTeamImportPrescan";
import { clampPlayerStats } from "./customTeamSanitizers";
import { buildPlayerSig, buildTeamFingerprint, stripTeamPlayerSigs } from "./customTeamSignatures";
import { parseExportedCustomTeams } from "./customTeamTeamBundle";

// Re-export types so existing `import { ... } from "./customTeamImportTeams"` callers are unaffected.
export type { ImportCustomTeamsOptions, ImportCustomTeamsResult, ImportIdFactories };

function remapPlayerIds(
  players: TeamPlayer[],
  existingPlayerIds: Set<string>,
  makeId: () => string,
): { players: TeamPlayer[]; hadCollision: boolean } {
  let hadCollision = false;
  const remapped = players.map((p) => {
    if (existingPlayerIds.has(p.id)) {
      hadCollision = true;
      const newId = makeId();
      existingPlayerIds.add(newId);
      return { ...p, id: newId };
    }
    // Mark as in-use so later slots in the same team cannot reuse this ID,
    // preventing intra-team cross-slot duplicate player IDs after import.
    existingPlayerIds.add(p.id);
    return p;
  });
  return { players: remapped, hadCollision };
}

/**
 * Merges incoming teams into the local collection.
 *
 * - ID collisions (team or player): remapped silently with new IDs.
 * - Team fingerprint matches: silently skipped and counted in `skipped` (not in `duplicateWarnings`).
 * - Player sig matches: reported in `duplicatePlayerWarnings` so the UI can prompt the user.
 * - Player `sig` fields are stripped from the output so they are not stored in the DB.
 * - When `options.allowDuplicatePlayers` is false (the default) and duplicate players are
 *   found, the import is blocked: `teams` is empty and `requiresDuplicateConfirmation` is
 *   true. Re-call with `{ allowDuplicatePlayers: true }` after the user confirms.
 *
 * **Legacy bundle limitation:** Players in legacy export bundles (pre-v2, no per-player `sig`
 * or stable `id`-based fingerprint) will have their sig recomputed using the bundle's player
 * `id` as the entropy source. If the ID was remapped between export and re-import, duplicate
 * detection will miss the match. This is intentional — legacy files may not have a stable `id`
 * that matches the stored fingerprint.
 *
 * **Legacy team fingerprint limitation:** Teams in legacy bundles lack a `team.fingerprint`
 * field, so the pre-scan falls back to `buildTeamFingerprint(team)` using the team's `id`.
 * A previously-imported legacy team will have been assigned a new `id` on import, so the
 * stored fingerprint will not match a re-import of the same legacy bundle with different IDs.
 * As a result, re-importing a legacy teams bundle may not be blocked by the pre-scan's
 * team-fingerprint check, and teams may be duplicated.
 */
export function importCustomTeams(
  json: string,
  existingTeams: TeamWithRoster[],
  factories?: ImportIdFactories,
  options?: ImportCustomTeamsOptions,
): ImportCustomTeamsResult {
  const parsed = parseExportedCustomTeams(json);
  const makeTeamId = factories?.makeTeamId ?? generateTeamId;
  const makePlayerId = factories?.makePlayerId ?? generatePlayerId;

  const existingTeamIds = new Set(existingTeams.map((t) => t.id));
  const existingPlayerIds = new Set(
    existingTeams.flatMap((t) => [
      ...t.roster.lineup.map((p) => p.id),
      ...(t.roster.bench ?? []).map((p) => p.id),
      ...t.roster.pitchers.map((p) => p.id),
    ]),
  );
  const existingFingerprints = new Map(
    existingTeams.map((t) => [t.fingerprint ?? buildTeamFingerprint(t), t.name]),
  );

  // Pre-compute player sigs for all existing players so we can detect duplicates.
  // Use the stored `fingerprint` when available (canonical, avoids recomputation);
  // fall back to `buildPlayerSig(p)` for players that lack a stored fingerprint.
  const existingPlayerSigs = new Set<string>();
  for (const t of existingTeams) {
    for (const p of [...t.roster.lineup, ...(t.roster.bench ?? []), ...t.roster.pitchers]) {
      existingPlayerSigs.add(p.fingerprint ?? buildPlayerSig(p));
    }
  }

  // ── Pre-scan: detect duplicate players before committing any imports ────────
  const allowDuplicates = options?.allowDuplicatePlayers ?? false;
  const preScan = preScanForDuplicatePlayers(
    parsed.payload.teams as TeamWithRoster[],
    existingFingerprints,
    existingPlayerSigs,
  );

  if (preScan.warnings.length > 0 && !allowDuplicates) {
    // Note: `skipped` here only counts fingerprint-matched teams from the pre-scan loop.
    // It does NOT equal the `skipped` count that the main loop would produce (the import
    // is blocked before reaching the main loop). Callers should treat this partial count
    // as informational and re-run to get the final `skipped` count after user confirmation.
    return {
      teams: [],
      created: 0,
      remapped: 0,
      skipped: preScan.skippedCount,
      duplicateWarnings: [],
      duplicatePlayerWarnings: preScan.warnings,
      requiresDuplicateConfirmation: true,
    };
  }

  let created = 0;
  let remapped = 0;
  let skipped = 0;
  const duplicateWarnings: string[] = [];
  const duplicatePlayerWarnings: string[] = [];

  const resultTeams: TeamWithRoster[] = [];

  for (const team of parsed.payload.teams) {
    // ── Early exact-duplicate check ────────────────────────────────────────────
    // If the incoming team's content fingerprint already exists locally, skip it
    // entirely to prevent creating a duplicate entry. The fingerprint is id-
    // based (name + abbreviation + id) so it is stable as long as the same id
    // is used across re-exports.
    const incomingFp = team.fingerprint ?? buildTeamFingerprint(team as TeamWithRoster);
    if (existingFingerprints.has(incomingFp)) {
      skipped++;
      continue;
    }
    // Register this fingerprint immediately so that a later team in the same
    // bundle with identical content is also skipped (intra-bundle deduplication).
    existingFingerprints.set(incomingFp, team.name);

    let finalTeam = { ...team };
    let anyIdCollision = false;

    // ── Duplicate player detection (before ID remapping, using sigs from export) ──
    const allSlotPlayers: { player: TeamPlayer; slot: string }[] = [
      ...team.roster.lineup.map((p) => ({ player: p, slot: "lineup" })),
      ...(team.roster.bench ?? []).map((p) => ({ player: p, slot: "bench" })),
      ...(team.roster.pitchers ?? []).map((p) => ({ player: p, slot: "pitchers" })),
    ];
    for (const { player } of allSlotPlayers) {
      // Clamp stats before computing the comparison sig — the storage path always
      // clamps first and recomputes the fingerprint, so we must compare against the
      // same clamped shape to avoid missed or spurious duplicate warnings.
      const pSig = buildPlayerSig(clampPlayerStats(player));
      if (existingPlayerSigs.has(pSig)) {
        duplicatePlayerWarnings.push(
          `Player "${player.name}" in "${team.name}" may already exist in your teams.`,
        );
      }
    }

    // ── Team ID collision ──────────────────────────────────────────────────────
    if (existingTeamIds.has(finalTeam.id)) {
      finalTeam = { ...finalTeam, id: makeTeamId() };
      anyIdCollision = true;
    }
    // Register the (possibly-remapped) team ID so later teams in the same bundle
    // cannot reuse it, preventing intra-bundle team ID collisions.
    existingTeamIds.add(finalTeam.id);

    // ── Player ID collision ────────────────────────────────────────────────────
    const lineupResult = remapPlayerIds(finalTeam.roster.lineup, existingPlayerIds, makePlayerId);
    const benchResult = remapPlayerIds(
      finalTeam.roster.bench ?? [],
      existingPlayerIds,
      makePlayerId,
    );
    const pitchersResult = remapPlayerIds(
      finalTeam.roster.pitchers ?? [],
      existingPlayerIds,
      makePlayerId,
    );

    if (lineupResult.hadCollision || benchResult.hadCollision || pitchersResult.hadCollision) {
      anyIdCollision = true;
    }

    finalTeam = {
      ...finalTeam,
      roster: {
        ...finalTeam.roster,
        lineup: lineupResult.players,
        bench: benchResult.players,
        pitchers: pitchersResult.players,
      },
    };

    if (anyIdCollision) {
      remapped++;
    } else {
      created++;
    }

    finalTeam = { ...finalTeam, fingerprint: buildTeamFingerprint(finalTeam) };

    // Strip player sigs — export-only integrity metadata, not stored in DB.
    resultTeams.push(stripTeamPlayerSigs(finalTeam));
  }

  return {
    teams: resultTeams,
    created,
    remapped,
    skipped,
    duplicateWarnings,
    duplicatePlayerWarnings,
    requiresDuplicateConfirmation: false,
  };
}
