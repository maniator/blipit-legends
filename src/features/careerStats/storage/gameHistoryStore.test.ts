import "fake-indexeddb/auto";

import { getRxStorageMemory } from "rxdb/plugins/storage-memory";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { BallgameDb } from "@storage/db";
import { fnv1a } from "@storage/hash";
import type {
  BatterGameStatRecord,
  CompletedGameRecord,
  PitcherGameStatRecord,
} from "@storage/types";
import { createTestDb } from "@test/helpers/db";

import { GAME_HISTORY_EXPORT_KEY, makeGameHistoryStore } from "./gameHistoryStore";

let db: BallgameDb;
let store: ReturnType<typeof makeGameHistoryStore>;

beforeEach(async () => {
  db = await createTestDb(getRxStorageMemory());
  store = makeGameHistoryStore(() => Promise.resolve(db));
});

afterEach(async () => {
  await db.close();
});

const gameMeta: Omit<CompletedGameRecord, "id" | "schemaVersion"> = {
  playedAt: Date.now(),
  seed: "abc123",
  rngState: 42,
  homeTeamId: "Yankees",
  awayTeamId: "Mets",
  homeScore: 5,
  awayScore: 3,
  innings: 9,
};

const makeStatRow = (
  gameId: string,
  playerId: string,
): Omit<BatterGameStatRecord, "id" | "schemaVersion" | "createdAt"> => ({
  gameId,
  teamId: "Yankees",
  opponentTeamId: "Mets",
  playerId,
  nameAtGameTime: "Test Player",
  role: "batter",
  batting: {
    atBats: 4,
    hits: 2,
    walks: 0,
    strikeouts: 1,
    rbi: 1,
    singles: 1,
    doubles: 1,
    triples: 0,
    homers: 0,
    sacFlies: 0,
  },
});

describe("GameHistoryStore.commitCompletedGame", () => {
  it("writes a CompletedGameRecord and stat rows on first call", async () => {
    await store.commitCompletedGame("game_001", gameMeta, [makeStatRow("game_001", "p1")]);

    const game = await db.completedGames.findOne("game_001").exec();
    expect(game).not.toBeNull();
    expect(game?.homeScore).toBe(5);
    expect(game?.awayScore).toBe(3);
    expect(game?.innings).toBe(9);

    const stat = await db.batterGameStats.findOne("game_001:Yankees:p1").exec();
    expect(stat).not.toBeNull();
    expect(stat?.batting.hits).toBe(2);
  });

  it("is idempotent — calling twice does not create duplicate rows", async () => {
    await store.commitCompletedGame("game_002", gameMeta, [makeStatRow("game_002", "p1")]);
    // Second call with same gameId should be a no-op
    await store.commitCompletedGame("game_002", gameMeta, [makeStatRow("game_002", "p1")]);

    const games = await db.completedGames.find().exec();
    expect(games.length).toBe(1);

    const stats = await db.batterGameStats.find().exec();
    expect(stats.length).toBe(1);
  });

  it("writes separate docs for different games", async () => {
    await store.commitCompletedGame("game_003a", gameMeta, [makeStatRow("game_003a", "p1")]);
    await store.commitCompletedGame("game_003b", gameMeta, [makeStatRow("game_003b", "p1")]);

    const games = await db.completedGames.find().exec();
    expect(games.length).toBe(2);
  });

  it("handles zero stat rows gracefully", async () => {
    await store.commitCompletedGame("game_004", gameMeta, []);
    const game = await db.completedGames.findOne("game_004").exec();
    expect(game).not.toBeNull();
    const stats = await db.batterGameStats.find().exec();
    expect(stats.length).toBe(0);
  });
});

describe("GameHistoryStore.getCareerStats", () => {
  it("returns empty object when no history exists", async () => {
    const result = await store.getCareerStats(["p1"]);
    expect(result).toEqual({});
  });

  it("sums batting stats across multiple games", async () => {
    await store.commitCompletedGame("game_c1", gameMeta, [makeStatRow("game_c1", "p1")]);
    await store.commitCompletedGame("game_c2", gameMeta, [makeStatRow("game_c2", "p1")]);

    const result = await store.getCareerStats(["p1"]);
    expect(result["p1"]).toBeDefined();
    expect(result["p1"].hits).toBe(4); // 2 + 2
    expect(result["p1"].atBats).toBe(8); // 4 + 4
    expect(result["p1"].gamesPlayed).toBe(2);
  });

  it("returns empty for player keys with no rows", async () => {
    const result = await store.getCareerStats(["nobody"]);
    expect(result["nobody"]).toBeUndefined();
  });
});

