import { describe, expect, it } from "vitest";

import {
  editorReducer,
  editorStateToCreateInput,
  initEditorState,
  makePlayerId,
  validateEditorState,
} from "./editorState";

const makePlayer = (name = "Tom Adams", position = "C") => ({
  id: makePlayerId(),
  name,
  position,
  role: "batter" as const,
  handedness: "R" as const,
  contact: 45,
  power: 45,
  speed: 45,
});

const validState = () =>
  initEditorState(undefined) as ReturnType<typeof initEditorState> & {
    name: string;
    lineup: ReturnType<typeof makePlayer>[];
  };

describe("initEditorState", () => {
  it("starts with empty fields for create mode", () => {
    const state = initEditorState();
    expect(state.name).toBe("");
    expect(state.lineup).toHaveLength(0);
    expect(state.error).toBe("");
  });

  it("pre-fills from an existing team doc", () => {
    const team = {
      id: "t1",
      schemaVersion: 1,
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
      name: "Eagles",
      nameLowercase: "eagles",
      city: "Austin",
      roster: {
        schemaVersion: 1,
        lineup: [
          {
            id: "p1",
            name: "Jake Jones",
            role: "batter" as const,
            position: "C",
            handedness: "R" as const,
            batting: { contact: 70, power: 65, speed: 55, stamina: 50 },
          },
        ],
        bench: [],
        pitchers: [],
      },
      metadata: { archived: false },
    };
    const state = initEditorState(team);
    expect(state.name).toBe("Eagles");
    expect(state.city).toBe("Austin");
    expect(state.lineup[0].name).toBe("Jake Jones");
    expect(state.lineup[0].contact).toBe(70);
  });

  it("loads position and handedness from an existing team doc", () => {
    const team = {
      id: "ct_pos",
      schemaVersion: 1,
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
      name: "Rockets",
      nameLowercase: "rockets",
      roster: {
        schemaVersion: 1,
        lineup: [
          {
            id: "p1",
            name: "Sam Scott",
            role: "batter" as const,
            batting: { contact: 65, power: 60, speed: 70, stamina: 50 },
            position: "SS",
            handedness: "L" as const,
          },
        ],
        bench: [],
        pitchers: [],
      },
      metadata: { archived: false },
    };
    const state = initEditorState(team);
    expect(state.lineup[0].position).toBe("SS");
    expect(state.lineup[0].handedness).toBe("L");
  });

  it("defaults to empty position and R handedness for legacy docs missing those fields", () => {
    const team = {
      id: "ct_legacy",
      schemaVersion: 1,
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
      name: "Old Team",
      nameLowercase: "old team",
      roster: {
        schemaVersion: 1,
        lineup: [
          {
            id: "p1",
            name: "Ray Reed",
            role: "batter" as const,
            batting: { contact: 60, power: 60, speed: 60, stamina: 50 },
            // no position or handedness
          },
        ],
        bench: [],
        pitchers: [],
      },
      metadata: { archived: false },
    };
    const state = initEditorState(team as unknown as Parameters<typeof initEditorState>[0]);
    expect(state.lineup[0].position).toBe("");
    expect(state.lineup[0].handedness).toBe("R");
  });
});

