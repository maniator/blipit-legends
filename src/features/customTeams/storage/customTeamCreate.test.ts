import { getRxStorageMemory } from "rxdb/plugins/storage-memory";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { BallgameDb } from "@storage/db";
import type { CreateCustomTeamInput } from "@storage/types";
import { makePlayer } from "@test/helpers/customTeams";
import { createTestDb } from "@test/helpers/db";

import { makeCustomTeamStore } from "./customTeamStore";

const makeInput = (overrides: Partial<CreateCustomTeamInput> = {}): CreateCustomTeamInput => ({
  name: "Test Team",
  roster: {
    lineup: [makePlayer()],
    bench: [],
    pitchers: [],
  },
  ...overrides,
});

let db: BallgameDb;
let store: ReturnType<typeof makeCustomTeamStore>;

beforeEach(async () => {
  db = await createTestDb(getRxStorageMemory());
  store = makeCustomTeamStore(() => Promise.resolve(db));
});

afterEach(async () => {
  await db.close();
});

describe("createCustomTeam", () => {
  it("returns a string id", async () => {
    const id = await store.createCustomTeam(makeInput());
    expect(typeof id).toBe("string");
    expect(id).toBeTruthy();
  });

  it("persists a document with expected fields", async () => {
    const id = await store.createCustomTeam(
      makeInput({ name: "Rockets", city: "Houston", nickname: "Rox", slug: "rockets" }),
    );
    const doc = await db.teams.findOne(id).exec();
    expect(doc?.name).toBe("Rockets");
    expect(doc?.city).toBe("Houston");
    expect(doc?.nickname).toBe("Rox");
    expect(doc?.slug).toBe("rockets");
    expect(doc?.nameLowercase).toBe("rockets");
    expect(doc?.schemaVersion).toBe(1);
    expect(typeof doc?.createdAt).toBe("string");
    expect(typeof doc?.updatedAt).toBe("string");
  });

  it("uses provided id when given via meta", async () => {
    const id = await store.createCustomTeam(makeInput(), { id: "my-custom-id" });
    expect(id).toBe("my-custom-id");
    const doc = await db.teams.findOne("my-custom-id").exec();
    expect(doc).not.toBeNull();
  });

  it("stores nameLowercase for indexed dedup", async () => {
    const id = await store.createCustomTeam(makeInput({ name: "Test Team" }));
    const doc = await db.teams.findOne(id).exec();
    expect(doc?.nameLowercase).toBe("test team");
  });

  it("stores nameLowercase in lowercase", async () => {
    const id = await store.createCustomTeam(makeInput({ name: "UPPERCASE NAME" }));
    const doc = await db.teams.findOne(id).exec();
    expect(doc?.nameLowercase).toBe("uppercase name");
  });

  it("trims team name whitespace", async () => {
    const id = await store.createCustomTeam(makeInput({ name: "  Padres  " }));
    const doc = await db.teams.findOne(id).exec();
    expect(doc?.name).toBe("Padres");
  });

  it("throws on empty team name", async () => {
    await expect(store.createCustomTeam(makeInput({ name: "" }))).rejects.toThrow(
      "name must be a non-empty string",
    );
  });

  it("throws on whitespace-only team name", async () => {
    await expect(store.createCustomTeam(makeInput({ name: "   " }))).rejects.toThrow(
      "name must be a non-empty string",
    );
  });

  it("throws when lineup is empty", async () => {
    await expect(store.createCustomTeam(makeInput({ roster: { lineup: [] } }))).rejects.toThrow(
      "roster.lineup must have at least 1 player",
    );
  });

  it("clamps batting stats to 0–100", async () => {
    const player = makePlayer({
      batting: { contact: 150, power: -10, speed: 50, stamina: 50 },
    });
    const id = await store.createCustomTeam(makeInput({ roster: { lineup: [player] } }));
    const team = await store.getCustomTeam(id);
    const lineupPlayer = team?.roster.lineup[0];
    if (!lineupPlayer || lineupPlayer.role !== "batter") {
      throw new Error("Expected first lineup player to be a batter in test setup");
    }
    expect(lineupPlayer.batting.contact).toBe(100);
    expect(lineupPlayer.batting.power).toBe(0);
    expect(lineupPlayer.batting.speed).toBe(50);
  });

  it("clamps pitching stats to 0–100", async () => {
    const player = makePlayer({
      role: "pitcher",
      pitching: { velocity: 200, control: -5, movement: 55, stamina: 90 },
    });
    const id = await store.createCustomTeam(makeInput({ roster: { lineup: [player] } }));
    const team = await store.getCustomTeam(id);
    expect(team?.roster.lineup[0].pitching?.velocity).toBe(100);
    expect(team?.roster.lineup[0].pitching?.control).toBe(0);
    expect(team?.roster.lineup[0].pitching?.movement).toBe(55);
  });

  it("throws when player name is empty", async () => {
    const player = makePlayer({ name: "" });
    await expect(
      store.createCustomTeam(makeInput({ roster: { lineup: [player] } })),
    ).rejects.toThrow("roster lineup[0].name must be a non-empty string");
  });

  it("throws on invalid player role", async () => {
    const player = makePlayer({ role: "invalid" as "batter" });
    await expect(
      store.createCustomTeam(makeInput({ roster: { lineup: [player] } })),
    ).rejects.toThrow('roster lineup[0].role must be "batter" or "pitcher"');
  });

  it("stores bench and pitchers arrays", async () => {
    const bench = makePlayer({ name: "Bench Guy" });
    const pitcher = makePlayer({
      name: "Pitcher Joe",
      role: "pitcher",
      pitching: { velocity: 60, control: 55, movement: 40, stamina: 65 },
    });
    const id = await store.createCustomTeam(
      makeInput({ roster: { lineup: [makePlayer()], bench: [bench], pitchers: [pitcher] } }),
    );
    const team = await store.getCustomTeam(id);
    expect(team?.roster.bench ?? []).toHaveLength(1);
    expect(team?.roster.bench?.[0]?.name).toBe("Bench Guy");
    expect(team?.roster.pitchers).toHaveLength(1);
    expect(team?.roster.pitchers[0].name).toBe("Pitcher Joe");
  });

  it("players are stored in the players collection (no embedded roster)", async () => {
    const id = await store.createCustomTeam(
      makeInput({ roster: { lineup: [makePlayer()], bench: [], pitchers: [] } }),
    );
    const doc = await db.teams.findOne(id).exec();
    // In v1, TeamRecord has no embedded roster field.
    expect((doc?.toJSON() as Record<string, unknown>)["roster"]).toBeUndefined();
    // Player is in the players collection.
    const players = await db.players.find({ selector: { teamId: id } }).exec();
    expect(players).toHaveLength(1);
  });

  it("stores metadata fields", async () => {
    const id = await store.createCustomTeam(
      makeInput({ metadata: { notes: "note", tags: ["fast"], archived: false } }),
    );
    const doc = await db.teams.findOne(id).exec();
    const stored = doc?.toJSON() as unknown as { metadata: { notes: string; tags: string[] } };
    expect(stored.metadata.notes).toBe("note");
    expect(stored.metadata.tags).toEqual(["fast"]);
  });

  it("stores statsProfile when provided", async () => {
    const id = await store.createCustomTeam(makeInput({ statsProfile: "power" }));
    const doc = await db.teams.findOne(id).exec();
    expect(doc?.statsProfile).toBe("power");
  });

  it("uppercases and trims abbreviation on create", async () => {
    const id = await store.createCustomTeam(makeInput({ abbreviation: " sox " }));
    const team = await store.getCustomTeam(id);
    expect(team?.abbreviation).toBe("SOX");
  });

  it("throws when abbreviation is too short on create", async () => {
    await expect(store.createCustomTeam(makeInput({ abbreviation: "X" }))).rejects.toThrow(
      "abbreviation must be 2–3 characters",
    );
  });

  it("throws when abbreviation is too long on create", async () => {
    await expect(store.createCustomTeam(makeInput({ abbreviation: "WXYZ" }))).rejects.toThrow(
      "abbreviation must be 2–3 characters",
    );
  });
});

