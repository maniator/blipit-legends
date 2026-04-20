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
} from "@storage/types";

// DOC_SCHEMA_VERSION is the schemaVersion field on SaveRecord/EventRecord rows —
// it is independent of the RxDB collection schema version (saves collection is v2).
const DOC_SCHEMA_VERSION = 1;
const MAX_SAVES = 3;
const RXDB_EXPORT_VERSION = 1 as const;
const RXDB_EXPORT_KEY = "ballgame:rxdb:v1";

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

    /** Fetches a single save header by ID. Returns null if not found. */
    async getSave(saveId: string): Promise<SaveRecord | null> {
      const db = await getDbFn();
      const doc = await db.saves.findOne(saveId).exec();
      return doc ? (doc.toJSON() as unknown as SaveRecord) : null;
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
      const { version, header, events, sig } = parsed as RxdbExportedSave;
      if (typeof version !== "number")
        throw new Error(
          "Invalid save file: missing or unrecognized format. Please export a save from the app and try again.",
        );
      if (version !== RXDB_EXPORT_VERSION) throw new Error(`Unsupported save version: ${version}`);
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
  };
}

/** Default SaveStore backed by the IndexedDB singleton. */
export const SaveStore = buildStore(getDb);

/**
 * Factory for creating a SaveStore with a custom db getter — useful for tests
 * where a fresh in-memory database should be injected.
 */
export const makeSaveStore = (getDbFn: GetDb) => buildStore(getDbFn);
