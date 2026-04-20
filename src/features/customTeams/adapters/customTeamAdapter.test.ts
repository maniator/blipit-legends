import { describe, expect, it } from "vitest";

import type { TeamWithRoster } from "@storage/types";

import {
  customTeamToAbbreviation,
  customTeamToBenchRoster,
  customTeamToDisplayName,
  customTeamToGameId,
  customTeamToHandednessMap,
  customTeamToLineupOrder,
  customTeamToPitcherRoster,
  customTeamToPlayerOverrides,
  resolveCustomIdsInString,
  resolveTeamLabel,
  validateCustomTeamForGame,
} from "./customTeamAdapter";

const makeTeam = (overrides: Partial<TeamWithRoster> = {}): TeamWithRoster => ({
  id: "ct_test_001",
  schemaVersion: 1,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
  name: "Eagles",
  nameLowercase: "eagles",
  city: "Austin",
  roster: {
    schemaVersion: 1,
    lineup: [
      {
        id: "p1",
        name: "Tom Adams",
        role: "batter",
        position: "C",
        handedness: "L",
        batting: { contact: 70, power: 65, speed: 60, stamina: 50 },
      },
      {
        id: "p2",
        name: "Jake Baker",
        role: "batter",
        position: "C",
        handedness: "R" as const,
        batting: { contact: 55, power: 80, speed: 50, stamina: 50 },
      },
    ],
    bench: [
      {
        id: "p3",
        name: "Sam Cole",
        role: "batter",
        position: "C",
        handedness: "R" as const,
        batting: { contact: 50, power: 50, speed: 50, stamina: 50 },
      },
    ],
    pitchers: [
      {
        id: "p4",
        name: "Ray Davis",
        role: "pitcher",
        position: "P",
        handedness: "R",
        pitching: { velocity: 75, control: 65, movement: 70, stamina: 60 },
      },
    ],
  },
  metadata: { archived: false },
  ...overrides,
});

describe("customTeamToGameId", () => {
  it("returns the team id directly (no prefix in v1)", () => {
    expect(customTeamToGameId(makeTeam())).toBe("ct_test_001");
  });

  it("is stable across calls", () => {
    const t = makeTeam();
    expect(customTeamToGameId(t)).toBe(customTeamToGameId(t));
  });
});

describe("customTeamToDisplayName", () => {
  it("returns city + name when city is set", () => {
    expect(customTeamToDisplayName(makeTeam())).toBe("Austin Eagles");
  });

  it("returns just name when city is absent", () => {
    expect(customTeamToDisplayName(makeTeam({ city: undefined }))).toBe("Eagles");
  });
});

describe("customTeamToLineupOrder", () => {
  it("returns the lineup player IDs in order", () => {
    expect(customTeamToLineupOrder(makeTeam())).toEqual(["p1", "p2"]);
  });
});

describe("customTeamToBenchRoster", () => {
  it("returns bench player IDs in order", () => {
    expect(customTeamToBenchRoster(makeTeam())).toEqual(["p3"]);
  });

  it("returns empty array when bench is empty", () => {
    const team = makeTeam({
      roster: { ...makeTeam().roster, bench: [] },
    });
    expect(customTeamToBenchRoster(team)).toEqual([]);
  });
});

describe("customTeamToPitcherRoster", () => {
  it("returns pitcher IDs in order", () => {
    expect(customTeamToPitcherRoster(makeTeam())).toEqual(["p4"]);
  });

  it("returns empty array when pitchers is empty", () => {
    const team = makeTeam({
      roster: { ...makeTeam().roster, pitchers: [] },
    });
    expect(customTeamToPitcherRoster(team)).toEqual([]);
  });
});