describe("GameHistoryStore export/import", () => {
  it("round-trips batting sacFlies through export/import", async () => {
    const gameId = "game_sacfly_roundtrip";
    const statRow: Omit<BatterGameStatRecord, "id" | "schemaVersion" | "createdAt"> = {
      ...makeStatRow(gameId, "sf1"),
      batting: {
        ...makeStatRow(gameId, "sf1").batting,
        sacFlies: 2,
        rbi: 3,
      },
    };
    await store.commitCompletedGame(gameId, gameMeta, [statRow]);

    const json = await store.exportGameHistory();

    await db.close(); // close primary DB before opening db2 (stays within OSS 16-collection limit)
    const db2 = await createTestDb(getRxStorageMemory());
    const store2 = makeGameHistoryStore(() => Promise.resolve(db2));
    await store2.importGameHistory(json, new Set(["Yankees", "Mets"]));

    const stats = await db2.batterGameStats.find().exec();
    expect(stats).toHaveLength(1);
    expect(stats[0].batting.sacFlies).toBe(2);
    expect(stats[0].batting.rbi).toBe(3);

    await db2.close();
  });

  it("exports and re-imports history (idempotent)", async () => {
    await store.commitCompletedGame("game_e1", gameMeta, [makeStatRow("game_e1", "p1")]);

    const json = await store.exportGameHistory();
    expect(json).toContain("gameHistory");
    expect(json).toContain("game_e1");

    // Team IDs referenced by the stats
    const existingTeamIds = new Set(["Yankees", "Mets"]);

    const result1 = await store.importGameHistory(json, existingTeamIds);
    expect(result1.gamesSkipped).toBe(1); // game_e1 already exists
    expect(result1.statsSkipped).toBe(1);
    expect(result1.gamesCreated).toBe(0);

    // Re-import should still skip
    const result2 = await store.importGameHistory(json, existingTeamIds);
    expect(result2.gamesSkipped).toBe(1);
  });

  it("imports new games from bundle", async () => {
    // Build a bundle manually
    const gameDoc: CompletedGameRecord = {
      id: "game_import_1",
      playedAt: Date.now(),
      seed: "xyz",
      rngState: null,
      homeTeamId: "Yankees",
      awayTeamId: "Mets",
      homeScore: 2,
      awayScore: 1,
      innings: 9,
      schemaVersion: 1,
    };
    const payload = {
      games: [gameDoc],
      playerGameStats: [],
      pitcherGameStats: [],
      requiredTeamIds: ["Yankees", "Mets"],
    };
    const sig = fnv1a(GAME_HISTORY_EXPORT_KEY + JSON.stringify(payload));
    const bundle = JSON.stringify({
      type: "gameHistory",
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      payload,
      sig,
    });

    const result = await store.importGameHistory(bundle, new Set(["Yankees", "Mets"]));
    expect(result.gamesCreated).toBe(1);
    expect(result.gamesSkipped).toBe(0);

    const game = await db.completedGames.findOne("game_import_1").exec();
    expect(game).not.toBeNull();
  });

  it("rejects bundles with missing custom team IDs", async () => {
    const payload = {
      games: [],
      playerGameStats: [],
      pitcherGameStats: [],
      // Only custom: team IDs are validated; stock teams always pass.
      requiredTeamIds: ["ct_missingteam"],
    };
    const sig = fnv1a(GAME_HISTORY_EXPORT_KEY + JSON.stringify(payload));
    const bundle = JSON.stringify({
      type: "gameHistory",
      formatVersion: 1,
      exportedAt: "x",
      payload,
      sig,
    });

    await expect(store.importGameHistory(bundle, new Set())).rejects.toThrow(
      "Cannot import game history",
    );
  });

  it("rejects tampered bundles", async () => {
    const bundle = JSON.stringify({
      type: "gameHistory",
      formatVersion: 1,
      exportedAt: "x",
      payload: { games: [], playerGameStats: [], pitcherGameStats: [], requiredTeamIds: [] },
      sig: "00000000",
    });
    await expect(store.importGameHistory(bundle, new Set())).rejects.toThrow(
      "signature is invalid",
    );
  });

  it("rejects unknown format versions", async () => {
    const bundle = JSON.stringify({ type: "gameHistory", formatVersion: 99, payload: {} });
    await expect(store.importGameHistory(bundle, new Set())).rejects.toThrow(
      "Unsupported game history format version",
    );
  });

  it("rejects wrong bundle types", async () => {
    const bundle = JSON.stringify({ type: "customTeams", formatVersion: 1, payload: {} });
    await expect(store.importGameHistory(bundle, new Set())).rejects.toThrow(
      "Unexpected bundle type",
    );
  });

  it("rejects invalid JSON", async () => {
    await expect(store.importGameHistory("not json {}", new Set())).rejects.toThrow("Invalid JSON");
  });
});

