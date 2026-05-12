import Dexie from "dexie";

import { type BallgameDexieDb, getDexieDb } from "@storage/dexieDb";
import { generateSaveId } from "@storage/generateId";
import { fnv1a } from "@storage/hash";
import type {
  EventRecord,
  GameEvent,
  GameSetup,
  PortableSaveExport,
  ProgressSummary,
  SaveRecord,
} from "@storage/types";

const DOC_SCHEMA_VERSION = 1;
const MAX_SAVES = 3;
const PORTABLE_SAVE_EXPORT_VERSION = 1 as const;
// Keep the existing v1 signature key unchanged so old and new v1 exports stay compatible.
const PORTABLE_SAVE_EXPORT_KEY = "ballgame:rxdb:v1";

type GetDexieDb = () => BallgameDexieDb;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/**
 * Validate event records from an imported Dexie save bundle. Mirrors the
 * RxDB `SaveStore.validateImportedEvents` invariants so the two backends
 * stay at parity through the migration: event entries must be objects with
 * the right primitive types, every `saveId` must match the parent save,
 * every `id` must equal `${saveId}:${idx}`, and indices must be unique,
 * non-negative, and form a contiguous sequence starting at 0.
 *
 * @returns A new array of validated EventRecord objects sorted by `idx`.
 */
const validateImportedEvents = (events: unknown, saveId: string): EventRecord[] => {
  if (!Array.isArray(events)) throw new Error("Invalid save data: events must be an array");

  const seenIdx = new Set<number>();
  const seenIds = new Set<string>();
  const eventRecords: EventRecord[] = [];

  for (const event of events) {
    if (!isRecord(event)) throw new Error("Invalid save data: event entries must be objects");
    const { id, saveId: eventSaveId, idx, at, type, payload, ts, schemaVersion } = event;
    if (
      typeof id !== "string" ||
      eventSaveId !== saveId ||
      !Number.isInteger(idx) ||
      (idx as number) < 0 ||
      typeof at !== "number" ||
      typeof type !== "string" ||
      !isRecord(payload) ||
      typeof ts !== "number" ||
      typeof schemaVersion !== "number"
    ) {
      throw new Error("Invalid save data: event log is malformed");
    }
    if (id !== `${saveId}:${idx}`) {
      throw new Error("Invalid save data: event id does not match save and index");
    }
    if (seenIdx.has(idx as number) || seenIds.has(id)) {
      throw new Error("Invalid save data: duplicate event log entry");
    }
    seenIdx.add(idx as number);
    seenIds.add(id);
    eventRecords.push(event as unknown as EventRecord);
  }

  for (let idx = 0; idx < eventRecords.length; idx++) {
    if (!seenIdx.has(idx))
      throw new Error("Invalid save data: event log indices must be contiguous");
  }

  return eventRecords.sort((a, b) => a.idx - b.idx);
};