describe("createCustomTeam — fingerprint", () => {
  it("sets a fingerprint on create", async () => {
    const id = await store.createCustomTeam(makeInput({ name: "FP Team" }));
    const team = await store.getCustomTeam(id);
    expect(team?.fingerprint).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe("createCustomTeam — name uniqueness", () => {
  it("throws when creating a team with the same name as an existing team", async () => {
    await store.createCustomTeam(makeInput({ name: "Duplicate Team" }));
    await expect(store.createCustomTeam(makeInput({ name: "Duplicate Team" }))).rejects.toThrow(
      "already exists",
    );
  });

  it("is case-insensitive for duplicate name check", async () => {
    await store.createCustomTeam(makeInput({ name: "Eagles" }));
    await expect(store.createCustomTeam(makeInput({ name: "eagles" }))).rejects.toThrow(
      "already exists",
    );
    await expect(store.createCustomTeam(makeInput({ name: "EAGLES" }))).rejects.toThrow(
      "already exists",
    );
  });

  it("allows two teams with different names", async () => {
    const id1 = await store.createCustomTeam(makeInput({ name: "Hawks" }));
    const id2 = await store.createCustomTeam(makeInput({ name: "Falcons" }));
    expect(id1).not.toBe(id2);
  });
});

describe("createCustomTeam — no teamSeed stored", () => {
  it("does not store a teamSeed field on the created team", async () => {
    const id = await store.createCustomTeam(makeInput({ name: "No-Seed Team" }));
    const team = await store.getCustomTeam(id);
    expect("teamSeed" in (team ?? {})).toBe(false);
  });
});

describe("createCustomTeam — no playerSeed stored", () => {
  it("does not store playerSeed on players when team is created", async () => {
    const id = await store.createCustomTeam(
      makeInput({
        name: "No Player Seed Team",
        roster: {
          lineup: [makePlayer({ id: "p_s1", name: "Batter No Seed" })],
          bench: [],
          pitchers: [
            makePlayer({
              id: "p_s2",
              name: "Pitcher No Seed",
              role: "pitcher",
              pitching: { velocity: 55, control: 55, movement: 50, stamina: 60 },
            }),
          ],
        },
      }),
    );
    const team = await store.getCustomTeam(id);
    const batter = team?.roster.lineup[0];
    const pitcher = team?.roster.pitchers[0];
    expect("playerSeed" in (batter ?? {})).toBe(false);
    expect("playerSeed" in (pitcher ?? {})).toBe(false);
  });
});

describe("createCustomTeam — stat cap enforcement", () => {
  it("throws when a batter's batting total exceeds HITTER_STAT_CAP (150)", async () => {
    await expect(
      store.createCustomTeam(
        makeInput({
          roster: {
            lineup: [makePlayer({ batting: { contact: 60, power: 55, speed: 50, stamina: 50 } })], // 165 > 150
            bench: [],
            pitchers: [],
          },
        }),
      ),
    ).rejects.toThrow(/stat cap/i);
  });

  it("throws when a pitcher's pitching total exceeds PITCHER_STAT_CAP (160)", async () => {
    await expect(
      store.createCustomTeam(
        makeInput({
          roster: {
            lineup: [
              makePlayer({
                role: "pitcher",
                pitching: { velocity: 70, control: 60, movement: 55, stamina: 60 }, // 185 > 160
              }),
            ],
            bench: [],
            pitchers: [],
          },
        }),
      ),
    ).rejects.toThrow(/stat cap/i);
  });

  it("accepts a player with stats exactly at the cap (150 / 160)", async () => {
    await expect(
      store.createCustomTeam(
        makeInput({
          roster: {
            lineup: [makePlayer({ batting: { contact: 50, power: 50, speed: 50, stamina: 50 } })], // 150 = cap
            bench: [],
            pitchers: [],
          },
        }),
      ),
    ).resolves.toEqual(expect.any(String));
  });
});