describe("validateEditorState", () => {
  it("requires team name", () => {
    const state = initEditorState();
    expect(validateEditorState(state)).toContain("Team name");
  });

  it("requires abbreviation when name is set", () => {
    const state = { ...initEditorState(), name: "Eagles", abbreviation: "" };
    expect(validateEditorState(state)).toContain("abbreviation");
  });

  it("rejects abbreviation shorter than 2 chars", () => {
    const state = { ...initEditorState(), name: "Eagles", abbreviation: "E" };
    expect(validateEditorState(state)).toContain("2–3");
  });

  it("rejects abbreviation longer than 3 chars", () => {
    const state = { ...initEditorState(), name: "Eagles", abbreviation: "EAGL" };
    expect(validateEditorState(state)).toContain("2–3");
  });

  it("accepts 2-char abbreviation", () => {
    const state = {
      ...initEditorState(),
      name: "Eagles",
      abbreviation: "EA",
      lineup: [
        makePlayer("P1", "C"),
        makePlayer("P2", "1B"),
        makePlayer("P3", "2B"),
        makePlayer("P4", "3B"),
        makePlayer("P5", "SS"),
        makePlayer("P6", "LF"),
        makePlayer("P7", "CF"),
        makePlayer("P8", "RF"),
        makePlayer("P9", "DH"),
      ],
    };
    expect(validateEditorState(state)).toBe("");
  });

  it("requires at least 1 lineup player", () => {
    const state = { ...initEditorState(), name: "Eagles", abbreviation: "EAG" };
    expect(validateEditorState(state)).toContain("lineup");
  });

  it("requires player names", () => {
    const state = {
      ...initEditorState(),
      name: "Eagles",
      abbreviation: "EAG",
      lineup: [{ ...makePlayer(""), contact: 45, power: 45, speed: 45 }],
    };
    expect(validateEditorState(state)).toContain("name");
  });

  it("returns empty string for a valid state with all required positions", () => {
    const state = {
      ...initEditorState(),
      name: "Eagles",
      abbreviation: "EAG",
      lineup: [
        makePlayer("P1", "C"),
        makePlayer("P2", "1B"),
        makePlayer("P3", "2B"),
        makePlayer("P4", "3B"),
        makePlayer("P5", "SS"),
        makePlayer("P6", "LF"),
        makePlayer("P7", "CF"),
        makePlayer("P8", "RF"),
        makePlayer("P9", "DH"),
      ],
    };
    expect(validateEditorState(state)).toBe("");
  });

  it("blocks save when a required field position is missing from lineup and bench", () => {
    const state = {
      ...initEditorState(),
      name: "Eagles",
      abbreviation: "EAG",
      // Has all positions except SS
      lineup: [
        makePlayer("P1", "C"),
        makePlayer("P2", "1B"),
        makePlayer("P3", "2B"),
        makePlayer("P4", "3B"),
        makePlayer("P5", "LF"),
        makePlayer("P6", "CF"),
        makePlayer("P7", "RF"),
        makePlayer("P8", "DH"),
      ],
    };
    const err = validateEditorState(state);
    expect(err).toBeTruthy();
    expect(err).toContain("SS");
  });

  it("reports all missing positions when multiple are absent", () => {
    const state = {
      ...initEditorState(),
      name: "Eagles",
      abbreviation: "EAG",
      lineup: [makePlayer("P1", "C"), makePlayer("P2", "1B")],
    };
    const err = validateEditorState(state);
    expect(err).toContain("2B");
    expect(err).toContain("3B");
    expect(err).toContain("SS");
    expect(err).toContain("LF");
    expect(err).toContain("CF");
    expect(err).toContain("RF");
  });

  it("valid state with full lineup and extra bench players passes", () => {
    const state = {
      ...initEditorState(),
      name: "Eagles",
      abbreviation: "EAG",
      lineup: [
        makePlayer("P1", "C"),
        makePlayer("P2", "1B"),
        makePlayer("P3", "2B"),
        makePlayer("P4", "3B"),
        makePlayer("P5", "SS"),
        makePlayer("P6", "LF"),
        makePlayer("P7", "CF"),
        makePlayer("P8", "RF"),
        makePlayer("P9", "DH"),
      ],
      bench: [makePlayer("Bench", "RF")],
    };
    expect(validateEditorState(state)).toBe("");
  });

  it("rejects duplicate position in starting lineup", () => {
    const state = {
      ...initEditorState(),
      name: "Eagles",
      abbreviation: "EAG",
      // Two catchers, no DH
      lineup: [
        makePlayer("P1", "C"),
        makePlayer("P2", "C"),
        makePlayer("P3", "1B"),
        makePlayer("P4", "2B"),
        makePlayer("P5", "3B"),
        makePlayer("P6", "SS"),
        makePlayer("P7", "LF"),
        makePlayer("P8", "CF"),
        makePlayer("P9", "RF"),
      ],
    };
    const err = validateEditorState(state);
    expect(err).toBeTruthy();
    expect(err).toContain("C");
    expect(err).toContain("duplicate");
  });

  it("reports all duplicate positions when multiple are duplicated in lineup", () => {
    const state = {
      ...initEditorState(),
      name: "Eagles",
      abbreviation: "EAG",
      lineup: [
        makePlayer("P1", "C"),
        makePlayer("P2", "C"),
        makePlayer("P3", "SS"),
        makePlayer("P4", "SS"),
        makePlayer("P5", "1B"),
        makePlayer("P6", "2B"),
        makePlayer("P7", "3B"),
        makePlayer("P8", "LF"),
        makePlayer("P9", "CF"),
      ],
    };
    const err = validateEditorState(state);
    expect(err).toContain("C");
    expect(err).toContain("SS");
    expect(err).toContain("duplicate");
  });

  it("rejects starting lineup missing a required position", () => {
    const state = {
      ...initEditorState(),
      name: "Eagles",
      abbreviation: "EAG",
      // Full 9 players but CF replaced by a second RF (no CF)
      lineup: [
        makePlayer("P1", "C"),
        makePlayer("P2", "1B"),
        makePlayer("P3", "2B"),
        makePlayer("P4", "3B"),
        makePlayer("P5", "SS"),
        makePlayer("P6", "LF"),
        makePlayer("P7", "RF"),
        makePlayer("P8", "RF"),
        makePlayer("P9", "DH"),
      ],
    };
    const err = validateEditorState(state);
    expect(err).toBeTruthy();
    // RF is duplicated → duplicate error fires first
    expect(err).toContain("RF");
  });

  it("reports missing positions when lineup has no duplicates but is missing positions", () => {
    const state = {
      ...initEditorState(),
      name: "Eagles",
      abbreviation: "EAG",
      // 9 players but DH slot replaced by an extra C (duplicate) is handled above;
      // here we have 8 unique valid positions (no DH)
      lineup: [
        makePlayer("P1", "C"),
        makePlayer("P2", "1B"),
        makePlayer("P3", "2B"),
        makePlayer("P4", "3B"),
        makePlayer("P5", "SS"),
        makePlayer("P6", "LF"),
        makePlayer("P7", "CF"),
        makePlayer("P8", "RF"),
      ],
    };
    const err = validateEditorState(state);
    expect(err).toBeTruthy();
    expect(err).toContain("DH");
    expect(err).toContain("missing");
  });

  it("hitter within cap passes validation", () => {
    const state = {
      ...initEditorState(),
      name: "Eagles",
      abbreviation: "EAG",
      lineup: [
        makePlayer("P1", "C"),
        makePlayer("P2", "1B"),
        makePlayer("P3", "2B"),
        makePlayer("P4", "3B"),
        makePlayer("P5", "SS"),
        makePlayer("P6", "LF"),
        makePlayer("P7", "CF"),
        makePlayer("P8", "RF"),
        makePlayer("P9", "DH"),
      ],
    };
    expect(validateEditorState(state)).toBe("");
  });

  it("hitter over hitter cap is rejected with clear message", () => {
    const overCapPlayer = { ...makePlayer("Big Hitter", "C"), contact: 60, power: 60, speed: 60 };
    const state = {
      ...initEditorState(),
      name: "Eagles",
      abbreviation: "EAG",
      lineup: [
        overCapPlayer,
        makePlayer("P2", "1B"),
        makePlayer("P3", "2B"),
        makePlayer("P4", "3B"),
        makePlayer("P5", "SS"),
        makePlayer("P6", "LF"),
        makePlayer("P7", "CF"),
        makePlayer("P8", "RF"),
        makePlayer("P9", "DH"),
      ],
    };
    const err = validateEditorState(state);
    expect(err).toContain("Big Hitter");
    expect(err).toContain("180");
    expect(err).toContain("150");
  });

  it("pitcher within pitcher cap passes validation", () => {
    const pitcher = {
      ...makePlayer("Good Pitcher"),
      role: "pitcher" as const,
      velocity: 50,
      control: 55,
      movement: 50,
    };
    const state = {
      ...initEditorState(),
      name: "Eagles",
      abbreviation: "EAG",
      lineup: [
        makePlayer("P1", "C"),
        makePlayer("P2", "1B"),
        makePlayer("P3", "2B"),
        makePlayer("P4", "3B"),
        makePlayer("P5", "SS"),
        makePlayer("P6", "LF"),
        makePlayer("P7", "CF"),
        makePlayer("P8", "RF"),
        makePlayer("P9", "DH"),
      ],
      pitchers: [pitcher],
    };
    expect(validateEditorState(state)).toBe("");
  });

  it("pitcher over pitcher cap is rejected with clear message", () => {
    const overCapPitcher = {
      ...makePlayer("Fire Pitcher"),
      role: "pitcher" as const,
      velocity: 70,
      control: 70,
      movement: 70,
    };
    const state = {
      ...initEditorState(),
      name: "Eagles",
      abbreviation: "EAG",
      lineup: [
        makePlayer("P1", "C"),
        makePlayer("P2", "1B"),
        makePlayer("P3", "2B"),
        makePlayer("P4", "3B"),
        makePlayer("P5", "SS"),
        makePlayer("P6", "LF"),
        makePlayer("P7", "CF"),
        makePlayer("P8", "RF"),
        makePlayer("P9", "DH"),
      ],
      pitchers: [overCapPitcher],
    };
    const err = validateEditorState(state);
    expect(err).toContain("Fire Pitcher");
    expect(err).toContain("210");
    expect(err).toContain("160");
  });
});