function buildStore(getDbFn: GetDexieDb) {
  const appendQueues = new Map<string, Promise<void>>();
  const nextIdxMap = new Map<string, number>();

  return {
    async createSave(setup: GameSetup, meta?: { name?: string }): Promise<string> {
      const db = getDbFn();
      const now = Date.now();
      const id = generateSaveId();

      await db.transaction("rw", db.saves, db.events, async () => {
        const allSaves = await db.saves.orderBy("updatedAt").toArray();
        if (allSaves.length >= MAX_SAVES) {
          const oldest = allSaves[0];
          nextIdxMap.delete(oldest.id);
          appendQueues.delete(oldest.id);
          await db.saves.delete(oldest.id);
          await db.events.where("saveId").equals(oldest.id).delete();
        }

        const doc: SaveRecord = {
          id,
          name: meta?.name ?? `${setup.homeTeamId} vs ${setup.awayTeamId}`,
          seed: setup.seed,
          homeTeamId: setup.homeTeamId,
          awayTeamId: setup.awayTeamId,
          createdAt: now,
          updatedAt: now,
          progressIdx: -1,
          setup: setup.setup,
          schemaVersion: DOC_SCHEMA_VERSION,
        };
        await db.saves.add(doc);
      });

      nextIdxMap.set(id, 0);
      return id;
    },

    async appendEvents(saveId: string, events: GameEvent[]): Promise<void> {
      if (events.length === 0) return;

      const prev = appendQueues.get(saveId) ?? Promise.resolve();
      const thisWrite = prev.then(async () => {
        const db = getDbFn();

        if (!nextIdxMap.has(saveId)) {
          // Use the [saveId+idx] compound index to fetch only the last event
          // for this save instead of scanning the full event log.
          const lastEvent = await db.events
            .where("[saveId+idx]")
            .between([saveId, Dexie.minKey], [saveId, Dexie.maxKey])
            .last();
          const highestIdx = lastEvent?.idx ?? -1;
          nextIdxMap.set(saveId, highestIdx + 1);
        }

        const startIdx = nextIdxMap.get(saveId)!;
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
          // Wrap in a rw transaction so a partial bulkAdd failure rolls back
          // any inserted rows atomically. Without this, a BulkError can leave
          // some rows committed while we reset nextIdxMap, producing id/idx
          // collisions on retry and a corrupted event log.
          await db.transaction("rw", db.events, async () => {
            await db.events.bulkAdd(docs);
          });
        } catch (err) {
          nextIdxMap.set(saveId, startIdx);
          throw err;
        }
      });

      appendQueues.set(
        saveId,
        thisWrite.catch(() => {}),
      );
      return thisWrite;
    },

    async updateProgress(
      saveId: string,
      progressIdx: number,
      summary?: ProgressSummary,
    ): Promise<void> {
      const db = getDbFn();
      const patch: Partial<SaveRecord> = {
        progressIdx,
        updatedAt: Date.now(),
        ...(summary?.scoreSnapshot !== undefined && { scoreSnapshot: summary.scoreSnapshot }),
        ...(summary?.inningSnapshot !== undefined && { inningSnapshot: summary.inningSnapshot }),
        ...(summary?.stateSnapshot !== undefined && { stateSnapshot: summary.stateSnapshot }),
        ...(summary?.setup !== undefined && { setup: summary.setup }),
      };
      await db.saves.update(saveId, patch);
    },

    async deleteSave(saveId: string): Promise<void> {
      nextIdxMap.delete(saveId);
      appendQueues.delete(saveId);
      const db = getDbFn();
      await db.transaction("rw", db.saves, db.events, async () => {
        await db.saves.delete(saveId);
        await db.events.where("saveId").equals(saveId).delete();
      });
    },

    async listSaves(): Promise<SaveRecord[]> {
      const db = getDbFn();
      return db.saves.orderBy("updatedAt").reverse().toArray();
    },

    async exportSave(saveId: string): Promise<string> {
      const db = getDbFn();
      const header = await db.saves.get(saveId);
      if (!header) throw new Error(`Save not found: ${saveId}`);
      // Read events via the [saveId+idx] compound index so rows come back
      // already ordered by idx — avoids an extra in-memory sort for large logs.
      const events = await db.events
        .where("[saveId+idx]")
        .between([saveId, Dexie.minKey], [saveId, Dexie.maxKey])
        .toArray();
      const sig = fnv1a(PORTABLE_SAVE_EXPORT_KEY + JSON.stringify({ header, events }));
      const payload: PortableSaveExport = {
        version: PORTABLE_SAVE_EXPORT_VERSION,
        header,
        events,
        sig,
      };
      return JSON.stringify(payload, null, 2);
    },

    async importSave(json: string): Promise<SaveRecord> {
      let parsed: unknown;
      try {
        parsed = JSON.parse(json);
      } catch {
        throw new Error("Invalid JSON");
      }
      if (!parsed || typeof parsed !== "object") throw new Error("Invalid save file");
      const { version, header, events, sig } = parsed as PortableSaveExport;
      if (typeof version !== "number") {
        throw new Error(
          "Invalid save file: missing or unrecognized format. Please export a save from the app and try again.",
        );
      }
      if (version !== PORTABLE_SAVE_EXPORT_VERSION) {
        throw new Error(`Unsupported save version: ${version}`);
      }
      if (!header || typeof header !== "object" || typeof header.id !== "string") {
        throw new Error("Invalid save data");
      }

      const expectedSig = fnv1a(PORTABLE_SAVE_EXPORT_KEY + JSON.stringify({ header, events }));
      if (sig !== expectedSig) {
        throw new Error("Save signature mismatch: file may be corrupted or from a different app");
      }

      if (typeof header.homeTeamId !== "string" || typeof header.awayTeamId !== "string") {
        throw new Error("Invalid save data: missing or non-string team identifiers");
      }

      const db = getDbFn();
      const uniqueTeamIds = [...new Set([header.homeTeamId, header.awayTeamId])];
      const teamDocs = await Promise.all(uniqueTeamIds.map((id) => db.teams.get(id)));
      const missingCount = teamDocs.filter((d) => d === undefined).length;
      if (missingCount > 0) {
        const teamWord = missingCount === 1 ? "custom team" : "custom teams";
        const genericWord = missingCount === 1 ? "team" : "teams";
        throw new Error(
          `Cannot import save: ${missingCount} ${teamWord} used by this save ${missingCount === 1 ? "is" : "are"} not installed on this device. Import the missing ${genericWord} first via the Teams page, then retry the save import.`,
        );
      }

      const { matchupMode: _drop, ...headerRest } = header as unknown as Record<string, unknown>;
      const cleanHeader = { ...headerRest } as unknown as SaveRecord;
      // Validate the imported event log shape/invariants before any DB writes
      // so corrupt or malicious bundles can't produce a malformed log. Mirrors
      // the RxDB SaveStore behavior.
      const cleanEvents = validateImportedEvents(events, cleanHeader.id);

      await db.transaction("rw", db.saves, db.events, async () => {
        await db.saves.put(cleanHeader);
        // Remove any pre-existing events for this save so re-importing a
        // shorter or different log doesn't leave stale rows behind that
        // would corrupt resumes/replays.
        await db.events.where("saveId").equals(cleanHeader.id).delete();
        if (cleanEvents.length > 0) {
          await db.events.bulkPut(cleanEvents);
        }
      });

      nextIdxMap.delete(cleanHeader.id);
      appendQueues.delete(cleanHeader.id);
      return cleanHeader;
    },
  };
}

export const DexieSaveStore = buildStore(getDexieDb);
export const makeDexieSaveStore = (getDbFn: GetDexieDb) => buildStore(getDbFn);