describe("customTeamToPlayerOverrides", () => {
  it("includes all players (lineup + bench + pitchers)", () => {
    const overrides = customTeamToPlayerOverrides(makeTeam());
    expect(Object.keys(overrides).sort()).toEqual(["p1", "p2", "p3", "p4"]);
  });

  it("sets nickname to player name", () => {
    const overrides = customTeamToPlayerOverrides(makeTeam());
    expect(overrides["p1"].nickname).toBe("Tom Adams");
  });

  it("includes handedness in overrides when available", () => {
    const overrides = customTeamToPlayerOverrides(makeTeam());
    expect(overrides["p1"].handedness).toBe("L");
    expect(overrides["p4"].handedness).toBe("R");
  });

  it("converts stats 70 contact to +10 modifier (closest to 70-60=10)", () => {
    const overrides = customTeamToPlayerOverrides(makeTeam());
    expect(overrides["p1"].contactMod).toBe(10);
  });

  it("includes pitching mods for pitchers", () => {
    const overrides = customTeamToPlayerOverrides(makeTeam());
    expect(overrides["p4"].velocityMod).toBeDefined();
    expect(overrides["p4"].controlMod).toBeDefined();
  });

  it("includes movementMod for pitchers with non-default movement", () => {
    const overrides = customTeamToPlayerOverrides(makeTeam());
    // p4 has movement: 70 → offset = 70 - 60 = 10 → movementMod = 10
    expect(overrides["p4"].movementMod).toBe(10);
  });

  it("includes pitching mods for legacy pitcher roles in pitcher slots", () => {
    const team = makeTeam({
      roster: {
        ...makeTeam().roster,
        pitchers: [
          {
            id: "p4",
            name: "Ray Davis",
            role: "SP",
            position: "SP",
            handedness: "R",
            pitching: { velocity: 75, control: 65, movement: 70, stamina: 80 },
          } as unknown as TeamWithRoster["roster"]["pitchers"][number],
        ],
      },
    });
    const overrides = customTeamToPlayerOverrides(team);
    expect(overrides["p4"].velocityMod).toBe(10);
    expect(overrides["p4"].controlMod).toBe(5);
    expect(overrides["p4"].movementMod).toBe(10);
    expect(overrides["p4"].staminaMod).toBe(20);
  });

  it("includes staminaMod for pitchers with non-default stamina", () => {
    const team = makeTeam({
      roster: {
        ...makeTeam().roster,
        pitchers: [
          {
            id: "p4",
            name: "Ray Davis",
            role: "pitcher",
            position: "P",
            handedness: "R",
            pitching: { velocity: 75, control: 65, movement: 70, stamina: 80 },
          },
        ],
      },
    });
    const overrides = customTeamToPlayerOverrides(team);
    expect(overrides["p4"].staminaMod).toBe(20);
  });

  it("maps batter stamina into staminaMod for non-pitchers", () => {
    const team = makeTeam({
      roster: {
        ...makeTeam().roster,
        lineup: [
          {
            id: "p1",
            name: "Tom Adams",
            role: "batter",
            position: "C",
            handedness: "L",
            batting: { contact: 70, power: 65, speed: 60, stamina: 80 },
          },
          makeTeam().roster.lineup[1],
        ],
      },
    });
    const overrides = customTeamToPlayerOverrides(team);
    expect(overrides["p1"].staminaMod).toBe(20);
  });

  it("prefers pitching stamina over batting stamina when pitching data exists", () => {
    const team = makeTeam({
      roster: {
        ...makeTeam().roster,
        pitchers: [
          {
            id: "p4",
            name: "Ray Davis",
            role: "pitcher",
            position: "P",
            handedness: "R",
            pitching: { velocity: 75, control: 65, movement: 70, stamina: 80 },
          },
        ],
      },
    });
    const overrides = customTeamToPlayerOverrides(team);
    expect(overrides["p4"].staminaMod).toBe(20);
  });

  it("includes batting overrides for legacy lineup players with role === undefined", () => {
    const team = makeTeam({
      roster: {
        ...makeTeam().roster,
        lineup: [
          {
            id: "p1",
            name: "Tom Adams",
            // No role field — simulates a legacy export saved before schema hardening
            position: "C",
            handedness: "L" as const,
            // stamina: 80 is intentionally non-default (DEFAULT_BATTING_STAMINA=50) so
            // staminaMod = clampMod(80-60) = 20 is a distinct, verifiable expected value.
            batting: { contact: 70, power: 65, speed: 60, stamina: 80 },
          } as unknown as TeamWithRoster["roster"]["lineup"][number],
        ],
      },
    });
    const overrides = customTeamToPlayerOverrides(team);
    // Legacy players with no role should NOT be silently dropped — they should
    // receive batting overrides just like explicit role="batter" players.
    expect(overrides["p1"]).toBeDefined();
    expect(overrides["p1"].contactMod).toBe(10);
    expect(overrides["p1"].staminaMod).toBe(20);
  });

  it("does not include pitching mods for batters", () => {
    const overrides = customTeamToPlayerOverrides(makeTeam());
    expect(overrides["p1"].velocityMod).toBeUndefined();
  });

  it("includes position in override when player has a position set", () => {
    const team = makeTeam({
      roster: {
        schemaVersion: 1,
        lineup: [
          {
            id: "p1",
            name: "Tom Adams",
            role: "batter",
            handedness: "R" as const,
            position: "C",
            batting: { contact: 70, power: 65, speed: 60, stamina: 50 },
          },
        ],
        bench: [],
        pitchers: [],
      },
    });
    const overrides = customTeamToPlayerOverrides(team);
    expect(overrides["p1"].position).toBe("C");
  });

  it("omits position in override when player has no position set", () => {
    const team = makeTeam({
      roster: {
        ...makeTeam().roster,
        lineup: [
          {
            ...makeTeam().roster.lineup[0],
            position: "",
          },
        ],
      },
    });
    const overrides = customTeamToPlayerOverrides(team);
    expect(overrides["p1"].position).toBeUndefined();
  });
});