describe("editorReducer", () => {
  it("SET_FIELD updates name and clears error", () => {
    const state = { ...initEditorState(), error: "old error" };
    const next = editorReducer(state, { type: "SET_FIELD", field: "name", value: "Eagles" });
    expect(next.name).toBe("Eagles");
    expect(next.error).toBe("");
  });

  it("ADD_PLAYER appends to lineup", () => {
    const state = initEditorState();
    const player = makePlayer("Jake");
    const next = editorReducer(state, { type: "ADD_PLAYER", section: "lineup", player });
    expect(next.lineup).toHaveLength(1);
    expect(next.lineup[0].name).toBe("Jake");
  });

  it("REMOVE_PLAYER removes by index", () => {
    const p1 = makePlayer("A");
    const p2 = makePlayer("B");
    const state = { ...initEditorState(), lineup: [p1, p2] };
    const next = editorReducer(state, { type: "REMOVE_PLAYER", section: "lineup", index: 0 });
    expect(next.lineup).toHaveLength(1);
    expect(next.lineup[0].name).toBe("B");
  });

  it("MOVE_UP swaps player with predecessor", () => {
    const p1 = makePlayer("A");
    const p2 = makePlayer("B");
    const state = { ...initEditorState(), lineup: [p1, p2] };
    const next = editorReducer(state, { type: "MOVE_UP", section: "lineup", index: 1 });
    expect(next.lineup[0].name).toBe("B");
    expect(next.lineup[1].name).toBe("A");
  });

  it("MOVE_DOWN swaps player with successor", () => {
    const p1 = makePlayer("A");
    const p2 = makePlayer("B");
    const state = { ...initEditorState(), lineup: [p1, p2] };
    const next = editorReducer(state, { type: "MOVE_DOWN", section: "lineup", index: 0 });
    expect(next.lineup[0].name).toBe("B");
    expect(next.lineup[1].name).toBe("A");
  });

  it("MOVE_UP at index 0 is a no-op", () => {
    const p1 = makePlayer("A");
    const state = { ...initEditorState(), lineup: [p1] };
    const next = editorReducer(state, { type: "MOVE_UP", section: "lineup", index: 0 });
    expect(next.lineup[0].name).toBe("A");
  });

  it("REORDER reorders lineup by ordered IDs", () => {
    const p1 = makePlayer("A");
    const p2 = makePlayer("B");
    const p3 = makePlayer("C");
    const state = { ...initEditorState(), lineup: [p1, p2, p3] };
    const next = editorReducer(state, {
      type: "REORDER",
      section: "lineup",
      orderedIds: [p3.id, p1.id, p2.id],
    });
    expect(next.lineup.map((p) => p.name)).toEqual(["C", "A", "B"]);
  });
});

