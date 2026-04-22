import { type BallgameDb, getDb } from "@storage/db";
import { generateSaveId } from "@storage/generateId";
import { fnv1a } from "@storage/hash";
import type {
  EventRecord,
  GameEvent,
  GameSetup,
  ProgressSummary,
  RxdbExportedSave,
  SaveRecord,
  V2BundleHeader,
} from "@storage/types";

import { canonicalJSON } from "./canonicalJSON";
import type { V2BundleCollections } from "./types";

// DOC_SCHEMA_VERSION is the schemaVersion field on SaveRecord/EventRecord rows —
// it is independent of the RxDB collection schema version (saves collection is v2).
const DOC_SCHEMA_VERSION = 1;
const MAX_SAVES = 3;
const RXDB_EXPORT_VERSION = 1 as const;
const RXDB_EXPORT_KEY = "ballgame:rxdb:v1";
export const RXDB_EXPORT_VERSION_V2 = 2 as const;
export const RXDB_EXPORT_KEY_V2 = "ballgame:rxdb:v2";

/** localStorage key for the import-in-progress tombstone. */
const IMPORT_IN_PROGRESS_KEY = "ballgame:import-in-progress:v1";
/** localStorage key for the epoch ms timestamp when the interrupted import started. */
const IMPORT_STARTED_AT_KEY_PREFIX = "ballgame:import-started-at:";

type GetDb = () => Promise<BallgameDb>;