describe("customTeamToHandednessMap", () => {
  it("returns a playerId->handedness lookup for rostered players", () => {
    const map = customTeamToHandednessMap(makeTeam());
    expect(map["p1"]).toBe("L");
    expect(map["p4"]).toBe("R");
  });

  it("defaults to 'R' for players that do not have explicit handedness", () => {
    const map = customTeamToHandednessMap(makeTeam());
    expect(map["p2"]).toBe("R");
  });
});

describe("customTeamToAbbreviation", () => {
  it("returns stored abbreviation for a custom team game ID", () => {
    const teams = [{ ...makeTeam(), id: "ct_abc", abbreviation: "EAG" }];
    expect(customTeamToAbbreviation("ct_abc", teams)).toBe("EAG");
  });

  it("falls back to first-3-chars of team name when abbreviation is missing", () => {
    const teams = [{ ...makeTeam(), id: "ct_abc", name: "Eagles", abbreviation: undefined }];
    expect(customTeamToAbbreviation("ct_abc", teams)).toBe("EAG");
  });

  it("returns undefined for a non-custom (unrecognized) team string", () => {
    expect(customTeamToAbbreviation("New York Yankees", [])).toBeUndefined();
  });

  it("returns undefined when the custom team ID is not found in the list", () => {
    expect(customTeamToAbbreviation("custom:missing", [])).toBeUndefined();
  });
});

describe("resolveTeamLabel", () => {
  it("returns 'Unknown Team' for non-custom (unrecognized) team strings", () => {
    expect(resolveTeamLabel("New York Yankees", [])).toBe("Unknown Team");
  });

  it("returns full display name (City + Name) for a known custom team", () => {
    const teams = [{ ...makeTeam(), id: "ct_abc", city: "Austin", name: "Eagles" }];
    expect(resolveTeamLabel("ct_abc", teams)).toBe("Austin Eagles");
  });

  it("returns just team name when custom team has no city", () => {
    const teams = [{ ...makeTeam(), id: "ct_abc", city: "", name: "Eagles" }];
    expect(resolveTeamLabel("ct_abc", teams)).toBe("Eagles");
  });

  it("returns 'Unknown Team' for an unknown ct_* ID not in the list", () => {
    const result = resolveTeamLabel("ct_unknown123", []);
    expect(result).toBe("Unknown Team");
  });

  it("resolves a custom team ID that contains hyphens", () => {
    const teams = [{ ...makeTeam(), id: "ct-hyphen-id", city: "Test", name: "Rockets" }];
    expect(resolveTeamLabel("ct-hyphen-id", teams)).toBe("Test Rockets");
  });
});

describe("resolveCustomIdsInString", () => {
  it("replaces a single ct_* token with the team display name", () => {
    const teams = [{ ...makeTeam(), id: "ct_abc", city: "Austin", name: "Eagles" }];
    expect(resolveCustomIdsInString("ct_abc hit a single", teams)).toBe(
      "Austin Eagles hit a single",
    );
  });

  it("replaces multiple ct_* tokens in the same string", () => {
    const teams = [
      { ...makeTeam(), id: "ct_home", city: "Dallas", name: "Stars" },
      { ...makeTeam(), id: "ct_away", city: "Boston", name: "Reds" },
    ];
    const result = resolveCustomIdsInString("ct_away at ct_home", teams);
    expect(result).toBe("Boston Reds at Dallas Stars");
  });

  it("leaves non-custom strings unchanged", () => {
    expect(resolveCustomIdsInString("New York Yankees hit a homer", [])).toBe(
      "New York Yankees hit a homer",
    );
  });

  it("replaces unknown ct_* IDs with 'Unknown Team'", () => {
    const result = resolveCustomIdsInString("Team ct_unknown123 scored", []);
    expect(result).toContain("Unknown Team");
    expect(result).not.toContain("ct_unknown");
  });

  it("handles empty string without error", () => {
    expect(resolveCustomIdsInString("", [])).toBe("");
  });

  it("handles a string with no tokens without error", () => {
    expect(resolveCustomIdsInString("no tokens here", [])).toBe("no tokens here");
  });
});

