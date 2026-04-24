import Dexie, { type Table } from "dexie";

import type {
  BatterGameStatRecord,
  CompletedGameRecord,
  EventRecord,
  PitcherGameStatRecord,
  PlayerRecord,
  SaveRecord,
  TeamRecord,
} from "@storage/types";

export const DEXIE_DB_NAME = "ballgame-dexie";
export const DEXIE_SCHEMA_VERSION = 1;

export class BallgameDexieDb extends Dexie {
  saves!: Table<SaveRecord, string>;
  events!: Table<EventRecord, string>;
  teams!: Table<TeamRecord, string>;
  players!: Table<PlayerRecord, string>;
  completedGames!: Table<CompletedGameRecord, string>;
  batterGameStats!: Table<BatterGameStatRecord, string>;
  pitcherGameStats!: Table<PitcherGameStatRecord, string>;

  constructor(name = DEXIE_DB_NAME) {
    super(name);

    this.version(DEXIE_SCHEMA_VERSION).stores({
      saves: "id, updatedAt",
      events: "id, saveId, [saveId+idx]",
      teams: "id, updatedAt, nameLowercase",
      players: "id, teamId",
      completedGames: "id, playedAt, [homeTeamId+playedAt], [awayTeamId+playedAt]",
      batterGameStats: "id, gameId, [playerId+createdAt], [teamId+createdAt]",
      pitcherGameStats: "id, gameId, [playerId+createdAt], [teamId+createdAt]",
    });
  }
}

let dexieDb: BallgameDexieDb | null = null;

export const createDexieDb = (name?: string): BallgameDexieDb => new BallgameDexieDb(name);

export const getDexieDb = (): BallgameDexieDb => {
  dexieDb ??= createDexieDb();
  return dexieDb;
};

export const closeDexieDb = async (): Promise<void> => {
  dexieDb?.close();
  dexieDb = null;
};

export const deleteDexieDb = async (name = DEXIE_DB_NAME): Promise<void> => {
  if (dexieDb && name === DEXIE_DB_NAME) {
    dexieDb.close();
    dexieDb = null;
  }
  await Dexie.delete(name);
};