function buildStore(getDbFn: GetDb) {
  // Per-save promise chain: serializes all appendEvents calls for the same save
  // so index allocation never races even under rapid fire-and-forget writes.
  const appendQueues = new Map<string, Promise<void>>();

  // Per-save monotonic next-index counter.  Set to 0 on createSave (new save
  // has no events yet) and incremented synchronously inside the queue chain so
  // overlapping batches always get distinct, gapless indices.  Cleared on
  // deleteSave / importRxdbSave to force a DB-query re-initialization if the
  // save is ever reused from a different store instance (e.g. after import).
  const nextIdxMap = new Map<string, number>();

  return {
    /**
     * Creates a new save header document.
     * @returns The generated saveId.
     * Team IDs are stored as provided and validated on import by DB existence checks.
     * GameInner sources these from customTeamToGameId() which returns team.id directly.
     */
    async createSave(setup: GameSetup, meta?: { name?: string }): Promise<string> {
      const db = await getDbFn();
      const now = Date.now();
      const id = generateSaveId();

      // Enforce max-saves rule: evict the oldest save before inserting a new one.
      const allSaves = await db.saves.find({ sort: [{ updatedAt: "asc" }] }).exec();
      if (allSaves.length >= MAX_SAVES) {
        const oldest = allSaves[0];
        nextIdxMap.delete(oldest.id);
        appendQueues.delete(oldest.id);
        await oldest.remove();
        const staleEvents = await db.events.find({ selector: { saveId: oldest.id } }).exec();
        await Promise.all(staleEvents.map((d) => d.remove()));
      }
      const doc: SaveRecord = {
        id,
        name: meta?.name ?? `${setup.homeTeamId} vs ${setup.awayTeamId}`,
        seed: setup.seed,
        homeTeamId: setup.homeTeamId,
        awayTeamId: setup.awayTeamId,
        createdAt: now,
        updatedAt: now,
        // -1 is the sentinel for "not started" (no pitches persisted yet).
        progressIdx: -1,
        setup: setup.setup,
        schemaVersion: DOC_SCHEMA_VERSION,
      };
      await db.saves.insert(doc);
      // New save has no events — seed counter at 0 to skip the DB-query path.
      nextIdxMap.set(id, 0);
      return id;
    },

    /**
     * Appends a batch of events for a save.
     * Calls are serialized per saveId via a promise queue so concurrent
     * fire-and-forget writes never produce colliding `${saveId}:${idx}` keys.
     * The in-memory counter is incremented synchronously inside the queue, so
     * the next queued batch always starts at the correct index.
     */
    async appendEvents(saveId: string, events: GameEvent[]): Promise<void> {
      if (events.length === 0) return;

      // Chain this write behind any in-progress append for the same save.
      const prev = appendQueues.get(saveId) ?? Promise.resolve();
      const thisWrite = prev.then(async () => {
        const db = await getDbFn();

        // Initialise the counter from DB only the very first time (e.g. when
        // loading a save created by a different store instance after import).
        if (!nextIdxMap.has(saveId)) {
          const existing = await db.events
            .find({ selector: { saveId }, sort: [{ idx: "desc" }], limit: 1 })
            .exec();
          nextIdxMap.set(saveId, existing.length > 0 ? existing[0].idx + 1 : 0);
        }

        const startIdx = nextIdxMap.get(saveId)!;
        // Optimistically advance the counter so the next queued batch sees the
        // updated value immediately (writes are serialized by the queue).
        nextIdxMap.set(saveId, startIdx + events.length);

        const now = Date.now();
        const docs: EventRecord[] = events.map((ev, i) => ({
          id: `${saveId}:${startIdx + i}`,
          saveId,
          idx: startIdx + i,
          at: ev.at,
          type: ev.type,
          payload: ev.payload,
          ts: now,
          schemaVersion: DOC_SCHEMA_VERSION,
        }));

        try {
          await db.events.bulkInsert(docs);
        } catch (err) {
          // Roll back the counter so the next batch retries from the correct idx.
          nextIdxMap.set(saveId, startIdx);
          throw err;
        }
      });

      // Keep the chain alive; swallow errors so one failed batch doesn't
      // permanently break subsequent appends for this save.
      appendQueues.set(
        saveId,
        thisWrite.catch(() => {}),
      );
      return thisWrite;
    },

    /**
     * Updates the progress cursor and optional snapshot fields on a save header.
     * Silently no-ops if the save is not found (e.g. deleted between game start and
     * game over) rather than throwing, to avoid spurious console errors in that case.
     */
    async updateProgress(
      saveId: string,
      progressIdx: number,
      summary?: ProgressSummary,
    ): Promise<void> {
      const db = await getDbFn();
      const doc = await db.saves.findOne(saveId).exec();
      if (!doc) return;
      await doc.patch({
        progressIdx,
        updatedAt: Date.now(),
        ...(summary?.scoreSnapshot !== undefined && { scoreSnapshot: summary.scoreSnapshot }),
        ...(summary?.inningSnapshot !== undefined && { inningSnapshot: summary.inningSnapshot }),
        ...(summary?.stateSnapshot !== undefined && { stateSnapshot: summary.stateSnapshot }),
        ...(summary?.setup !== undefined && { setup: summary.setup }),
      });
    },

    /**
     * Permanently removes a save header and all its associated event documents.
     */
    async deleteSave(saveId: string): Promise<void> {
      // Clear in-memory state first so any concurrent appendEvents call that
      // starts after this point will not resurrect a zombie event stream for
      // the deleted save.
      nextIdxMap.delete(saveId);
      appendQueues.delete(saveId);
      const db = await getDbFn();
      const headerDoc = await db.saves.findOne(saveId).exec();
      if (headerDoc) await headerDoc.remove();
      const eventDocs = await db.events.find({ selector: { saveId } }).exec();
      await Promise.all(eventDocs.map((d) => d.remove()));
    },

    /** Returns all save headers ordered by most recently updated. */
    async listSaves(): Promise<SaveRecord[]> {
      const db = await getDbFn();
      const docs = await db.saves.find({ sort: [{ updatedAt: "desc" }] }).exec();
      return docs.map((d) => d.toJSON() as unknown as SaveRecord);
    },

    /**
     * Exports a save as a self-contained signed JSON string bundling the save
     * header and all its event documents.  The result can be shared and later
     * restored with `importRxdbSave`.
     */
    async exportRxdbSave(saveId: string): Promise<string> {
      const db = await getDbFn();
      const headerDoc = await db.saves.findOne(saveId).exec();
      if (!headerDoc) throw new Error(`Save not found: ${saveId}`);
      const header = headerDoc.toJSON() as unknown as SaveRecord;
      const eventDocs = await db.events
        .find({ selector: { saveId }, sort: [{ idx: "asc" }] })
        .exec();
      const events = eventDocs.map((d) => d.toJSON() as unknown as EventRecord);
      const sig = fnv1a(RXDB_EXPORT_KEY + JSON.stringify({ header, events }));
      const payload: RxdbExportedSave = { version: RXDB_EXPORT_VERSION, header, events, sig };
      return JSON.stringify(payload, null, 2);
    },

    /**
     * Imports a save from a JSON string produced by `exportRxdbSave`.
     * Verifies the signature, upserts the header, and bulk-upserts the events.
     * @returns The restored SaveRecord.
     */
    async importRxdbSave(json: string): Promise<SaveRecord> {
      let parsed: unknown;
      try {
        parsed = JSON.parse(json);
      } catch {
        throw new Error("Invalid JSON");
      }
      if (!parsed || typeof parsed !== "object") throw new Error("Invalid save file");
      const bundle = parsed as Record<string, unknown>;
      const version = bundle["version"];
      if (typeof version !== "number")
        throw new Error(
          "Invalid save file: missing or unrecognized format. Please export a save from the app and try again.",
        );
      // Reject v2 bundles — they must be imported via importRxdbSaveV2.
      if (version === 2)
        throw new Error(
          "This save was created with a newer version of the app. Update first to import.",
        );
      if (version !== RXDB_EXPORT_VERSION) throw new Error(`Unsupported save version: ${version}`);
      const { header, events, sig } = bundle as unknown as Extract<
        RxdbExportedSave,
        { version: 1 }
      >;
      if (!header || typeof header !== "object" || typeof header.id !== "string")
        throw new Error("Invalid save data");
      const expectedSig = fnv1a(RXDB_EXPORT_KEY + JSON.stringify({ header, events }));
      if (sig !== expectedSig)
        throw new Error("Save signature mismatch — file may be corrupted or from a different app");

      // Validate team ID fields are strings.
      if (typeof header.homeTeamId !== "string" || typeof header.awayTeamId !== "string") {
        throw new Error("Invalid save data: missing or non-string team identifiers");
      }

      // Reject saves that reference teams that don't exist locally.
      const db = await getDbFn();
      const uniqueTeamIds = [...new Set([header.homeTeamId, header.awayTeamId])];
      const teamDocs = await Promise.all(uniqueTeamIds.map((id) => db.teams.findOne(id).exec()));
      const missingCount = teamDocs.filter((d) => d === null).length;
      if (missingCount > 0) {
        const teamWord = missingCount === 1 ? "custom team" : "custom teams";
        const genericWord = missingCount === 1 ? "team" : "teams";
        throw new Error(
          `Cannot import save: ${missingCount} ${teamWord} used by this save ${missingCount === 1 ? "is" : "are"} not installed on this device. Import the missing ${genericWord} first via the Teams page, then retry the save import.`,
        );
      }

      const { matchupMode: _drop, ...headerRest } = header as unknown as Record<string, unknown>;
      const cleanHeader = { ...headerRest } as unknown as SaveRecord;
      await db.saves.upsert(cleanHeader);
      if (Array.isArray(events) && events.length > 0) {
        await db.events.bulkUpsert(events);
      }
      const cleanId = (cleanHeader as unknown as Record<string, unknown>).id as string;
      nextIdxMap.delete(cleanId);
      appendQueues.delete(cleanId);
      return cleanHeader;
    },

    /**
     * Exports all collections as a v2 signed bundle JSON string.
     * The bundle contains: saves, events, customTeams (teams), seasons,
     * seasonTeams, seasonGames, seasonPlayerState.
     *
     * Signature: fnv1a(RXDB_EXPORT_KEY_V2 + canonicalJSON(header))
     * Per-collection arrays are sorted by `id` before signing (canonicalJSON
     * handles this automatically for object arrays with `id` fields).
     */
    async exportRxdbSaveV2(): Promise<string> {
      const db = await getDbFn();

      const [
        saveDocs,
        eventDocs,
        teamDocs,
        seasonDocs,
        seasonTeamDocs,
        seasonGameDocs,
        seasonPlayerStateDocs,
      ] = await Promise.all([
        db.saves.find().exec(),
        db.events.find().exec(),
        db.teams.find().exec(),
        db.seasons.find().exec(),
        db.seasonTeams.find().exec(),
        db.seasonGames.find().exec(),
        db.seasonPlayerState.find().exec(),
      ]);

      const collections: V2BundleCollections = {
        saves: saveDocs.map((d) => d.toJSON() as unknown as SaveRecord),
        events: eventDocs.map((d) => d.toJSON() as unknown as EventRecord),
        customTeams: teamDocs.map((d) => d.toJSON() as unknown),
        seasons: seasonDocs.map((d) => d.toJSON() as unknown),
        seasonTeams: seasonTeamDocs.map((d) => d.toJSON() as unknown),
        seasonGames: seasonGameDocs.map((d) => d.toJSON() as unknown),
        seasonPlayerState: seasonPlayerStateDocs.map((d) => d.toJSON() as unknown),
        seasonTransactions: [],
        gameHistory: [],
      } as unknown as V2BundleCollections;

      const header: V2BundleHeader = {
        exportedAt: Date.now(),
        appVersion: import.meta.env?.VITE_APP_VERSION ?? "unknown",
        rulesetVersion: (() => {
          try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            return require("@feat/league/ruleset").CURRENT_RULESET_VERSION as number;
          } catch {
            return 1;
          }
        })(),
        collections,
      };

      const sig = fnv1a(RXDB_EXPORT_KEY_V2 + canonicalJSON(header));
      const payload: RxdbExportedSave = { version: RXDB_EXPORT_VERSION_V2, header, sig };
      return JSON.stringify(payload, null, 2);
    },

    /**
     * Imports a v2 bundle produced by `exportRxdbSaveV2`.
     *
     * Import order: customTeams → seasons → seasonTeams/seasonGames/seasonPlayerState
     *
     * Active-season collision: if an imported season with status='active' already
     * exists locally with the same id, the entire import is rejected.
     *
     * Completed-season id collision: the season id is suffixed with
     * `-imported-<shortToken>` and all child docs' seasonId references are rewritten.
     *
     * @returns The parsed V2BundleHeader on success.
     */
    async importRxdbSaveV2(json: string): Promise<V2BundleHeader> {
      let parsed: unknown;
      try {
        parsed = JSON.parse(json);
      } catch {
        throw new Error("Invalid JSON");
      }
      if (!parsed || typeof parsed !== "object") throw new Error("Invalid save file");
      const bundle = parsed as Record<string, unknown>;

      if (bundle["version"] !== RXDB_EXPORT_VERSION_V2)
        throw new Error("Invalid v2 bundle: wrong version field");

      const rawHeader = bundle["header"] as V2BundleHeader | undefined;
      const sig = bundle["sig"] as string | undefined;
      if (!rawHeader || typeof sig !== "string") throw new Error("Invalid save file: missing header or sig");

      const expectedSig = fnv1a(RXDB_EXPORT_KEY_V2 + canonicalJSON(rawHeader));
      if (sig !== expectedSig)
        throw new Error(
          "This save file appears corrupted. Try re-exporting from the source.",
        );

      // Import CURRENT_RULESET_VERSION lazily to avoid circular deps.
      let currentRulesetVersion = 1;
      try {
        // Dynamic import avoids circular dependency at module load time.
        const rulesetModule = await import("@feat/league/ruleset");
        currentRulesetVersion = rulesetModule.CURRENT_RULESET_VERSION;
      } catch {
        // Fall back to 1 if the module is unavailable (e.g., test environment).
        currentRulesetVersion = 1;
      }

      if (rawHeader.rulesetVersion > currentRulesetVersion)
        throw new Error(
          "This save was created with a newer ruleset. Update the app first.",
        );

      const importStartedAt = Date.now();

      // Write import-in-progress tombstone to localStorage.
      try {
        localStorage.setItem(IMPORT_IN_PROGRESS_KEY, "1");
        localStorage.setItem(`${IMPORT_STARTED_AT_KEY_PREFIX}${importStartedAt}`, "1");
      } catch {
        // localStorage unavailable — continue without tombstone.
      }

      try {
        const db = await getDbFn();
        const { collections } = rawHeader;

        // ── 1. customTeams (teams) ──────────────────────────────────────────
        if (Array.isArray(collections.customTeams) && collections.customTeams.length > 0) {
          await db.teams.bulkUpsert(
            collections.customTeams as Parameters<typeof db.teams.bulkUpsert>[0],
          );
        }

        // ── 2. seasons ──────────────────────────────────────────────────────
        // Check for active-season collisions before writing anything.
        const localActiveSeasonsResult = await db.seasons
          .find({ selector: { status: "active" } })
          .exec();
        const localActiveSeasonIds = new Set(localActiveSeasonsResult.map((d) => d.id));

        // Separate imported seasons by collision type.
        const incomingSeasons: Array<Record<string, unknown>> = Array.isArray(collections.seasons)
          ? (collections.seasons as unknown as Array<Record<string, unknown>>)
          : [];
        const idRemap = new Map<string, string>(); // originalId → rewrittenId

        for (const season of incomingSeasons) {
          const seasonId = season["id"] as string;
          const isActive = season["status"] === "active";

          if (localActiveSeasonIds.has(seasonId) && isActive) {
            throw new Error(
              `You already have an active season with id "${seasonId}". ` +
                "Complete or abandon it before importing this bundle.",
            );
          }

          // For completed/abandoned seasons with id collision, rename them.
          if (localActiveSeasonIds.has(seasonId) || !isActive) {
            const existing = await db.seasons.findOne(seasonId).exec();
            if (existing && !isActive) {
              // Rewrite the id to avoid collision.
              const shortToken = Math.random().toString(36).slice(2, 8);
              const newId = `${seasonId}-imported-${shortToken}`;
              idRemap.set(seasonId, newId);
            }
          }
        }

        // Write seasons with potential id rewrites.
        for (const season of incomingSeasons) {
          const originalId = season["id"] as string;
          const rewrittenId = idRemap.get(originalId) ?? originalId;
          await db.seasons.upsert(
            ({ ...season, id: rewrittenId }) as unknown as Parameters<
              typeof db.seasons.upsert
            >[0],
          );
        }

        // ── 3. seasonTeams, seasonGames, seasonPlayerState ───────────────────
        // Rewrite seasonId references if ids were remapped above.

        const rewriteSeasonId = (
          docs: Array<Record<string, unknown>>,
        ): Array<Record<string, unknown>> =>
          docs.map((doc) => {
            const sid = doc["seasonId"] as string | undefined;
            if (sid && idRemap.has(sid)) {
              return { ...doc, seasonId: idRemap.get(sid)! };
            }
            return doc;
          });

        const incomingTeams = Array.isArray(collections.seasonTeams)
          ? rewriteSeasonId(collections.seasonTeams as unknown as Array<Record<string, unknown>>)
          : [];
        const incomingGames = Array.isArray(collections.seasonGames)
          ? rewriteSeasonId(collections.seasonGames as unknown as Array<Record<string, unknown>>)
          : [];
        const incomingPlayerStates = Array.isArray(collections.seasonPlayerState)
          ? rewriteSeasonId(
              collections.seasonPlayerState as unknown as Array<Record<string, unknown>>,
            )
          : [];

        await Promise.all([
          incomingTeams.length > 0
            ? db.seasonTeams.bulkUpsert(
                incomingTeams as unknown as Parameters<typeof db.seasonTeams.bulkUpsert>[0],
              )
            : Promise.resolve(),
          incomingGames.length > 0
            ? db.seasonGames.bulkUpsert(
                incomingGames as unknown as Parameters<typeof db.seasonGames.bulkUpsert>[0],
              )
            : Promise.resolve(),
          incomingPlayerStates.length > 0
            ? db.seasonPlayerState.bulkUpsert(
                incomingPlayerStates as unknown as Parameters<
                  typeof db.seasonPlayerState.bulkUpsert
                >[0],
              )
            : Promise.resolve(),
        ]);

        // ── 4. saves + events ────────────────────────────────────────────────
        if (Array.isArray(collections.saves) && collections.saves.length > 0) {
          await db.saves.bulkUpsert(
            collections.saves as Parameters<typeof db.saves.bulkUpsert>[0],
          );
        }
        if (Array.isArray(collections.events) && collections.events.length > 0) {
          await db.events.bulkUpsert(
            collections.events as Parameters<typeof db.events.bulkUpsert>[0],
          );
        }

        // Clear tombstone on success.
        try {
          localStorage.removeItem(IMPORT_IN_PROGRESS_KEY);
          localStorage.removeItem(`${IMPORT_STARTED_AT_KEY_PREFIX}${importStartedAt}`);
        } catch {
          // Non-fatal.
        }

        return rawHeader;
      } catch (err) {
        // Clear tombstone on failure so the interrupted-import check doesn't
        // surface a false positive for a cleanly-rejected import.
        try {
          localStorage.removeItem(IMPORT_IN_PROGRESS_KEY);
          localStorage.removeItem(`${IMPORT_STARTED_AT_KEY_PREFIX}${importStartedAt}`);
        } catch {
          // Non-fatal.
        }
        throw err;
      }
    },

    /**
     * Checks for an interrupted v2 import tombstone in localStorage.
     * If found, removes orphaned `teams` docs that were written during the
     * interrupted import but are not referenced by any season.
     *
     * Call this on app startup after the DB is initialized.
     */
    async checkAndCleanupInterruptedImport(): Promise<void> {
      let inProgress = false;
      let startedAt = 0;
      try {
        inProgress = localStorage.getItem(IMPORT_IN_PROGRESS_KEY) === "1";
        // Find the most recent started-at key.
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(IMPORT_STARTED_AT_KEY_PREFIX)) {
            const epoch = parseInt(key.slice(IMPORT_STARTED_AT_KEY_PREFIX.length), 10);
            if (!isNaN(epoch) && epoch > startedAt) startedAt = epoch;
          }
        }
      } catch {
        return; // localStorage unavailable.
      }

      if (!inProgress) return;

      // Remove orphaned teams: written after (startedAt - 5000) ms and not
      // referenced by any season's leagues[].teamIds.
      const db = await getDbFn();
      const allSeasons = await db.seasons.find().exec();
      const referencedTeamIds = new Set<string>();
      for (const season of allSeasons) {
        const leagues = (season.toJSON() as unknown as { leagues?: Array<{ teamIds?: string[] }> })
          .leagues;
        if (Array.isArray(leagues)) {
          for (const league of leagues) {
            if (Array.isArray(league.teamIds)) {
              for (const tid of league.teamIds) referencedTeamIds.add(tid);
            }
          }
        }
      }

      if (startedAt > 0) {
        const threshold = startedAt - 5000;
        const allTeams = await db.teams.find().exec();
        const orphans = allTeams.filter((t) => {
          const doc = t.toJSON() as unknown as { createdAt?: string | number; id: string };
          const created =
            typeof doc.createdAt === "number"
              ? doc.createdAt
              : doc.createdAt
                ? new Date(doc.createdAt).getTime()
                : 0;
          return created > threshold && !referencedTeamIds.has(doc.id);
        });
        await Promise.all(orphans.map((t) => t.remove()));
      }

      // Clear tombstone.
      try {
        localStorage.removeItem(IMPORT_IN_PROGRESS_KEY);
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i);
          if (key && key.startsWith(IMPORT_STARTED_AT_KEY_PREFIX)) {
            localStorage.removeItem(key);
          }
        }
      } catch {
        // Non-fatal.
      }
    },
  };
}

/** Default SaveStore backed by the IndexedDB singleton. */
export const SaveStore = buildStore(getDb);

/**
 * Factory for creating a SaveStore with a custom db getter — useful for tests
 * where a fresh in-memory database should be injected.
 */
export const makeSaveStore = (getDbFn: GetDb) => buildStore(getDbFn);
