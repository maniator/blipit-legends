/**
 * Unit tests for buildSeasonGameSetup.
 *
 * Uses fake-indexeddb + in-memory RxDB storage to verify the utility correctly
 * loads team docs, populates rosters, re-initialises the PRNG, and returns a
 * well-formed ExhibitionGameSetup.
 */
import "fake-indexeddb/auto";

import { makeCustomTeamStore } from "@feat/customTeams/storage/customTeamStore";
import type { SeasonGameRecord, SeasonTeamRecord } from "@feat/league/storage/types";
import { getRxStorageMemory } from "rxdb/plugins/storage-memory";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BallgameDb } from "@storage/db";
import { makePlayer } from "@test/helpers/customTeams";
import { createTestDb } from "@test/helpers/db";

import { buildSeasonGameSetup } from "./buildSeasonGameSetup";

vi.mock("@shared/utils/rng", () => ({
  reinitSeed: vi.fn(),
}));

import { reinitSeed } from "@shared/utils/rng";

let db: BallgameDb;
let homeCustomTeamId: string;
let awayCustomTeamId: string;

const makeSeasonTeamRecord = (
  id: string,
  seasonId: string,
  customTeamId: string,
): SeasonTeamRecord => ({
  id,
  seasonId,
  leagueId: "league-1",
  customTeamId,
  rosterSnapshot: { name: "TestTeam", city: "" } as Record<string, unknown>,
  wins: 0,
  losses: 0,
  ties: 0,
  runDifferential: 0,
});

const makeSeasonGameRecord = (
  homeSeasonTeamId: string,
  awaySeasonTeamId: string,
): SeasonGameRecord => ({
  id: "game-1",
  seasonId: "season-1",
  gameDay: 0,
  homeSeasonTeamId,
  awaySeasonTeamId,
  seriesId: "series-1",
  status: "scheduled",
  derivedSeed: "test-seed-42",
  boxscore: null,
  completedAt: null,
  claimedBy: null,
});

beforeEach(async () => {
  vi.clearAllMocks();
  db = await createTestDb(getRxStorageMemory());

  const store = makeCustomTeamStore(() => Promise.resolve(db));

  homeCustomTeamId = await store.createCustomTeam({
    name: "Home Team",
    city: "Springfield",
    roster: {
      lineup: [
        makePlayer({ name: "H1" }),
        makePlayer({ name: "H2" }),
        makePlayer({ name: "H3" }),
        makePlayer({ name: "H4" }),
        makePlayer({ name: "H5" }),
        makePlayer({ name: "H6" }),
        makePlayer({ name: "H7" }),
        makePlayer({ name: "H8" }),
        makePlayer({ name: "H9" }),
      ],
      bench: [makePlayer({ name: "HB1" })],
      pitchers: [
        makePlayer({
          name: "HP1",
          role: "pitcher",
          pitching: { velocity: 55, control: 55, movement: 50, stamina: 70 },
        }),
      ],
    },
  });

  awayCustomTeamId = await store.createCustomTeam({
    name: "Away Team",
    city: "Shelbyville",
    roster: {
      lineup: [
        makePlayer({ name: "A1" }),
        makePlayer({ name: "A2" }),
        makePlayer({ name: "A3" }),
        makePlayer({ name: "A4" }),
        makePlayer({ name: "A5" }),
        makePlayer({ name: "A6" }),
        makePlayer({ name: "A7" }),
        makePlayer({ name: "A8" }),
        makePlayer({ name: "A9" }),
      ],
      bench: [],
      pitchers: [makePlayer({ name: "AP1", role: "pitcher" })],
    },
  });
});

afterEach(async () => {
  await db.close();
});