describe("editorStateToCreateInput", () => {
  it("maps editor state to CreateCustomTeamInput", () => {
    const player = makePlayer("Tom Adams");
    const state = {
      ...initEditorState(),
      name: "  Eagles  ",
      city: "Austin",
      nickname: "Birds",
      lineup: [player],
      bench: [],
      pitchers: [],
    };
    const input = editorStateToCreateInput(state);
    expect(input.name).toBe("Eagles");
    expect(input.city).toBe("Austin");
    expect(input.roster.lineup[0].name).toBe("Tom Adams");
    expect(input.roster.lineup[0].role).toBe("batter");
  });

  it("uppercases abbreviation in output", () => {
    const player = makePlayer("Tom Adams");
    const state = {
      ...initEditorState(),
      name: "Eagles",
      abbreviation: "eag",
      lineup: [player],
    };
    const input = editorStateToCreateInput(state);
    expect(input.abbreviation).toBe("EAG");
  });

  it("maps pitcher with pitching stats to CreateCustomTeamInput", () => {
    const pitcher = {
      ...makePlayer("Ace Pitcher"),
      role: "pitcher" as const,
      velocity: 88,
      control: 70,
      movement: 65,
    };
    const state = {
      ...initEditorState(),
      name: "Eagles",
      abbreviation: "EAG",
      lineup: [makePlayer()],
      pitchers: [pitcher],
    };
    const input = editorStateToCreateInput(state);
    const p = input.roster.pitchers![0];
    expect(p.role).toBe("pitcher");
    expect(p.pitching?.velocity).toBe(88);
    expect(p.pitching?.control).toBe(70);
    expect(p.pitching?.movement).toBe(65);
  });

  it("throws when pitcher is missing pitching stats", () => {
    // Cast to simulate a pitcher slot populated with an object missing pitching stats at runtime.
    const benchPitcher = {
      ...makePlayer("No-stats Pitcher"),
      role: "pitcher",
    } as unknown as import("./editorState").EditorPitcherPlayer;
    const state = {
      ...initEditorState(),
      name: "Eagles",
      abbreviation: "EAG",
      lineup: [makePlayer()],
      pitchers: [benchPitcher],
    };
    expect(() => editorStateToCreateInput(state)).toThrow("Pitcher is missing pitching stats.");
  });
});

