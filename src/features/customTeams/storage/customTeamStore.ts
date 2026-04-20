import { type BallgameDb, getDb } from "@storage/db";
import { generateTeamId } from "@storage/generateId";
import type {
  CreateCustomTeamInput,
  CustomTeamMetadata,
  PlayerRecord,
  TeamRecord,
  TeamWithRoster,
  UpdateCustomTeamInput,
} from "@storage/types";

import { buildNewTeamDoc } from "./customTeamDocBuilder";
import {
  buildTeamFingerprint,
  exportCustomPlayer as exportCustomPlayerJson,
  exportCustomTeams as exportCustomTeamsJson,
  importCustomTeams as importCustomTeamsParser,
  type ImportCustomTeamsOptions,
  type ImportCustomTeamsResult,
  type ImportPlayerResult,
  parseExportedCustomPlayer as parseExportedCustomPlayerJson,
} from "./customTeamExportImport";
import { importPlayerIntoTeam, orchestrateTeamImport } from "./customTeamImportOrchestrator";
import {
  assembleRoster,
  removeTeamPlayerRecords,
  toTeamPlayer,
  writePlayerRecords,
} from "./customTeamPlayerDocs";
import { populateRoster } from "./customTeamRosterPersistence";
import {
  buildRoster,
  requireNonEmpty,
  ROSTER_SCHEMA_VERSION,
  sanitizeAbbreviation,
} from "./customTeamSanitizers";
import { FREE_AGENT_TEAM_ID } from "./schemaV1";

type GetDb = () => Promise<BallgameDb>;

