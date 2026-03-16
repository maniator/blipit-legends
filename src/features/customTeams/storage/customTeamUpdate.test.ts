import { getRxStorageMemory } from "rxdb/plugins/storage-memory";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { _createTestDb, type BallgameDb } from "@storage/db";
import type { CreateCustomTeamInput, UpdateCustomTeamInput } from "@storage/types";
import { makePlayer } from "@test/helpers/customTeams";

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
  db = await _createTestDb(getRxStorageMemory());
  store = makeCustomTeamStore(() => Promise.resolve(db));
});

afterEach(async () => {
  await db.close();
});

describe("updateCustomTeam", () => {
  it("updates name", async () => {
    const id = await store.createCustomTeam(makeInput({ name: "Old Name" }));
    await store.updateCustomTeam(id, { name: "New Name" });
    const team = await store.getCustomTeam(id);
    expect(team?.name).toBe("New Name");
  });

  it("trims updated name", async () => {
    const id = await store.createCustomTeam(makeInput());
    await store.updateCustomTeam(id, { name: "  Tigers  " });
    const team = await store.getCustomTeam(id);
    expect(team?.name).toBe("Tigers");
  });

  it("throws when team not found", async () => {
    await expect(store.updateCustomTeam("ghost", { name: "x" })).rejects.toThrow(
      "Custom team not found: ghost",
    );
  });

  it("throws on empty updated name", async () => {
    const id = await store.createCustomTeam(makeInput());
    await expect(store.updateCustomTeam(id, { name: "" })).rejects.toThrow(
      "name must be a non-empty string",
    );
  });

  it("throws when renaming to a name already used by another team (case-insensitive)", async () => {
    await store.createCustomTeam(makeInput({ name: "Alpha" }));
    const id2 = await store.createCustomTeam(makeInput({ name: "Beta" }));
    await expect(store.updateCustomTeam(id2, { name: "alpha" })).rejects.toThrow(
      'A team named "Alpha" already exists',
    );
  });

  it("allows renaming a team to its own current name (no false duplicate error)", async () => {
    const id = await store.createCustomTeam(makeInput({ name: "Gamma" }));
    await expect(store.updateCustomTeam(id, { name: "Gamma" })).resolves.toBeUndefined();
  });

  it("updates optional fields", async () => {
    const id = await store.createCustomTeam(makeInput());
    await store.updateCustomTeam(id, {
      city: "Dallas",
      nickname: "Stars",
      slug: "stars",
      statsProfile: "speed",
    });
    const team = await store.getCustomTeam(id);
    expect(team?.city).toBe("Dallas");
    expect(team?.nickname).toBe("Stars");
    expect(team?.slug).toBe("stars");
    expect(team?.statsProfile).toBe("speed");
  });

  it("updates roster lineup", async () => {
    const id = await store.createCustomTeam(makeInput());
    const newPlayer = makePlayer({ name: "New Star" });
    await store.updateCustomTeam(id, { roster: { lineup: [newPlayer] } });
    const team = await store.getCustomTeam(id);
    expect(team?.roster.lineup[0].name).toBe("New Star");
  });

  it("throws when updated lineup is empty", async () => {
    const id = await store.createCustomTeam(makeInput());
    await expect(store.updateCustomTeam(id, { roster: { lineup: [] } })).rejects.toThrow(
      "roster.lineup must have at least 1 player",
    );
  });

  it("merges metadata", async () => {
    const id = await store.createCustomTeam(
      makeInput({ metadata: { notes: "original", archived: false } }),
    );
    await store.updateCustomTeam(id, { metadata: { notes: "updated" } });
    const team = await store.getCustomTeam(id);
    expect(team?.metadata.notes).toBe("updated");
    expect(team?.metadata.archived).toBe(false);
  });

  it("can archive a team via metadata update", async () => {
    const id = await store.createCustomTeam(makeInput({ name: "To Archive" }));
    await store.updateCustomTeam(id, { metadata: { archived: true } });
    const allTeams = await store.listCustomTeams({ includeArchived: true });
    const archived = allTeams.find((t) => t.id === id);
    expect(archived?.metadata.archived).toBe(true);
    const active = await store.listCustomTeams();
    expect(active.find((t) => t.id === id)).toBeUndefined();
  });

  it("does not mutate caller input objects", async () => {
    const id = await store.createCustomTeam(makeInput());
    const updates: UpdateCustomTeamInput = { name: "  Clean  " };
    await store.updateCustomTeam(id, updates);
    // Caller's object should not be mutated
    expect(updates.name).toBe("  Clean  ");
  });

  it("uppercases and trims abbreviation on update", async () => {
    const id = await store.createCustomTeam(makeInput({ abbreviation: "NY" }));
    await store.updateCustomTeam(id, { abbreviation: " bos " });
    const team = await store.getCustomTeam(id);
    expect(team?.abbreviation).toBe("BOS");
  });

  it("throws when abbreviation is too short on update", async () => {
    const id = await store.createCustomTeam(makeInput());
    await expect(store.updateCustomTeam(id, { abbreviation: "A" })).rejects.toThrow(
      "abbreviation must be 2–3 characters",
    );
  });

  it("throws when abbreviation is too long on update", async () => {
    const id = await store.createCustomTeam(makeInput());
    await expect(store.updateCustomTeam(id, { abbreviation: "ABCD" })).rejects.toThrow(
      "abbreviation must be 2–3 characters",
    );
  });
});

describe("updateCustomTeam — fingerprint", () => {
  it("recomputes fingerprint when name changes", async () => {
    const id = await store.createCustomTeam(makeInput({ name: "Before" }));
    const before = await store.getCustomTeam(id);
    await store.updateCustomTeam(id, { name: "After" });
    const after = await store.getCustomTeam(id);
    expect(after?.fingerprint).not.toBe(before?.fingerprint);
  });

  it("does not change fingerprint when only metadata changes", async () => {
    const id = await store.createCustomTeam(makeInput({ name: "Meta Only" }));
    const before = await store.getCustomTeam(id);
    await store.updateCustomTeam(id, { metadata: { notes: "new note" } });
    const after = await store.getCustomTeam(id);
    expect(after?.fingerprint).toBe(before?.fingerprint);
  });
});

describe("updateCustomTeam — teamSeed preservation", () => {
  it("preserves the original teamSeed after name update", async () => {
    const id = await store.createCustomTeam(makeInput({ name: "Preserve Seed" }));
    const before = await store.getCustomTeam(id);
    const originalSeed = before?.teamSeed;
    expect(originalSeed).toBeTruthy();

    await store.updateCustomTeam(id, { name: "Preserve Seed Renamed" });
    const after = await store.getCustomTeam(id);
    expect(after?.teamSeed).toBe(originalSeed);
  });

  it("preserves the original teamSeed after metadata-only update", async () => {
    const id = await store.createCustomTeam(makeInput({ name: "Meta Seed Team" }));
    const before = await store.getCustomTeam(id);
    const originalSeed = before?.teamSeed;

    await store.updateCustomTeam(id, { metadata: { notes: "updated notes" } });
    const after = await store.getCustomTeam(id);
    expect(after?.teamSeed).toBe(originalSeed);
  });
});
