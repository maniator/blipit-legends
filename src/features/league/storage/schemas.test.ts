/**
 * Upgrade-path tests for all four v0 league collections.
 * Opens each collection, inserts a doc, reads it back, and asserts fields are intact.
 */
import "fake-indexeddb/auto";

import { createRxDatabase } from "rxdb";
import { getRxStorageMemory } from "rxdb/plugins/storage-memory";
import { describe, expect, it } from "vitest";

import { seasonGamesCollectionConfig } from "./seasonGamesSchema";
import { seasonPlayerStateCollectionConfig } from "./seasonPlayerStateSchema";
import { seasonsCollectionConfig } from "./seasonsSchema";
import { seasonTeamsCollectionConfig } from "./seasonTeamsSchema";
import type {
  SeasonGameRecord,
  SeasonPlayerStateRecord,
  SeasonRecord,
  SeasonTeamRecord,
} from "./types";

const makeDbName = () =>
  `test_league_schemas_${Math.random().toString(36).slice(2, 10)}`;

describe("seasons collection (v0)", () => {
  it("inserts and retrieves a SeasonRecord with all required fields", async () => {
    const db = await createRxDatabase({
      name: makeDbName(),
      storage: getRxStorageMemory(),
      multiInstance: false,
    });
    await db.addCollections({ seasons: seasonsCollectionConfig });

    const season: SeasonRecord = {
      id: "s_testseason01",
      name: "Test Season",
      status: "active",
      createdAt: 1700000000000,
      preset: "mini",
      seasonLength: "sprint",
      masterSeed: "seed_abc123",
      leagues: [{ id: "lg_1", name: "East", teamIds: ["ct_a", "ct_b"], dhEnabled: false }],
      currentGameDay: 0,
      rulesetVersion: 1,
    };

    await db.seasons.insert(season);
    const doc = await db.seasons.findOne("s_testseason01").exec();
    expect(doc).not.toBeNull();

    const retrieved = doc!.toJSON() as unknown as SeasonRecord;
    expect(retrieved.id).toBe("s_testseason01");
    expect(retrieved.name).toBe("Test Season");
    expect(retrieved.status).toBe("active");
    expect(retrieved.createdAt).toBe(1700000000000);
    expect(retrieved.preset).toBe("mini");
    expect(retrieved.seasonLength).toBe("sprint");
    expect(retrieved.masterSeed).toBe("seed_abc123");
    expect(retrieved.leagues).toHaveLength(1);
    expect(retrieved.leagues[0].id).toBe("lg_1");
    expect(retrieved.leagues[0].teamIds).toEqual(["ct_a", "ct_b"]);
    expect(retrieved.leagues[0].dhEnabled).toBe(false);
    expect(retrieved.currentGameDay).toBe(0);
    expect(retrieved.rulesetVersion).toBe(1);

    await db.close();
  });

  it("can query seasons by status", async () => {
    const db = await createRxDatabase({
      name: makeDbName(),
      storage: getRxStorageMemory(),
      multiInstance: false,
    });
    await db.addCollections({ seasons: seasonsCollectionConfig });

    await db.seasons.bulkInsert([
      {
        id: "s_active01",
        name: "Active Season",
        status: "active",
        createdAt: 1000,
        preset: "mini",
        seasonLength: "sprint",
        masterSeed: "ms1",
        leagues: [],
        currentGameDay: 0,
        rulesetVersion: 1,
      },
      {
        id: "s_complete01",
        name: "Complete Season",
        status: "complete",
        createdAt: 900,
        preset: "mini",
        seasonLength: "sprint",
        masterSeed: "ms2",
        leagues: [],
        currentGameDay: 10,
        rulesetVersion: 1,
      },
    ]);

    const active = await db.seasons.find({ selector: { status: "active" } }).exec();
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe("s_active01");

    await db.close();
  });
});

describe("seasonTeams collection (v0)", () => {
  it("inserts and retrieves a SeasonTeamRecord with all required fields", async () => {
    const db = await createRxDatabase({
      name: makeDbName(),
      storage: getRxStorageMemory(),
      multiInstance: false,
    });
    await db.addCollections({ seasonTeams: seasonTeamsCollectionConfig });

    const record: SeasonTeamRecord = {
      id: "st_testteam01",
      seasonId: "s_season01",
      leagueId: "lg_east",
      customTeamId: "ct_yankees",
      rosterSnapshot: { schemaVersion: 1, lineup: [], pitchers: [] },
      wins: 5,
      losses: 3,
      ties: 0,
      runDifferential: 12,
    };

    await db.seasonTeams.insert(record);
    const doc = await db.seasonTeams.findOne("st_testteam01").exec();
    expect(doc).not.toBeNull();

    const retrieved = doc!.toJSON() as unknown as SeasonTeamRecord;
    expect(retrieved.id).toBe("st_testteam01");
    expect(retrieved.seasonId).toBe("s_season01");
    expect(retrieved.leagueId).toBe("lg_east");
    expect(retrieved.customTeamId).toBe("ct_yankees");
    expect(retrieved.wins).toBe(5);
    expect(retrieved.losses).toBe(3);
    expect(retrieved.ties).toBe(0);
    expect(retrieved.runDifferential).toBe(12);

    await db.close();
  });

  it("can query seasonTeams by seasonId", async () => {
    const db = await createRxDatabase({
      name: makeDbName(),
      storage: getRxStorageMemory(),
      multiInstance: false,
    });
    await db.addCollections({ seasonTeams: seasonTeamsCollectionConfig });

    await db.seasonTeams.bulkInsert([
      {
        id: "st_a",
        seasonId: "s_001",
        leagueId: "lg_1",
        customTeamId: "ct_1",
        rosterSnapshot: {},
        wins: 0,
        losses: 0,
        ties: 0,
        runDifferential: 0,
      },
      {
        id: "st_b",
        seasonId: "s_002",
        leagueId: "lg_1",
        customTeamId: "ct_2",
        rosterSnapshot: {},
        wins: 0,
        losses: 0,
        ties: 0,
        runDifferential: 0,
      },
    ]);

    const results = await db.seasonTeams.find({ selector: { seasonId: "s_001" } }).exec();
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("st_a");

    await db.close();
  });
});