function buildStore(getDbFn: GetDb) {
  return {
    /**
     * Returns all custom teams ordered by most recently updated.
     * Archived teams are excluded unless `includeArchived` is true.
     * Pass `withRoster: false` to skip roster hydration (populateRoster) for
     * callers that only need metadata such as name-uniqueness or fingerprint checks.
     */
    async listCustomTeams(filter?: {
      includeArchived?: boolean;
      withRoster?: boolean;
    }): Promise<TeamWithRoster[]> {
      const db = await getDbFn();
      const docs = await db.teams.find({ sort: [{ updatedAt: "desc" }] }).exec();
      const teams = docs.map((d) => d.toJSON() as unknown as TeamWithRoster);
      const filtered = filter?.includeArchived ? teams : teams.filter((t) => !t.metadata?.archived);
      if (filter?.withRoster === false) return filtered;
      return Promise.all(filtered.map((t) => populateRoster(db, t as unknown as TeamRecord)));
    },

    /** Returns a single custom team by id, or null if not found. */
    async getCustomTeam(id: string): Promise<TeamWithRoster | null> {
      const db = await getDbFn();
      const doc = await db.teams.findOne(id).exec();
      if (!doc) return null;
      const team = doc.toJSON() as unknown as TeamRecord;
      return populateRoster(db, team);
    },

    /**
     * Creates a new custom team.
     * Throws if a team with the same name (case-insensitive) already exists
     * to ensure team names remain unique within the local install.
     * @returns The generated team id.
     */
    async createCustomTeam(input: CreateCustomTeamInput, meta?: { id?: string }): Promise<string> {
      const name = requireNonEmpty(input.name, "name");
      const db = await getDbFn();

      // Enforce unique team names using the indexed `nameLowercase` field — O(log n)
      // instead of loading the full collection and scanning in JS.
      const nameLower = name.toLowerCase();
      const duplicateDoc = await db.teams
        .findOne({ selector: { nameLowercase: nameLower } })
        .exec();
      if (duplicateDoc) {
        const dup = duplicateDoc.toJSON() as unknown as TeamRecord;
        throw new Error(`A team named "${dup.name}" already exists. Team names must be unique.`);
      }
      const roster = buildRoster(input.roster);
      const id = meta?.id ?? generateTeamId();
      const doc = buildNewTeamDoc({ ...input, name }, id);
      await db.teams.insert(doc);
      // Write player docs into the dedicated players collection.
      // On failure, roll back the team doc so the state remains consistent.
      try {
        await writePlayerRecords(db, id, roster);
      } catch (err) {
        await db.teams
          .findOne(id)
          .exec()
          .then((d) => d?.remove())
          .catch(() => undefined);
        throw err;
      }
      return id;
    },

    /**
     * Updates an existing custom team.
     * Only provided fields are changed; omitted fields keep their current values.
     */
    async updateCustomTeam(id: string, updates: UpdateCustomTeamInput): Promise<void> {
      const db = await getDbFn();
      const doc = await db.teams.findOne(id).exec();
      if (!doc) throw new Error(`Custom team not found: ${id}`);

      const patch: Partial<TeamRecord> = {
        updatedAt: new Date().toISOString(),
      };

      if (updates.name !== undefined) {
        const newName = requireNonEmpty(updates.name, "name");
        // Enforce unique team names using the indexed `nameLowercase` field — O(log n)
        // instead of loading the full collection and scanning in JS.
        const nameLower = newName.toLowerCase();
        const duplicateDoc = await db.teams
          .findOne({ selector: { nameLowercase: nameLower } })
          .exec();
        if (duplicateDoc && (duplicateDoc.toJSON() as unknown as TeamRecord).id !== id) {
          const dup = duplicateDoc.toJSON() as unknown as TeamRecord;
          throw new Error(`A team named "${dup.name}" already exists. Team names must be unique.`);
        }
        patch.name = newName;
        // Keep nameLowercase in sync for the indexed dedup field.
        patch.nameLowercase = newName.toLowerCase();
      }
      if (updates.abbreviation !== undefined)
        patch.abbreviation = sanitizeAbbreviation(updates.abbreviation);
      if (updates.nickname !== undefined) patch.nickname = updates.nickname;
      if (updates.city !== undefined) patch.city = updates.city;
      if (updates.slug !== undefined) patch.slug = updates.slug;
      if (updates.statsProfile !== undefined) patch.statsProfile = updates.statsProfile;

      if (updates.roster !== undefined) {
        const current = await populateRoster(db, doc.toJSON() as unknown as TeamRecord);
        const newRoster = buildRoster({
          lineup: updates.roster.lineup ?? current.roster.lineup,
          bench: updates.roster.bench ?? current.roster.bench,
          pitchers: updates.roster.pitchers ?? current.roster.pitchers,
        });
        // Replace player docs: upsert new docs first (safe), then remove any stale
        // docs whose composite IDs no longer appear in the new roster.
        const newDocIds = await writePlayerRecords(db, id, newRoster);
        await removeTeamPlayerRecords(db, id, newDocIds);
      }

      if (updates.metadata !== undefined) {
        const currentMeta = (doc.toJSON() as unknown as TeamWithRoster).metadata;
        patch.metadata = { ...currentMeta, ...updates.metadata } as CustomTeamMetadata;
      }

      // Recompute fingerprint only when identity fields (name or abbreviation) change.
      // roster changes do not affect the fingerprint.
      if (updates.name !== undefined || updates.abbreviation !== undefined) {
        const currentDoc = doc.toJSON() as unknown as TeamWithRoster;
        const merged: TeamWithRoster = {
          ...currentDoc,
          ...(patch.name !== undefined && { name: patch.name }),
          ...(patch.abbreviation !== undefined && { abbreviation: patch.abbreviation }),
        };
        patch.fingerprint = buildTeamFingerprint(merged);
      }

      await doc.patch(patch);
    },

    /**
     * Deletes a custom team.
     * @param id  The team id to delete.
     * @param options.cascade  When `true` (default), also deletes all player docs belonging to this
     *   team. When `false`, player docs are detached (their `teamId` is set to `null`) so they
     *   become free agents and can be re-assigned or listed via `listFreePlayers()`.
     */
    async deleteCustomTeam(id: string, options?: { cascade?: boolean }): Promise<void> {
      const cascade = options?.cascade ?? true;
      const db = await getDbFn();
      const doc = await db.teams.findOne(id).exec();
      if (doc) {
        // Clean up / detach players first so we never leave orphaned docs pointing
        // at a now-missing teamId.
        if (cascade) {
          await removeTeamPlayerRecords(db, id);
        } else {
          const existing = await db.players.find({ selector: { teamId: id } }).exec();
          await Promise.all(existing.map((p) => p.patch({ teamId: FREE_AGENT_TEAM_ID })));
        }
        await doc.remove();
      }
    },

    /**
     * Returns all player docs that are not assigned to any team (free agents).
     * These are players whose `teamId` is `FREE_AGENT_TEAM_ID` — created when a team is deleted
     * with `{ cascade: false }`.
     */
    async listFreePlayers(): Promise<PlayerRecord[]> {
      const db = await getDbFn();
      const docs = await db.players.find({ selector: { teamId: FREE_AGENT_TEAM_ID } }).exec();
      return docs.map((d) => d.toJSON() as PlayerRecord);
    },

    /**
     * Exports the specified teams (by id) as a portable JSON string.
     * If `ids` is omitted, all non-archived teams are exported.
     */
    async exportCustomTeams(ids?: string[]): Promise<string> {
      if (ids) {
        // Use findByIds for O(1)-per-team PK lookups instead of loading all teams
        // then filtering in JS with ids.includes() which is O(n×m).
        const db = await getDbFn();
        const docsMap = await db.teams.findByIds(ids).exec();
        const teams = await Promise.all(
          Array.from(docsMap.values()).map((d) =>
            populateRoster(db, d.toJSON() as unknown as TeamRecord),
          ),
        );
        return exportCustomTeamsJson(teams);
      }
      const all = await this.listCustomTeams();
      return exportCustomTeamsJson(all);
    },

    /**
     * Exports a single player from a team as a portable signed JSON string.
     * @param teamId  The team the player belongs to.
     * @param playerId  The player's id within that team.
     * @throws If the team or player is not found.
     */
    async exportPlayer(teamId: string, playerId: string): Promise<string> {
      const db = await getDbFn();
      // Direct PK lookup — O(1) instead of loading the full team roster and
      // scanning the array with allPlayers.find().
      const [teamDoc, playerDoc] = await Promise.all([
        db.teams.findOne(teamId).exec(),
        db.players.findOne(playerId).exec(),
      ]);
      if (!teamDoc) throw new Error(`Team not found: ${teamId}`);
      const playerRecord = playerDoc?.toJSON() as PlayerRecord | undefined;
      if (!playerRecord || playerRecord.teamId !== teamId) {
        throw new Error(`Player not found: ${playerId} in team ${teamId}`);
      }
      return exportCustomPlayerJson(toTeamPlayer(playerRecord));
    },

    /**
     * Imports teams from a JSON string produced by `exportCustomTeams`.
     * Remaps IDs on collision and upserts all resulting teams into the DB.
     * When duplicate players are detected and `options.allowDuplicatePlayers` is
     * not true, returns `requiresDuplicateConfirmation: true` without importing
     * anything — the caller should prompt the user and retry with the flag set.
     * @returns A summary of created/remapped counts and duplicate warnings.
     * @note Name-uniqueness is NOT enforced on import. A team imported with the
     * same name as an existing team (but a different `id`) will be upserted
     * as a separate team. This is a known limitation of the fingerprint-based
     * deduplication strategy: fingerprints are id-scoped, so only the exact
     * same team (same id) is detected as a duplicate.
     */
    async importCustomTeams(
      json: string,
      options?: ImportCustomTeamsOptions,
    ): Promise<ImportCustomTeamsResult> {
      // Query team docs and player docs directly from the DB without calling
      // listCustomTeams() / populateRoster().  populateRoster() can write to
      // db.players and patch team docs (legacy backfill) as a side effect, so
      // even a blocked import (requiresDuplicateConfirmation: true) would mutate
      // the DB.  By reading collections directly we get the same roster data
      // without any writes.
      const db = await getDbFn();
      const rawTeamDocs = (await db.teams.find().exec()).map((d) => d.toJSON() as TeamRecord);
      // Query only the player docs that belong to our known teams using a $in
      // selector, then group them by teamId into a Map for O(1) lookup per team.
      // This avoids fetching free-agent / archived-team player docs and replaces
      // the previous O(teamCount × playerCount) filter loop.
      const teamIds = rawTeamDocs.map((t) => t.id);
      const playersByTeamId = new Map<string, PlayerRecord[]>();
      if (teamIds.length > 0) {
        const relevantPlayerDocs = (
          await db.players.find({ selector: { teamId: { $in: teamIds } } }).exec()
        ).map((d) => d.toJSON() as PlayerRecord);
        for (const doc of relevantPlayerDocs) {
          if (!doc.teamId) continue;
          const bucket = playersByTeamId.get(doc.teamId) ?? [];
          bucket.push(doc);
          playersByTeamId.set(doc.teamId, bucket);
        }
      }
      // Assemble rosters read-only from player records.
      const existing = rawTeamDocs.map((team) => {
        const teamPlayerRecords = playersByTeamId.get(team.id) ?? [];
        return { ...team, roster: assembleRoster(teamPlayerRecords) } as unknown as TeamWithRoster;
      });
      const result = importCustomTeamsParser(json, existing, undefined, options);
      if (!result.requiresDuplicateConfirmation) {
        for (const team of result.teams) {
          await orchestrateTeamImport(db, team, ROSTER_SCHEMA_VERSION);
        }
      }
      return result;
    },

    /**
     * Imports a single player from a signed player export bundle into a target team's roster.
     */
    async importPlayer(
      targetTeamId: string,
      playerJson: string,
      section: "lineup" | "bench" | "pitchers",
    ): Promise<ImportPlayerResult> {
      const player = parseExportedCustomPlayerJson(playerJson);

      // In v1, player.id IS the globalPlayerId.
      if (!player.id) {
        throw new Error("Imported player bundle must include a player id.");
      }

      const db = await getDbFn();
      const targetTeamDoc = await db.teams.findOne(targetTeamId).exec();
      if (!targetTeamDoc) throw new Error(`Custom team not found: ${targetTeamId}`);
      const targetTeam = await populateRoster(db, targetTeamDoc.toJSON() as unknown as TeamRecord);

      return importPlayerIntoTeam(db, {
        player,
        targetTeamId,
        targetTeam,
        section,
        updateFn: (id, updates) => this.updateCustomTeam(id, updates),
      }).then((result) => {
        if (result.status === "sectionMismatch") {
          throw new Error(result.message);
        }
        return result;
      });
    },
  };
}

/** Default CustomTeamStore backed by the IndexedDB singleton. */
export const CustomTeamStore = buildStore(getDb);

/**
 * Factory for creating a CustomTeamStore with a custom db getter —
 * useful for tests where a fresh in-memory database should be injected.
 */
export const makeCustomTeamStore = (getDbFn: GetDb) => buildStore(getDbFn);