const FULL_LINEUP_POSITIONS = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH"];
const makeFullLineup = () =>
  FULL_LINEUP_POSITIONS.map((pos, i) => ({
    id: `pl_${i}`,
    name: `Player ${i + 1}`,
    role: "batter" as const,
    handedness: "R" as const,
    batting: { contact: 50, power: 50, speed: 50, stamina: 50 },
    position: pos,
  }));

const makeValidTeam = (overrides: Partial<TeamWithRoster> = {}): TeamWithRoster => ({
  ...makeTeam(),
  roster: {
    schemaVersion: 1,
    lineup: makeFullLineup(),
    bench: [],
    pitchers: [
      {
        id: "sp1",
        name: "Ace Pitcher",
        role: "pitcher",
        position: "P",
        handedness: "R" as const,
        pitching: { velocity: 75, control: 65, movement: 70, stamina: 60 },
      },
    ],
  },
  ...overrides,
});

describe("validateCustomTeamForGame", () => {
  it("returns null for a valid team with all 9 lineup positions", () => {
    expect(validateCustomTeamForGame(makeValidTeam())).toBeNull();
  });

  it("returns error when lineup has a duplicate position", () => {
    const lineup = makeFullLineup();
    // Replace DH with a second C (duplicate C, missing DH)
    lineup[8] = { ...lineup[8], position: "C" };
    const team = makeValidTeam({
      roster: { ...makeValidTeam().roster, lineup },
    });
    const err = validateCustomTeamForGame(team);
    expect(err).toBeTruthy();
    expect(err).toContain("C");
    expect(err).toContain("duplicate");
  });

  it("returns error when lineup is missing a required position", () => {
    const lineup = makeFullLineup().slice(0, 8); // drop DH
    const team = makeValidTeam({
      roster: { ...makeValidTeam().roster, lineup },
    });
    const err = validateCustomTeamForGame(team);
    expect(err).toBeTruthy();
    expect(err).toContain("DH");
    expect(err).toContain("missing");
  });

  it("reports all duplicate positions when multiple are duplicated", () => {
    const lineup = makeFullLineup();
    lineup[7] = { ...lineup[7], position: "C" }; // RF slot → C (second C)
    lineup[8] = { ...lineup[8], position: "SS" }; // DH slot → SS (second SS)
    const team = makeValidTeam({
      roster: { ...makeValidTeam().roster, lineup },
    });
    const err = validateCustomTeamForGame(team);
    expect(err).toContain("C");
    expect(err).toContain("SS");
  });

  it("reports all missing positions when multiple are absent", () => {
    // Lineup with only C and 1B (7 required positions missing)
    const lineup = [
      {
        id: "p_a",
        name: "Player A",
        role: "batter" as const,
        handedness: "R" as const,
        batting: { contact: 50, power: 50, speed: 50, stamina: 50 },
        position: "C",
      },
      {
        id: "p_b",
        name: "Player B",
        role: "batter" as const,
        handedness: "R" as const,
        batting: { contact: 50, power: 50, speed: 50, stamina: 50 },
        position: "1B",
      },
    ];
    const team = makeValidTeam({
      roster: { ...makeValidTeam().roster, lineup },
    });
    const err = validateCustomTeamForGame(team);
    expect(err).toContain("2B");
    expect(err).toContain("3B");
    expect(err).toContain("SS");
  });

  // ── Pitcher checks ─────────────────────────────────────────────────────────

  it("returns error when team has no pitchers", () => {
    const team = makeValidTeam({
      roster: { ...makeValidTeam().roster, pitchers: [] },
    });
    const err = validateCustomTeamForGame(team);
    expect(err).toBeTruthy();
    expect(err).toContain("no pitchers");
  });

  it("returns error when team has only one pitcher with an empty name", () => {
    const team = makeValidTeam({
      roster: {
        ...makeValidTeam().roster,
        pitchers: [
          {
            id: "sp_bad",
            name: "",
            role: "pitcher",
            position: "P",
            handedness: "R" as const,
            pitching: { velocity: 70, control: 65, movement: 60, stamina: 60 },
          },
        ],
      },
    });
    const err = validateCustomTeamForGame(team);
    expect(err).toBeTruthy();
    expect(err).toContain("pitcher with no name");
  });

  it("returns error when one of several pitchers has an empty name", () => {
    const team = makeValidTeam({
      roster: {
        ...makeValidTeam().roster,
        pitchers: [
          {
            id: "sp1",
            name: "Good Ace",
            role: "pitcher",
            position: "P",
            handedness: "R" as const,
            pitching: { velocity: 70, control: 65, movement: 60, stamina: 60 },
          },
          {
            id: "sp2",
            name: "   ",
            role: "pitcher",
            position: "P",
            handedness: "R" as const,
            pitching: { velocity: 65, control: 60, movement: 55, stamina: 60 },
          },
        ],
      },
    });
    const err = validateCustomTeamForGame(team);
    expect(err).toBeTruthy();
    expect(err).toContain("pitcher with no name");
  });

  it("returns null when team has multiple valid pitchers", () => {
    const team = makeValidTeam({
      roster: {
        ...makeValidTeam().roster,
        pitchers: [
          {
            id: "sp1",
            name: "Ace Starter",
            role: "pitcher",
            position: "P",
            handedness: "R" as const,
            pitching: { velocity: 80, control: 70, movement: 65, stamina: 60 },
          },
          {
            id: "rp1",
            name: "Relief Guy",
            role: "pitcher",
            position: "P",
            handedness: "R" as const,
            pitching: { velocity: 75, control: 65, movement: 60, stamina: 60 },
          },
        ],
      },
    });
    expect(validateCustomTeamForGame(team)).toBeNull();
  });

  it("returns error when lineup contains an unsupported role", () => {
    const lineup = makeFullLineup();
    lineup[0] = { ...lineup[0], role: "two-way" as never };
    const team = makeValidTeam({ roster: { ...makeValidTeam().roster, lineup } });
    const err = validateCustomTeamForGame(team);
    expect(err).toBeTruthy();
    expect(err).toContain("lineup player with unsupported role");
  });

  it("returns error when bench contains an unsupported role", () => {
    const team = makeValidTeam({
      roster: {
        ...makeValidTeam().roster,
        bench: [
          {
            id: "bench_tw",
            name: "Legacy Bench Two-Way",
            role: "two-way" as never,
            position: "LF",
            handedness: "R",
            batting: { contact: 55, power: 55, speed: 55, stamina: 50 },
          },
        ],
      },
    });
    const err = validateCustomTeamForGame(team);
    expect(err).toBeTruthy();
    expect(err).toContain("bench player with unsupported role");
  });

  it("returns error when pitchers list contains a non-pitcher role", () => {
    const team = makeValidTeam({
      roster: {
        ...makeValidTeam().roster,
        pitchers: [{ ...makeValidTeam().roster.pitchers[0], role: "batter" as never }],
      },
    });
    const err = validateCustomTeamForGame(team);
    expect(err).toBeTruthy();
    expect(err).toContain("pitcher entry with unsupported role");
  });

  it("returns error when team name is empty", () => {
    const team = makeValidTeam({ name: "" });
    const err = validateCustomTeamForGame(team);
    expect(err).toBeTruthy();
    expect(err).toContain("no name");
  });

  it("returns error when team name is whitespace-only", () => {
    const team = makeValidTeam({ name: "   " });
    const err = validateCustomTeamForGame(team);
    expect(err).toBeTruthy();
    expect(err).toContain("no name");
  });

  it("returns error when lineup is empty", () => {
    const team = makeValidTeam({
      roster: { ...makeValidTeam().roster, lineup: [] },
    });
    const err = validateCustomTeamForGame(team);
    expect(err).toBeTruthy();
    expect(err).toContain("no lineup players");
  });

  it("returns error when a lineup player has an empty name", () => {
    const lineup = makeFullLineup();
    lineup[3] = { ...lineup[3], name: "" };
    const team = makeValidTeam({ roster: { ...makeValidTeam().roster, lineup } });
    const err = validateCustomTeamForGame(team);
    expect(err).toBeTruthy();
    expect(err).toContain("lineup player with no name");
  });

  it("returns error when a lineup player name is whitespace-only", () => {
    const lineup = makeFullLineup();
    lineup[0] = { ...lineup[0], name: "  " };
    const team = makeValidTeam({ roster: { ...makeValidTeam().roster, lineup } });
    const err = validateCustomTeamForGame(team);
    expect(err).toBeTruthy();
    expect(err).toContain("lineup player with no name");
  });
});