describe("seasonGames collection (v0)", () => {
  it("inserts and retrieves a SeasonGameRecord with all required fields", async () => {
    const db = await createRxDatabase({
      name: makeDbName(),
      storage: getRxStorageMemory(),
      multiInstance: false,
    });
    await db.addCollections({ seasonGames: seasonGamesCollectionConfig });

    const record: SeasonGameRecord = {
      id: "sg_testgame01",
      seasonId: "s_season01",
      gameDay: 3,
      homeSeasonTeamId: "st_home01",
      awaySeasonTeamId: "st_away01",
      seriesId: "series_001",
      status: "scheduled",
      derivedSeed: "derived_seed_xyz",
    };

    await db.seasonGames.insert(record);
    const doc = await db.seasonGames.findOne("sg_testgame01").exec();
    expect(doc).not.toBeNull();

    const retrieved = doc!.toJSON() as unknown as SeasonGameRecord;
    expect(retrieved.id).toBe("sg_testgame01");
    expect(retrieved.seasonId).toBe("s_season01");
    expect(retrieved.gameDay).toBe(3);
    expect(retrieved.homeSeasonTeamId).toBe("st_home01");
    expect(retrieved.awaySeasonTeamId).toBe("st_away01");
    expect(retrieved.seriesId).toBe("series_001");
    expect(retrieved.status).toBe("scheduled");
    expect(retrieved.derivedSeed).toBe("derived_seed_xyz");

    await db.close();
  });

  it("can query seasonGames by status", async () => {
    const db = await createRxDatabase({
      name: makeDbName(),
      storage: getRxStorageMemory(),
      multiInstance: false,
    });
    await db.addCollections({ seasonGames: seasonGamesCollectionConfig });

    await db.seasonGames.bulkInsert([
      {
        id: "sg_sched01",
        seasonId: "s_001",
        gameDay: 0,
        homeSeasonTeamId: "st_h",
        awaySeasonTeamId: "st_a",
        seriesId: "sr_1",
        status: "scheduled",
        derivedSeed: "ds1",
      },
      {
        id: "sg_comp01",
        seasonId: "s_001",
        gameDay: 0,
        homeSeasonTeamId: "st_h2",
        awaySeasonTeamId: "st_a2",
        seriesId: "sr_2",
        status: "completed",
        derivedSeed: "ds2",
      },
    ]);

    const scheduled = await db.seasonGames.find({ selector: { status: "scheduled" } }).exec();
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0].id).toBe("sg_sched01");

    await db.close();
  });
});

describe("seasonPlayerState collection (v0)", () => {
  it("inserts and retrieves a SeasonPlayerStateRecord with all required fields", async () => {
    const db = await createRxDatabase({
      name: makeDbName(),
      storage: getRxStorageMemory(),
      multiInstance: false,
    });
    await db.addCollections({ seasonPlayerState: seasonPlayerStateCollectionConfig });

    const record: SeasonPlayerStateRecord = {
      id: "s_season01:p_player01",
      seasonId: "s_season01",
      seasonTeamId: "st_team01",
      playerId: "p_player01",
      pitcherDaysRest: 2,
      pitcherAvailability: 0.4,
      pitcherStartsThisSeason: 3,
    };

    await db.seasonPlayerState.insert(record);
    const doc = await db.seasonPlayerState
      .findOne("s_season01:p_player01")
      .exec();
    expect(doc).not.toBeNull();

    const retrieved = doc!.toJSON() as unknown as SeasonPlayerStateRecord;
    expect(retrieved.id).toBe("s_season01:p_player01");
    expect(retrieved.seasonId).toBe("s_season01");
    expect(retrieved.seasonTeamId).toBe("st_team01");
    expect(retrieved.playerId).toBe("p_player01");
    expect(retrieved.pitcherDaysRest).toBe(2);
    expect(retrieved.pitcherAvailability).toBe(0.4);
    expect(retrieved.pitcherStartsThisSeason).toBe(3);

    await db.close();
  });

  it("can query by seasonId", async () => {
    const db = await createRxDatabase({
      name: makeDbName(),
      storage: getRxStorageMemory(),
      multiInstance: false,
    });
    await db.addCollections({ seasonPlayerState: seasonPlayerStateCollectionConfig });

    await db.seasonPlayerState.bulkInsert([
      {
        id: "s_001:p_a",
        seasonId: "s_001",
        seasonTeamId: "st_1",
        playerId: "p_a",
        pitcherDaysRest: 0,
        pitcherAvailability: 1.0,
        pitcherStartsThisSeason: 0,
      },
      {
        id: "s_002:p_b",
        seasonId: "s_002",
        seasonTeamId: "st_2",
        playerId: "p_b",
        pitcherDaysRest: 0,
        pitcherAvailability: 1.0,
        pitcherStartsThisSeason: 0,
      },
    ]);

    const results = await db.seasonPlayerState
      .find({ selector: { seasonId: "s_001" } })
      .exec();
    expect(results).toHaveLength(1);
    expect(results[0].playerId).toBe("p_a");

    await db.close();
  });
});