describe("editorReducer — additional cases", () => {
  it("UPDATE_PLAYER patches a player by index", () => {
    const p1 = makePlayer("Alice");
    const p2 = makePlayer("Bob");
    const state = { ...initEditorState(), lineup: [p1, p2] };
    const next = editorReducer(state, {
      type: "UPDATE_PLAYER",
      section: "lineup",
      index: 1,
      player: { name: "Robert", contact: 80 },
    });
    expect(next.lineup[1].name).toBe("Robert");
    expect(next.lineup[1].contact).toBe(80);
    expect(next.lineup[0].name).toBe("Alice");
    expect(next.error).toBe("");
  });

  it("MOVE_DOWN at last index is a no-op", () => {
    const p1 = makePlayer("A");
    const state = { ...initEditorState(), lineup: [p1] };
    const next = editorReducer(state, { type: "MOVE_DOWN", section: "lineup", index: 0 });
    expect(next.lineup[0].name).toBe("A");
  });

  it("REORDER silently skips unknown IDs", () => {
    const p1 = makePlayer("A");
    const p2 = makePlayer("B");
    const state = { ...initEditorState(), lineup: [p1, p2] };
    const next = editorReducer(state, {
      type: "REORDER",
      section: "lineup",
      orderedIds: [p2.id, "unknown-id", p1.id],
    });
    expect(next.lineup.map((p) => p.name)).toEqual(["B", "A"]);
  });

  it("SET_ERROR sets error field", () => {
    const state = initEditorState();
    const next = editorReducer(state, { type: "SET_ERROR", error: "Something went wrong" });
    expect(next.error).toBe("Something went wrong");
  });

  it("APPLY_DRAFT populates all roster sections from draft", () => {
    const draft = {
      name: "Rockets",
      abbreviation: "ROC",
      city: "Houston",
      nickname: "Rockets",
      roster: {
        lineup: [
          {
            id: "d1",
            name: "Batter One",
            role: "batter" as const,
            position: "C",
            handedness: "R" as const,
            batting: { contact: 70, power: 65, speed: 60, stamina: 50 },
          },
        ],
        bench: [
          {
            id: "d2",
            name: "Bench Guy",
            role: "batter" as const,
            position: "C",
            handedness: "R" as const,
            batting: { contact: 55, power: 50, speed: 55, stamina: 50 },
          },
        ],
        pitchers: [
          {
            id: "d3",
            name: "Ace Pitcher",
            role: "pitcher" as const,
            position: "P",
            handedness: "R" as const,
            batting: { contact: 30, power: 25, speed: 30, stamina: 50 },
            pitching: { velocity: 90, control: 72, movement: 68, stamina: 60 },
          },
        ],
      },
    };
    const state = initEditorState();
    const next = editorReducer(state, { type: "APPLY_DRAFT", draft });
    expect(next.name).toBe("Rockets");
    expect(next.abbreviation).toBe("ROC");
    expect(next.city).toBe("Houston");
    expect(next.lineup).toHaveLength(1);
    expect(next.lineup[0].name).toBe("Batter One");
    expect(next.bench).toHaveLength(1);
    expect(next.pitchers).toHaveLength(1);
    expect(next.pitchers[0].velocity).toBe(90);
    expect(next.error).toBe("");
  });

  it("default case returns state unchanged for unknown action type", () => {
    const state = initEditorState();
    // Cast to bypass TS exhaustiveness check
    const next = editorReducer(state, { type: "UNKNOWN_ACTION" } as unknown as Parameters<
      typeof editorReducer
    >[1]);
    expect(next).toBe(state);
  });
});