describe("GameHistoryStore — gameInstanceId deduplication across save slots", () => {
  it("finishing the same game from two different save slots writes only one CompletedGameRecord", async () => {
    // Two save slots (saveA, saveB) represent mid-game snapshots of the SAME game run.
    // Both carry the same gameInstanceId.
    const sharedGameInstanceId = "game_instance_shared";
    const saveIdA = "save_slot_a";
    const saveIdB = "save_slot_b";

    // Slot A finishes first.
    await store.commitCompletedGame(
      sharedGameInstanceId,
      { ...gameMeta, committedBySaveId: saveIdA },
      [makeStatRow(sharedGameInstanceId, "p1")],
    );

    // Slot B finishes the same game (same gameInstanceId). Should be a no-op.
    await store.commitCompletedGame(
      sharedGameInstanceId,
      { ...gameMeta, committedBySaveId: saveIdB },
      [makeStatRow(sharedGameInstanceId, "p1")],
    );

    const allGames = await db.completedGames.find().exec();
    expect(allGames.length).toBe(1);
    expect(allGames[0].committedBySaveId).toBe(saveIdA); // first commit wins

    const allStats = await db.batterGameStats.find().exec();
    expect(allStats.length).toBe(1); // no duplicate stat row

    // Career totals should reflect exactly one game's worth of stats.
    const career = await store.getCareerStats(["p1"]);
    expect(career["p1"].gamesPlayed).toBe(1);
    expect(career["p1"].hits).toBe(2); // not 4 (would be 4 if double-counted)
  });
});

// ---------------------------------------------------------------------------
// Pitcher stat helpers
// ---------------------------------------------------------------------------

const makePitcherRow = (
  gameId: string,
  pitcherId: string,
  overrides: Partial<Omit<PitcherGameStatRecord, "id" | "schemaVersion" | "createdAt">> = {},
): Omit<PitcherGameStatRecord, "id" | "schemaVersion" | "createdAt"> => ({
  gameId,
  teamId: "Yankees",
  opponentTeamId: "Mets",
  playerId: pitcherId,
  nameAtGameTime: "Test Pitcher",
  outsPitched: 9,
  battersFaced: 12,
  pitchesThrown: 30,
  hitsAllowed: 3,
  walksAllowed: 1,
  strikeoutsRecorded: 5,
  homersAllowed: 0,
  runsAllowed: 1,
  earnedRuns: 1,
  saves: 0,
  holds: 0,
  blownSaves: 0,
  ...overrides,
});

// ---------------------------------------------------------------------------
// Pitcher stats — commitCompletedGame writes pitcher rows
// ---------------------------------------------------------------------------