describe("buildSeasonGameSetup", () => {
  it("returns a setup with correct homeTeam and awayTeam IDs", async () => {
    const homeSeasonTeam = makeSeasonTeamRecord("st-home", "season-1", homeCustomTeamId);
    const awaySeasonTeam = makeSeasonTeamRecord("st-away", "season-1", awayCustomTeamId);
    const game = makeSeasonGameRecord("st-home", "st-away");

    const setup = await buildSeasonGameSetup(db, game, homeSeasonTeam, awaySeasonTeam, null);

    expect(setup.homeTeam).toBe(homeCustomTeamId);
    expect(setup.awayTeam).toBe(awayCustomTeamId);
  });

  it("populates homeTeamLabel and awayTeamLabel from city + name", async () => {
    const homeSeasonTeam = makeSeasonTeamRecord("st-home", "season-1", homeCustomTeamId);
    const awaySeasonTeam = makeSeasonTeamRecord("st-away", "season-1", awayCustomTeamId);
    const game = makeSeasonGameRecord("st-home", "st-away");

    const setup = await buildSeasonGameSetup(db, game, homeSeasonTeam, awaySeasonTeam, null);

    expect(setup.homeTeamLabel).toBe("Springfield Home Team");
    expect(setup.awayTeamLabel).toBe("Shelbyville Away Team");
  });

  it("passes managedTeam through to setup", async () => {
    const homeSeasonTeam = makeSeasonTeamRecord("st-home", "season-1", homeCustomTeamId);
    const awaySeasonTeam = makeSeasonTeamRecord("st-away", "season-1", awayCustomTeamId);
    const game = makeSeasonGameRecord("st-home", "st-away");

    const watchSetup = await buildSeasonGameSetup(db, game, homeSeasonTeam, awaySeasonTeam, null);
    expect(watchSetup.managedTeam).toBeNull();

    const playHomeSetup = await buildSeasonGameSetup(db, game, homeSeasonTeam, awaySeasonTeam, 1);
    expect(playHomeSetup.managedTeam).toBe(1);

    const playAwaySetup = await buildSeasonGameSetup(db, game, homeSeasonTeam, awaySeasonTeam, 0);
    expect(playAwaySetup.managedTeam).toBe(0);
  });

  it("returns the game derivedSeed in the setup (reinitSeed called by GameInner, not here)", async () => {
    const homeSeasonTeam = makeSeasonTeamRecord("st-home", "season-1", homeCustomTeamId);
    const awaySeasonTeam = makeSeasonTeamRecord("st-away", "season-1", awayCustomTeamId);
    const game = makeSeasonGameRecord("st-home", "st-away");

    const setup = await buildSeasonGameSetup(db, game, homeSeasonTeam, awaySeasonTeam, null);

    expect(setup.seed).toBe("test-seed-42");
    // buildSeasonGameSetup must NOT call reinitSeed — GameInner owns PRNG seeding.
    expect(reinitSeed).not.toHaveBeenCalled();
  });

  it("sets disableSave: true so league games do not create general-purpose save slots", async () => {
    const homeSeasonTeam = makeSeasonTeamRecord("st-home", "season-1", homeCustomTeamId);
    const awaySeasonTeam = makeSeasonTeamRecord("st-away", "season-1", awayCustomTeamId);
    const game = makeSeasonGameRecord("st-home", "st-away");

    const setup = await buildSeasonGameSetup(db, game, homeSeasonTeam, awaySeasonTeam, null);

    expect(setup.disableSave).toBe(true);
  });

  it("includes playerOverrides with lineup orders matching roster", async () => {
    const homeSeasonTeam = makeSeasonTeamRecord("st-home", "season-1", homeCustomTeamId);
    const awaySeasonTeam = makeSeasonTeamRecord("st-away", "season-1", awayCustomTeamId);
    const game = makeSeasonGameRecord("st-home", "st-away");

    const setup = await buildSeasonGameSetup(db, game, homeSeasonTeam, awaySeasonTeam, null);

    expect(setup.playerOverrides.homeOrder).toHaveLength(9);
    expect(setup.playerOverrides.awayOrder).toHaveLength(9);
    expect(setup.playerOverrides.homePitchers).toHaveLength(1);
    expect(setup.playerOverrides.awayPitchers).toHaveLength(1);
  });

  it("falls back to rosterSnapshot if home team doc is missing from the DB", async () => {
    const badHomeSeasonTeam = makeSeasonTeamRecord("st-home", "season-1", "nonexistent-team-id");
    const awaySeasonTeam = makeSeasonTeamRecord("st-away", "season-1", awayCustomTeamId);
    const game = makeSeasonGameRecord("st-home", "st-away");

    // Should not throw — falls back to rosterSnapshot.
    const setup = await buildSeasonGameSetup(db, game, badHomeSeasonTeam, awaySeasonTeam, null);
    expect(setup).toBeDefined();
    // rosterSnapshot contains name: "TestTeam" in makeSeasonTeamRecord
    expect(setup.homeTeamLabel).toBe("TestTeam");
  });

  it("falls back to rosterSnapshot if away team doc is missing from the DB", async () => {
    const homeSeasonTeam = makeSeasonTeamRecord("st-home", "season-1", homeCustomTeamId);
    const badAwaySeasonTeam = makeSeasonTeamRecord("st-away", "season-1", "nonexistent-team-id");
    const game = makeSeasonGameRecord("st-home", "st-away");

    // Should not throw — falls back to rosterSnapshot.
    const setup = await buildSeasonGameSetup(db, game, homeSeasonTeam, badAwaySeasonTeam, null);
    expect(setup).toBeDefined();
    // rosterSnapshot contains name: "TestTeam" in makeSeasonTeamRecord
    expect(setup.awayTeamLabel).toBe("TestTeam");
  });
});