describe("TRANSFER_PLAYER action", () => {
  it("moves a player from lineup to bench at the given index", () => {
    const p1 = makePlayer("Alice");
    const p2 = makePlayer("Bob");
    const p3 = makePlayer("Charlie");
    const state = { ...initEditorState(), lineup: [p1, p2], bench: [p3] };
    const next = editorReducer(state, {
      type: "TRANSFER_PLAYER",
      fromSection: "lineup",
      toSection: "bench",
      playerId: p1.id,
      toIndex: 0,
    });
    expect(next.lineup.map((p) => p.name)).toEqual(["Bob"]);
    expect(next.bench.map((p) => p.name)).toEqual(["Alice", "Charlie"]);
  });

  it("moves a player from bench to lineup at index 0", () => {
    const p1 = makePlayer("Alice");
    const p2 = makePlayer("Bob");
    const state = { ...initEditorState(), lineup: [p1], bench: [p2] };
    const next = editorReducer(state, {
      type: "TRANSFER_PLAYER",
      fromSection: "bench",
      toSection: "lineup",
      playerId: p2.id,
      toIndex: 0,
    });
    expect(next.bench).toHaveLength(0);
    expect(next.lineup.map((p) => p.name)).toEqual(["Bob", "Alice"]);
  });
});

describe("validateEditorState — player name uniqueness", () => {
  const validLineup = [
    makePlayer("P1", "C"),
    makePlayer("P2", "1B"),
    makePlayer("P3", "2B"),
    makePlayer("P4", "3B"),
    makePlayer("P5", "SS"),
    makePlayer("P6", "LF"),
    makePlayer("P7", "CF"),
    makePlayer("P8", "RF"),
    makePlayer("P9", "DH"),
  ];

  it("rejects duplicate player names within the lineup", () => {
    const state = {
      ...initEditorState(),
      name: "Eagles",
      abbreviation: "EAG",
      lineup: [
        ...validLineup.slice(0, 8),
        { ...makePlayer("P1", "DH") }, // duplicate of first player
      ],
    };
    const err = validateEditorState(state);
    expect(err).toContain("Duplicate player name");
    expect(err).toContain('"P1"');
  });

  it("rejects a player name that matches a bench player (cross-slot)", () => {
    const state = {
      ...initEditorState(),
      name: "Eagles",
      abbreviation: "EAG",
      lineup: validLineup,
      bench: [{ ...makePlayer("P1", "1B") }], // "P1" is already in lineup
    };
    const err = validateEditorState(state);
    expect(err).toContain("Duplicate player name");
  });

  it("is case-insensitive for player name uniqueness", () => {
    const state = {
      ...initEditorState(),
      name: "Eagles",
      abbreviation: "EAG",
      lineup: [
        ...validLineup.slice(0, 8),
        { ...makePlayer("p1", "DH") }, // lowercase duplicate
      ],
    };
    const err = validateEditorState(state);
    expect(err).toContain("Duplicate player name");
  });

  it("accepts a fully unique roster across all slots", () => {
    const state = {
      ...initEditorState(),
      name: "Eagles",
      abbreviation: "EAG",
      lineup: validLineup,
      bench: [makePlayer("Bench Player", "1B")],
    };
    expect(validateEditorState(state)).toBe("");
  });
});
