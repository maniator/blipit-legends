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
const PORTABLE_SAVE_EXPORT_KEY = "ballgame:save:v1";
const LEGACY_RXDB_EXPORT_KEY = "ballgame:rxdb:v1";

type GetDexieDb = () => BallgameDexieDb;

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
          const existing = await db.events.where("saveId").equals(saveId).toArray();
          const highestIdx = existing.reduce((max, event) => Math.max(max, event.idx), -1);
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
          await db.events.bulkAdd(docs);
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
      const events = await db.events.where("saveId").equals(saveId).sortBy("idx");
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

      const exportedData = JSON.stringify({ header, events });
      const expectedSig = fnv1a(PORTABLE_SAVE_EXPORT_KEY + exportedData);
      const legacyExpectedSig = fnv1a(LEGACY_RXDB_EXPORT_KEY + exportedData);
      if (sig !== expectedSig && sig !== legacyExpectedSig) {
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
      const cleanEvents = Array.isArray(events) ? events : [];

      await db.transaction("rw", db.saves, db.events, async () => {
        await db.saves.put(cleanHeader);
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
