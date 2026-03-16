import { type BallgameDb, getDb } from "@storage/db";
import { generateSeed, generateTeamId } from "@storage/generateId";
import type {
  CreateCustomTeamInput,
  CustomTeamDoc,
  CustomTeamMetadata,
  PlayerDoc,
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
import { assembleRoster, removePlayerDocs, writePlayerDocs } from "./customTeamPlayerDocs";
import { populateRoster } from "./customTeamRosterPersistence";
import {
  buildRoster,
  requireNonEmpty,
  ROSTER_SCHEMA_VERSION,
  sanitizeAbbreviation,
} from "./customTeamSanitizers";

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
    }): Promise<CustomTeamDoc[]> {
      const db = await getDbFn();
      const docs = await db.customTeams.find({ sort: [{ updatedAt: "desc" }] }).exec();
      const teams = docs.map((d) => d.toJSON() as unknown as CustomTeamDoc);
      const filtered = filter?.includeArchived ? teams : teams.filter((t) => !t.metadata?.archived);
      if (filter?.withRoster === false) return filtered;
      return Promise.all(filtered.map((t) => populateRoster(db, t)));
    },

    /** Returns a single custom team by id, or null if not found. */
    async getCustomTeam(id: string): Promise<CustomTeamDoc | null> {
      const db = await getDbFn();
      const doc = await db.customTeams.findOne(id).exec();
      if (!doc) return null;
      const team = doc.toJSON() as unknown as CustomTeamDoc;
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

      // Enforce unique team names (case-insensitive) across the local install.
      const existing = await this.listCustomTeams({ includeArchived: true, withRoster: false });
      const nameLower = name.toLowerCase();
      const duplicate = existing.find((t) => t.name.toLowerCase() === nameLower);
      if (duplicate) {
        throw new Error(
          `A team named "${duplicate.name}" already exists. Team names must be unique.`,
        );
      }
      const roster = buildRoster(input.roster);
      const id = meta?.id ?? generateTeamId();
      const teamSeed = generateSeed();
      const doc = buildNewTeamDoc({ ...input, name }, id, teamSeed);
      const db = await getDbFn();
      await db.customTeams.insert(doc);
      // Write player docs into the dedicated players collection.
      // On failure, roll back the team doc so the state remains consistent.
      try {
        await writePlayerDocs(db, id, roster);
      } catch (err) {
        await db.customTeams
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
      const doc = await db.customTeams.findOne(id).exec();
      if (!doc) throw new Error(`Custom team not found: ${id}`);

      const patch: Partial<CustomTeamDoc> = {
        updatedAt: new Date().toISOString(),
      };

      if (updates.name !== undefined) {
        const newName = requireNonEmpty(updates.name, "name");
        // Enforce unique team names (case-insensitive), excluding the current team.
        const existing = await this.listCustomTeams({ includeArchived: true, withRoster: false });
        const nameLower = newName.toLowerCase();
        const duplicate = existing.find((t) => t.id !== id && t.name.toLowerCase() === nameLower);
        if (duplicate) {
          throw new Error(
            `A team named "${duplicate.name}" already exists. Team names must be unique.`,
          );
        }
        patch.name = newName;
      }
      if (updates.abbreviation !== undefined)
        patch.abbreviation = sanitizeAbbreviation(updates.abbreviation);
      if (updates.nickname !== undefined) patch.nickname = updates.nickname;
      if (updates.city !== undefined) patch.city = updates.city;
      if (updates.slug !== undefined) patch.slug = updates.slug;
      if (updates.statsProfile !== undefined) patch.statsProfile = updates.statsProfile;

      if (updates.roster !== undefined) {
        const current = await populateRoster(db, doc.toJSON() as unknown as CustomTeamDoc);
        const newRoster = buildRoster({
          lineup: updates.roster.lineup ?? current.roster.lineup,
          bench: updates.roster.bench ?? current.roster.bench,
          pitchers: updates.roster.pitchers ?? current.roster.pitchers,
        });
        // Keep embedded arrays empty — players live in the `players` collection.
        patch.roster = {
          schemaVersion: ROSTER_SCHEMA_VERSION,
          lineup: [],
          bench: [],
          pitchers: [],
        };
        // Replace player docs: upsert new docs first (safe), then remove any stale
        // docs whose composite IDs no longer appear in the new roster.
        const newDocIds = await writePlayerDocs(db, id, newRoster);
        await removePlayerDocs(db, id, newDocIds);
      }

      if (updates.metadata !== undefined) {
        const currentMeta = (doc.toJSON() as unknown as CustomTeamDoc).metadata;
        patch.metadata = { ...currentMeta, ...updates.metadata } as CustomTeamMetadata;
      }

      // Recompute fingerprint only when identity fields (name or abbreviation) change.
      // roster changes do not affect the fingerprint. teamSeed is never part of
      // UpdateCustomTeamInput and therefore never triggers a recomputation here.
      if (updates.name !== undefined || updates.abbreviation !== undefined) {
        const currentDoc = doc.toJSON() as unknown as CustomTeamDoc;
        // Merge currentDoc with all effective changes so fingerprint uses final values.
        const merged: CustomTeamDoc = {
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
      const doc = await db.customTeams.findOne(id).exec();
      if (doc) {
        // Clean up / detach players first so we never leave orphaned docs pointing
        // at a now-missing teamId.
        if (cascade) {
          await removePlayerDocs(db, id);
        } else {
          const existing = await db.players.find({ selector: { teamId: id } }).exec();
          await Promise.all(existing.map((p) => p.patch({ teamId: null })));
        }
        await doc.remove();
      }
    },

    /**
     * Returns all player docs that are not assigned to any team (free agents).
     * These are players whose `teamId` is `null` — created when a team is deleted
     * with `{ cascade: false }`.
     */
    async listFreePlayers(): Promise<PlayerDoc[]> {
      const db = await getDbFn();
      const docs = await db.players.find({ selector: { teamId: null } }).exec();
      return docs.map((d) => d.toJSON() as unknown as PlayerDoc);
    },

    /**
     * Exports the specified teams (by id) as a portable JSON string.
     * If `ids` is omitted, all non-archived teams are exported.
     */
    async exportCustomTeams(ids?: string[]): Promise<string> {
      const all = await this.listCustomTeams(ids ? { includeArchived: true } : undefined);
      const toExport = ids ? all.filter((t) => ids.includes(t.id)) : all;
      return exportCustomTeamsJson(toExport);
    },

    /**
     * Exports a single player from a team as a portable signed JSON string.
     * @param teamId  The team the player belongs to.
     * @param playerId  The player's id within that team.
     * @throws If the team or player is not found.
     */
    async exportPlayer(teamId: string, playerId: string): Promise<string> {
      const team = await this.getCustomTeam(teamId);
      if (!team) throw new Error(`Team not found: ${teamId}`);
      const allPlayers = [...team.roster.lineup, ...team.roster.bench, ...team.roster.pitchers];
      const player = allPlayers.find((p) => p.id === playerId);
      if (!player) throw new Error(`Player not found: ${playerId} in team ${teamId}`);
      return exportCustomPlayerJson(player);
    },

    /**
     * Imports teams from a JSON string produced by `exportCustomTeams`.
     * Remaps IDs on collision and upserts all resulting teams into the DB.
     * When duplicate players are detected and `options.allowDuplicatePlayers` is
     * not true, returns `requiresDuplicateConfirmation: true` without importing
     * anything — the caller should prompt the user and retry with the flag set.
     * @returns A summary of created/remapped counts and duplicate warnings.
     * @note Name-uniqueness is NOT enforced on import. A team imported with the
     * same name as an existing team (but a different `teamSeed`) will be upserted
     * as a separate team. This is a known limitation of the fingerprint-based
     * deduplication strategy: fingerprints are seed-scoped, so only the exact
     * same team (same seed) is detected as a duplicate.
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
      const rawTeamDocs = (await db.customTeams.find().exec()).map(
        (d) => d.toJSON() as CustomTeamDoc,
      );
      const allPlayerDocs = (await db.players.find().exec()).map((d) => d.toJSON() as PlayerDoc);
      // Assemble rosters read-only: use player docs for modern teams, fall back to
      // embedded roster arrays for legacy teams that have not been backfilled yet.
      const existing: CustomTeamDoc[] = rawTeamDocs.map((team) => {
        const teamPlayerDocs = allPlayerDocs.filter((p) => p.teamId === team.id);
        if (teamPlayerDocs.length > 0) {
          return { ...team, roster: assembleRoster(teamPlayerDocs, team.roster) };
        }
        // Legacy team: players still in embedded arrays (no backfill write here).
        return team;
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

      if (!player.globalPlayerId) {
        throw new Error(
          "Imported player bundle must include a globalPlayerId. Re-export the player from the source team to get a valid bundle.",
        );
      }

      const db = await getDbFn();
      const targetTeamDoc = await db.customTeams.findOne(targetTeamId).exec();
      if (!targetTeamDoc) throw new Error(`Custom team not found: ${targetTeamId}`);
      const targetTeam = await populateRoster(
        db,
        targetTeamDoc.toJSON() as unknown as CustomTeamDoc,
      );

      return importPlayerIntoTeam(db, player, targetTeamId, targetTeam, section, (id, updates) =>
        this.updateCustomTeam(id, updates),
      );
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