describe("commitCompletedGame — pitcher stats", () => {
  it("writes pitcher rows to pitcherGameStats collection", async () => {
    const gameId = "game_pitcher_1";
    await store.commitCompletedGame(
      gameId,
      { ...gameMeta },
      [makeStatRow(gameId, "b1")],
      [makePitcherRow(gameId, "p1")],
    );

    const pitchers = await db.pitcherGameStats.find().exec();
    expect(pitchers).toHaveLength(1);
    expect(pitchers[0].playerId).toBe("p1");
    expect(pitchers[0].outsPitched).toBe(9);
    expect(pitchers[0].saves).toBe(0);
  });

  it("is idempotent for pitcher rows — no duplicates on second commit", async () => {
    const gameId = "game_pitcher_2";
    const pitcherRow = makePitcherRow(gameId, "p1", { saves: 1 });

    await store.commitCompletedGame(gameId, { ...gameMeta }, [], [pitcherRow]);
    // Re-commit should not create a duplicate.
    await store.commitCompletedGame(gameId, { ...gameMeta }, [], [pitcherRow]);

    const pitchers = await db.pitcherGameStats.find().exec();
    expect(pitchers).toHaveLength(1);
    expect(pitchers[0].saves).toBe(1);
  });

  it("writes pitcher rows even when batting stat rows are empty", async () => {
    const gameId = "game_pitcher_only";
    await store.commitCompletedGame(
      gameId,
      { ...gameMeta },
      [],
      [
        makePitcherRow(gameId, "p1"),
        makePitcherRow(gameId, "p2", {
          teamId: "Mets",
          opponentTeamId: "Yankees",
          playerId: "Mets:p2",
        }),
      ],
    );

    const pitchers = await db.pitcherGameStats.find().exec();
    expect(pitchers).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// getTeamCareerBattingStats
// ---------------------------------------------------------------------------

describe("getTeamCareerBattingStats", () => {
  it("returns empty array for team with no history", async () => {
    const result = await store.getTeamCareerBattingStats("NonExistentTeam");
    expect(result).toHaveLength(0);
  });

  it("aggregates batting stats across multiple games for a team", async () => {
    const game1 = "game_batting_1";
    const game2 = "game_batting_2";
    await store.commitCompletedGame(game1, { ...gameMeta }, [makeStatRow(game1, "b1")]);
    await store.commitCompletedGame(game2, { ...gameMeta, playedAt: Date.now() + 1 }, [
      makeStatRow(game2, "b1"),
    ]);

    const result = await store.getTeamCareerBattingStats("Yankees");
    expect(result).toHaveLength(1); // one player
    const player = result[0];
    expect(player.gamesPlayed).toBe(2);
    expect(player.hits).toBe(4); // 2 hits × 2 games
    expect(player.atBats).toBe(8); // 4 AB × 2 games
    expect(player.rbi).toBe(2);
  });

  it("returns separate rows for different players on the same team", async () => {
    const gameId = "game_batting_3";
    await store.commitCompletedGame(gameId, { ...gameMeta }, [
      makeStatRow(gameId, "b1"),
      makeStatRow(gameId, "b2"),
    ]);

    const result = await store.getTeamCareerBattingStats("Yankees");
    expect(result).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// getTeamCareerPitchingStats
// ---------------------------------------------------------------------------

describe("getTeamCareerPitchingStats", () => {
  it("returns empty array for team with no pitching history", async () => {
    const result = await store.getTeamCareerPitchingStats("NonExistentTeam");
    expect(result).toHaveLength(0);
  });

  it("aggregates pitching stats across multiple games", async () => {
    const game1 = "game_pitching_1";
    const game2 = "game_pitching_2";
    await store.commitCompletedGame(game1, { ...gameMeta }, [], [makePitcherRow(game1, "p1")]);
    await store.commitCompletedGame(
      game2,
      { ...gameMeta, playedAt: Date.now() + 1 },
      [],
      [makePitcherRow(game2, "p1", { saves: 1 })],
    );

    const result = await store.getTeamCareerPitchingStats("Yankees");
    expect(result).toHaveLength(1);
    const pitcher = result[0];
    expect(pitcher.gamesPlayed).toBe(2);
    expect(pitcher.outsPitched).toBe(18); // 9 × 2
    expect(pitcher.saves).toBe(1); // from game2
    expect(pitcher.strikeoutsRecorded).toBe(10); // 5 × 2
  });

  it("returns separate rows for different pitchers on same team", async () => {
    const gameId = "game_pitching_2p";
    await store.commitCompletedGame(
      gameId,
      { ...gameMeta },
      [],
      [makePitcherRow(gameId, "p1"), makePitcherRow(gameId, "p2", { playerId: "p2" })],
    );

    const result = await store.getTeamCareerPitchingStats("Yankees");
    expect(result).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// getPlayerCareerBatting + getPlayerCareerPitching
// ---------------------------------------------------------------------------

describe("getPlayerCareerBatting", () => {
  it("returns empty array when player has no history", async () => {
    const result = await store.getPlayerCareerBatting("nobody");
    expect(result).toHaveLength(0);
  });

  it("returns per-game rows ordered by createdAt", async () => {
    const game1 = "game_player_bat_1";
    const game2 = "game_player_bat_2";
    await store.commitCompletedGame(game1, { ...gameMeta }, [makeStatRow(game1, "p1")]);
    // Small delay to ensure different createdAt values.
    await new Promise((r) => setTimeout(r, 5));
    await store.commitCompletedGame(game2, { ...gameMeta, playedAt: Date.now() + 1 }, [
      makeStatRow(game2, "p1"),
    ]);

    const result = await store.getPlayerCareerBatting("p1");
    expect(result).toHaveLength(2);
    expect(result[0].gameId).toBe(game1);
    expect(result[1].gameId).toBe(game2);
  });
});

describe("getPlayerCareerPitching", () => {
  it("returns empty array when pitcher has no history", async () => {
    const result = await store.getPlayerCareerPitching("nobody");
    expect(result).toHaveLength(0);
  });

  it("returns per-game rows for a pitcher", async () => {
    const game1 = "game_player_pitch_1";
    await store.commitCompletedGame(
      game1,
      { ...gameMeta },
      [],
      [makePitcherRow(game1, "p1", { saves: 1, outsPitched: 9 })],
    );

    const result = await store.getPlayerCareerPitching("p1");
    expect(result).toHaveLength(1);
    expect(result[0].saves).toBe(1);
    expect(result[0].outsPitched).toBe(9);
  });
});

// ---------------------------------------------------------------------------
// Idempotency: same gameInstanceId from two different save slots
// ---------------------------------------------------------------------------

describe("idempotency: pitcher stats from duplicate save slots", () => {
  it("does not double-count pitcher rows when same gameInstanceId committed twice", async () => {
    const sharedGameInstanceId = "shared_game_pitcher";
    const saveIdA = "save_slot_A";
    const saveIdB = "save_slot_B";

    // Save A commits first.
    await store.commitCompletedGame(
      sharedGameInstanceId,
      { ...gameMeta, committedBySaveId: saveIdA },
      [],
      [makePitcherRow(sharedGameInstanceId, "p1", { outsPitched: 27, saves: 1 })],
    );

    // Save B (same gameInstanceId) commits second — should be a no-op for pitcher row.
    await store.commitCompletedGame(
      sharedGameInstanceId,
      { ...gameMeta, committedBySaveId: saveIdB },
      [],
      [makePitcherRow(sharedGameInstanceId, "p1", { outsPitched: 27, saves: 1 })],
    );

    const allPitchers = await db.pitcherGameStats.find().exec();
    expect(allPitchers).toHaveLength(1); // no duplicate

    // Career stats should reflect exactly one game.
    const career = await store.getTeamCareerPitchingStats("Yankees");
    expect(career).toHaveLength(1);
    expect(career[0].saves).toBe(1); // not 2
    expect(career[0].outsPitched).toBe(27); // not 54
  });
});

// ---------------------------------------------------------------------------
// Export / import — pitcherGameStats included in bundle
// ---------------------------------------------------------------------------

describe("exportGameHistory / importGameHistory — pitcher stats", () => {
  it("exported bundle includes pitcherGameStats array", async () => {
    const gameId = "game_export_pitcher";
    await store.commitCompletedGame(
      gameId,
      { ...gameMeta },
      [makeStatRow(gameId, "b1")],
      [makePitcherRow(gameId, "p1", { saves: 1 })],
    );

    const json = await store.exportGameHistory();
    const parsed = JSON.parse(json);
    expect(parsed.formatVersion).toBe(1);
    expect(Array.isArray(parsed.payload.pitcherGameStats)).toBe(true);
    expect(parsed.payload.pitcherGameStats).toHaveLength(1);
    expect(parsed.payload.pitcherGameStats[0].saves).toBe(1);
  });

  it("importGameHistory imports pitcher rows from bundle", async () => {
    const gameId = "game_import_pitcher";
    await store.commitCompletedGame(gameId, { ...gameMeta }, [], [makePitcherRow(gameId, "p1")]);

    const json = await store.exportGameHistory();

    // Fresh DB for import.
    await db.close(); // close primary DB before opening db2 (stays within OSS 16-collection limit)
    const db2 = await createTestDb(getRxStorageMemory());
    const store2 = makeGameHistoryStore(() => Promise.resolve(db2));

    const result = await store2.importGameHistory(json, new Set(["Yankees", "Mets"]));
    expect(result.pitcherStatsCreated).toBe(1);
    expect(result.pitcherStatsSkipped).toBe(0);

    const pitchers = await db2.pitcherGameStats.find().exec();
    expect(pitchers).toHaveLength(1);

    await db2.close();
  });

  it("import is idempotent for pitcher rows", async () => {
    const gameId = "game_import_pitcher_idem";
    await store.commitCompletedGame(gameId, { ...gameMeta }, [], [makePitcherRow(gameId, "p1")]);
    const json = await store.exportGameHistory();

    await db.close(); // close primary DB before opening db2 (stays within OSS 16-collection limit)
    const db2 = await createTestDb(getRxStorageMemory());
    const store2 = makeGameHistoryStore(() => Promise.resolve(db2));

    const existingTeamIds = new Set(["Yankees", "Mets"]);
    const result1 = await store2.importGameHistory(json, existingTeamIds);
    const result2 = await store2.importGameHistory(json, existingTeamIds);

    expect(result1.pitcherStatsCreated).toBe(1);
    expect(result2.pitcherStatsCreated).toBe(0); // skipped on second import
    expect(result2.pitcherStatsSkipped).toBe(1);

    const pitchers = await db2.pitcherGameStats.find().exec();
    expect(pitchers).toHaveLength(1); // no duplicates

    await db2.close();
  });
});

// ---------------------------------------------------------------------------
// getTeamCareerSummary
// ---------------------------------------------------------------------------

describe("getTeamCareerSummary", () => {
  it("returns zero stats for a team with no games", async () => {
    const result = await store.getTeamCareerSummary("NoSuchTeam");
    expect(result.gamesPlayed).toBe(0);
    expect(result.wins).toBe(0);
    expect(result.losses).toBe(0);
    expect(result.runsScored).toBe(0);
    expect(result.runsAllowed).toBe(0);
    expect(result.streak).toBe("-");
  });

  it("correctly counts wins and losses for home team", async () => {
    // Home team (Yankees) wins game 1, loses game 2
    await store.commitCompletedGame(
      "sum_g1",
      { ...gameMeta, homeScore: 5, awayScore: 3, playedAt: 1000 },
      [],
    );
    await store.commitCompletedGame(
      "sum_g2",
      { ...gameMeta, homeScore: 2, awayScore: 4, playedAt: 2000 },
      [],
    );

    const result = await store.getTeamCareerSummary("Yankees");
    expect(result.gamesPlayed).toBe(2);
    expect(result.wins).toBe(1);
    expect(result.losses).toBe(1);
  });

  it("correctly counts wins and losses for away team", async () => {
    // Away team (Mets) wins game 1 (away wins when awayScore > homeScore)
    await store.commitCompletedGame(
      "sum_aw1",
      { ...gameMeta, homeScore: 3, awayScore: 5, playedAt: 1000 },
      [],
    );

    const result = await store.getTeamCareerSummary("Mets");
    expect(result.wins).toBe(1);
    expect(result.losses).toBe(0);
    expect(result.runsScored).toBe(5);
    expect(result.runsAllowed).toBe(3);
  });

  it("computes run differential", async () => {
    await store.commitCompletedGame(
      "sum_rd1",
      { ...gameMeta, homeScore: 7, awayScore: 3, playedAt: 1000 },
      [],
    );

    const result = await store.getTeamCareerSummary("Yankees");
    expect(result.runDiff).toBe(4); // 7 - 3
    expect(result.runsScored).toBe(7);
    expect(result.runsAllowed).toBe(3);
  });

  it("computes win percentage correctly", async () => {
    await store.commitCompletedGame(
      "sum_wp1",
      { ...gameMeta, homeScore: 5, awayScore: 3, playedAt: 1000 },
      [],
    );
    await store.commitCompletedGame(
      "sum_wp2",
      {
        ...gameMeta,
        homeScore: 5,
        awayScore: 3,
        playedAt: 2000,
        homeTeamId: "Yankees",
        awayTeamId: "other",
      },
      [],
    );
    await store.commitCompletedGame(
      "sum_wp3",
      { ...gameMeta, homeScore: 3, awayScore: 5, playedAt: 3000 },
      [],
    );

    const result = await store.getTeamCareerSummary("Yankees");
    // 2 wins (sum_wp1 home win, sum_wp2 home win), 1 loss (sum_wp3 home loss)
    expect(result.wins).toBe(2);
    expect(result.losses).toBe(1);
    expect(result.winPct).toBeCloseTo(2 / 3);
  });

  it("computes current streak from most recent games", async () => {
    // 3 consecutive home wins
    await store.commitCompletedGame(
      "sum_str1",
      { ...gameMeta, homeScore: 5, awayScore: 3, playedAt: 1000 },
      [],
    );
    await store.commitCompletedGame(
      "sum_str2",
      { ...gameMeta, homeScore: 5, awayScore: 3, playedAt: 2000 },
      [],
    );
    await store.commitCompletedGame(
      "sum_str3",
      { ...gameMeta, homeScore: 5, awayScore: 3, playedAt: 3000 },
      [],
    );

    const result = await store.getTeamCareerSummary("Yankees");
    expect(result.streak).toBe("W3");
  });

  it("resets streak on loss", async () => {
    await store.commitCompletedGame(
      "sum_rstr1",
      { ...gameMeta, homeScore: 5, awayScore: 3, playedAt: 1000 },
      [],
    );
    await store.commitCompletedGame(
      "sum_rstr2",
      { ...gameMeta, homeScore: 3, awayScore: 5, playedAt: 2000 },
      [],
    );

    const result = await store.getTeamCareerSummary("Yankees");
    expect(result.streak).toBe("L1");
  });

  it("computes last10 record from the 10 most recent games", async () => {
    // 12 games: first 2 are wins, next 10 are losses
    for (let i = 0; i < 2; i++) {
      await store.commitCompletedGame(
        `sum_l10_w${i}`,
        { ...gameMeta, homeScore: 5, awayScore: 3, playedAt: i * 100 },
        [],
      );
    }
    for (let i = 0; i < 10; i++) {
      await store.commitCompletedGame(
        `sum_l10_l${i}`,
        { ...gameMeta, homeScore: 3, awayScore: 5, playedAt: 200 + i * 100 },
        [],
      );
    }

    const result = await store.getTeamCareerSummary("Yankees");
    expect(result.gamesPlayed).toBe(12);
    // last 10 are all losses
    expect(result.last10.wins).toBe(0);
    expect(result.last10.losses).toBe(10);
  });

  it("includes games where team appears as both home and away", async () => {
    // 1 home game, 1 away game
    await store.commitCompletedGame(
      "sum_mix1",
      {
        ...gameMeta,
        homeTeamId: "Yankees",
        awayTeamId: "Mets",
        homeScore: 5,
        awayScore: 3,
        playedAt: 1000,
      },
      [],
    );
    await store.commitCompletedGame(
      "sum_mix2",
      {
        ...gameMeta,
        homeTeamId: "Red Sox",
        awayTeamId: "Yankees",
        homeScore: 2,
        awayScore: 6,
        playedAt: 2000,
      },
      [],
    );

    const result = await store.getTeamCareerSummary("Yankees");
    expect(result.gamesPlayed).toBe(2);
    expect(result.wins).toBe(2); // home win + away win
    expect(result.runsScored).toBe(11); // 5 (home) + 6 (away)
    expect(result.runsAllowed).toBe(5); // 3 (home) + 2 (away)
  });

  it("handles tied games (rs === ra): counts as ties, not losses, and excludes from winPct", async () => {
    // Win, Loss, Tie
    await store.commitCompletedGame(
      "sum_tie_w",
      { ...gameMeta, homeScore: 5, awayScore: 3, playedAt: 1000 },
      [],
    );
    await store.commitCompletedGame(
      "sum_tie_l",
      { ...gameMeta, homeScore: 2, awayScore: 4, playedAt: 2000 },
      [],
    );
    await store.commitCompletedGame(
      "sum_tie_t",
      { ...gameMeta, homeScore: 3, awayScore: 3, playedAt: 3000 },
      [],
    );

    const result = await store.getTeamCareerSummary("Yankees");
    expect(result.gamesPlayed).toBe(3); // 1W + 1L + 1T
    expect(result.wins).toBe(1);
    expect(result.losses).toBe(1);
    expect(result.ties).toBe(1);
    // Win% excludes ties: 1 / (1 + 1) = 0.5
    expect(result.winPct).toBeCloseTo(0.5);
    // Streak: most recent result is "T"
    expect(result.streak).toBe("T1");
    // last10 includes the tie
    expect(result.last10.wins).toBe(1);
    expect(result.last10.losses).toBe(1);
    expect(result.last10.ties).toBe(1);
  });

  it("tie streak: consecutive ties are tracked with T prefix", async () => {
    await store.commitCompletedGame(
      "sum_tstr_w",
      { ...gameMeta, homeScore: 5, awayScore: 3, playedAt: 1000 },
      [],
    );
    await store.commitCompletedGame(
      "sum_tstr_t1",
      { ...gameMeta, homeScore: 3, awayScore: 3, playedAt: 2000 },
      [],
    );
    await store.commitCompletedGame(
      "sum_tstr_t2",
      { ...gameMeta, homeScore: 2, awayScore: 2, playedAt: 3000 },
      [],
    );

    const result = await store.getTeamCareerSummary("Yankees");
    expect(result.streak).toBe("T2");
  });
});

// ---------------------------------------------------------------------------
// getTeamBattingLeaders
// ---------------------------------------------------------------------------

describe("getTeamBattingLeaders", () => {
  it("returns null leaders for team with no history", async () => {
    const result = await store.getTeamBattingLeaders("NoTeam");
    expect(result.hrLeader).toBeNull();
    expect(result.avgLeader).toBeNull();
    expect(result.rbiLeader).toBeNull();
  });

  it("identifies HR leader correctly", async () => {
    const gameId = "leads_hr";
    const row1: Omit<BatterGameStatRecord, "id" | "schemaVersion" | "createdAt"> = {
      ...makeStatRow(gameId, "b1"),
      nameAtGameTime: "Homer King",
      batting: { ...makeStatRow(gameId, "b1").batting, homers: 3, rbi: 3 },
    };
    const row2: Omit<BatterGameStatRecord, "id" | "schemaVersion" | "createdAt"> = {
      ...makeStatRow(gameId, "b2"),
      playerId: "Yankees:b2",
      nameAtGameTime: "Single Steve",
      batting: { ...makeStatRow(gameId, "b2").batting, homers: 1, rbi: 1 },
    };
    await store.commitCompletedGame(gameId, { ...gameMeta }, [row1, row2]);

    const result = await store.getTeamBattingLeaders("Yankees");
    expect(result.hrLeader?.nameAtGameTime).toBe("Homer King");
    expect(result.hrLeader?.value).toBe(3);
  });

  it("excludes AVG leader below minimum AB threshold", async () => {
    const gameId = "leads_avg";
    // p1 has 19 AB (below threshold of 20), high avg
    const highAvgLowAb: Omit<BatterGameStatRecord, "id" | "schemaVersion" | "createdAt"> = {
      ...makeStatRow(gameId, "b1"),
      nameAtGameTime: "High AVG",
      batting: { ...makeStatRow(gameId, "b1").batting, atBats: 19, hits: 18 },
    };
    // p2 has 25 AB (above threshold), lower avg
    const qualifiedPlayer: Omit<BatterGameStatRecord, "id" | "schemaVersion" | "createdAt"> = {
      ...makeStatRow(gameId, "b2"),
      playerId: "Yankees:b2",
      nameAtGameTime: "Qualified",
      batting: { ...makeStatRow(gameId, "b2").batting, atBats: 25, hits: 10 },
    };
    await store.commitCompletedGame(gameId, { ...gameMeta }, [highAvgLowAb, qualifiedPlayer]);

    const result = await store.getTeamBattingLeaders("Yankees", { minAbForAvg: 20 });
    // High AVG player excluded; Qualified player with 25 AB should be leader
    expect(result.avgLeader?.nameAtGameTime).toBe("Qualified");
  });

  it("returns null avgLeader when no player meets AB threshold", async () => {
    const gameId = "leads_avg_none";
    const row: Omit<BatterGameStatRecord, "id" | "schemaVersion" | "createdAt"> = {
      ...makeStatRow(gameId, "b1"),
      batting: { ...makeStatRow(gameId, "b1").batting, atBats: 5, hits: 3 },
    };
    await store.commitCompletedGame(gameId, { ...gameMeta }, [row]);

    const result = await store.getTeamBattingLeaders("Yankees", { minAbForAvg: 20 });
    expect(result.avgLeader).toBeNull();
  });

  it("uses deterministic tie-breaking: value desc, gamesPlayed desc, name asc", async () => {
    // Two players both have 2 HR; p2 has more games played
    const g1 = "leads_tie1";
    const g2 = "leads_tie2";
    const rowAliceG1: Omit<BatterGameStatRecord, "id" | "schemaVersion" | "createdAt"> = {
      ...makeStatRow(g1, "alice"),
      playerId: "Yankees:alice",
      nameAtGameTime: "Alice",
      batting: { ...makeStatRow(g1, "alice").batting, homers: 2 },
    };
    const rowBobG1: Omit<BatterGameStatRecord, "id" | "schemaVersion" | "createdAt"> = {
      ...makeStatRow(g1, "bob"),
      playerId: "Yankees:bob",
      nameAtGameTime: "Bob",
      batting: { ...makeStatRow(g1, "bob").batting, homers: 2 },
    };
    const rowAliceG2: Omit<BatterGameStatRecord, "id" | "schemaVersion" | "createdAt"> = {
      ...makeStatRow(g2, "alice"),
      playerId: "Yankees:alice",
      nameAtGameTime: "Alice",
      batting: { ...makeStatRow(g2, "alice").batting, homers: 0 },
    };
    await store.commitCompletedGame(g1, { ...gameMeta, playedAt: 1000 }, [rowAliceG1, rowBobG1]);
    await store.commitCompletedGame(g2, { ...gameMeta, playedAt: 2000 }, [rowAliceG2]);

    const result = await store.getTeamBattingLeaders("Yankees");
    // Both Alice and Bob have 2 HR. Alice has 2 games, Bob has 1 → Alice wins on gamesPlayed.
    expect(result.hrLeader?.nameAtGameTime).toBe("Alice");
  });
});

// ---------------------------------------------------------------------------
// getTeamPitchingLeaders
// ---------------------------------------------------------------------------

describe("getTeamPitchingLeaders", () => {
  it("returns null leaders for team with no history", async () => {
    const result = await store.getTeamPitchingLeaders("NoTeam");
    expect(result.eraLeader).toBeNull();
    expect(result.savesLeader).toBeNull();
    expect(result.strikeoutsLeader).toBeNull();
  });

  it("identifies saves leader correctly", async () => {
    const gameId = "leads_sv";
    const closerRow = makePitcherRow(gameId, "closer", { saves: 2, nameAtGameTime: "Closer C" });
    const starterRow = makePitcherRow(gameId, "starter", {
      playerId: "Yankees:starter",
      saves: 0,
      nameAtGameTime: "Starter S",
    });
    await store.commitCompletedGame(gameId, { ...gameMeta }, [], [closerRow, starterRow]);

    const result = await store.getTeamPitchingLeaders("Yankees");
    expect(result.savesLeader?.nameAtGameTime).toBe("Closer C");
    expect(result.savesLeader?.value).toBe(2);
  });

  it("identifies strikeouts leader correctly", async () => {
    const gameId = "leads_k";
    const kRow = makePitcherRow(gameId, "kpitcher", {
      strikeoutsRecorded: 12,
      nameAtGameTime: "K King",
    });
    const lowKRow = makePitcherRow(gameId, "lowk", {
      playerId: "Yankees:lowk",
      strikeoutsRecorded: 3,
      nameAtGameTime: "Low K",
    });
    await store.commitCompletedGame(gameId, { ...gameMeta }, [], [kRow, lowKRow]);

    const result = await store.getTeamPitchingLeaders("Yankees");
    expect(result.strikeoutsLeader?.nameAtGameTime).toBe("K King");
    expect(result.strikeoutsLeader?.value).toBe(12);
  });

  it("excludes ERA leader below minimum outs threshold", async () => {
    const gameId = "leads_era";
    // p1 has 10 outs (below 30 threshold), perfect ERA
    const lowOutsGoodEra = makePitcherRow(gameId, "p1", {
      outsPitched: 10,
      earnedRuns: 0,
      nameAtGameTime: "Perfect ERA",
    });
    // p2 has 35 outs (above threshold), decent ERA
    const qualifiedPitcher = makePitcherRow(gameId, "p2", {
      playerId: "Yankees:p2",
      outsPitched: 35,
      earnedRuns: 4,
      nameAtGameTime: "Qualified Pitcher",
    });
    await store.commitCompletedGame(
      gameId,
      { ...gameMeta },
      [],
      [lowOutsGoodEra, qualifiedPitcher],
    );

    const result = await store.getTeamPitchingLeaders("Yankees", { minOutsForEra: 30 });
    // Perfect ERA player excluded; Qualified pitcher with 35 outs should be leader
    expect(result.eraLeader?.nameAtGameTime).toBe("Qualified Pitcher");
  });

  it("returns null eraLeader when no pitcher meets outs threshold", async () => {
    const gameId = "leads_era_none";
    const row = makePitcherRow(gameId, "p1", { outsPitched: 10 });
    await store.commitCompletedGame(gameId, { ...gameMeta }, [], [row]);

    const result = await store.getTeamPitchingLeaders("Yankees", { minOutsForEra: 30 });
    expect(result.eraLeader).toBeNull();
  });
});
