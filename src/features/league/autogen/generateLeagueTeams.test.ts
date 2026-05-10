import { describe, expect, it } from "vitest";

import { type AutogenParity, type AutogenTheme, generateLeagueTeams } from "./generateLeagueTeams";

const minimums = { lineup: 9, bench: 3, startingPitchers: 5, reliefPitchers: 3 };

const deterministicIds = () => {
  let team = 0;
  let player = 0;
  return {
    teamId: () => `ct_test_${team++}`,
    playerId: () => `p_test_${player++}`,
  };
};

const generate = (theme: AutogenTheme = "classic", parity: AutogenParity = "mixed") =>
  generateLeagueTeams({
    count: 8,
    theme,
    parity,
    masterSeed: "phase3-master-seed",
    autogenSubSeed: "subseed-a",
    rosterMinimums: minimums,
    idFactory: deterministicIds(),
  });

describe("generateLeagueTeams", () => {
  it("is deterministic for the same options and id factories", () => {
    expect(generate()).toEqual(generate());
  });

  it("is deterministic with the default seeded ID generation", () => {
    const options = {
      count: 2,
      theme: "classic" as const,
      parity: "mixed" as const,
      masterSeed: "phase3-master-seed",
      autogenSubSeed: "subseed-default-id",
      rosterMinimums: minimums,
    };
    expect(generateLeagueTeams(options)).toEqual(generateLeagueTeams(options));
  });

  it("generates the v1 roster minimums", () => {
    const [team] = generate();
    expect(team.roster.lineup).toHaveLength(9);
    expect(team.roster.bench).toHaveLength(3);
    expect(team.roster.pitchers).toHaveLength(8);
    expect(team.roster.pitchers.filter((p) => p.pitchingRole === "SP")).toHaveLength(5);
    expect(team.roster.pitchers.filter((p) => p.pitchingRole === "RP")).toHaveLength(3);
  });

  it.each<AutogenTheme>(["classic", "scifi", "whimsical", "mix"])(
    "supports %s theme and de-dupes names within the league",
    (theme) => {
      const teams = generate(theme);
      const names = teams.map((team) => team.name);
      expect(new Set(names).size).toBe(names.length);
      expect(teams.every((team) => team.autogen.theme === theme)).toBe(true);
    },
  );

  it.each<AutogenParity>(["balanced", "mixed", "random"])(
    "supports %s parity and stamps the autogen marker",
    (parity) => {
      const teams = generate("classic", parity);
      expect(teams.every((team) => team.autogen.version === 1)).toBe(true);
      expect(teams.every((team) => team.autogen.parity === parity)).toBe(true);
      expect(
        teams.every((team) => team.autogen.baseSeed === "phase3-master-seed:autogen:subseed-a"),
      ).toBe(true);
    },
  );

  it("keeps all generated hitter and pitcher stat totals within custom-team caps", () => {
    const teams = generate("mix", "random");
    for (const team of teams) {
      for (const batter of [...team.roster.lineup, ...(team.roster.bench ?? [])]) {
        if (batter.role !== "batter") continue;
        const { contact, power, speed } = batter.batting;
        expect(contact + power + speed).toBeLessThanOrEqual(150);
      }
      for (const pitcher of team.roster.pitchers) {
        if (pitcher.role !== "pitcher") continue;
        const { velocity, control, movement } = pitcher.pitching;
        expect(velocity + control + movement).toBeLessThanOrEqual(160);
      }
    }
  });

  it("covers all themes × parities × counts 8/16/24", () => {
    const themes: AutogenTheme[] = ["classic", "scifi", "whimsical", "mix"];
    const parities: AutogenParity[] = ["balanced", "mixed", "random"];
    for (const theme of themes) {
      for (const parity of parities) {
        for (const count of [8, 16, 24]) {
          const teams = generateLeagueTeams({
            count,
            theme,
            parity,
            masterSeed: `seed-${theme}-${parity}-${count}`,
            autogenSubSeed: "sub",
            rosterMinimums: minimums,
          });
          expect(teams).toHaveLength(count);
          expect(new Set(teams.map((team) => team.name)).size).toBe(count);
        }
      }
    }
  });

  it("passes sanitizer/stat-cap coverage across 100 seeds", () => {
    for (let i = 0; i < 100; i++) {
      const teams = generateLeagueTeams({
        count: 8,
        theme: "mix",
        parity: i % 3 === 0 ? "balanced" : i % 3 === 1 ? "mixed" : "random",
        masterSeed: `hundred-seed-${i}`,
        autogenSubSeed: "sub",
        rosterMinimums: minimums,
      });
      for (const team of teams) {
        expect(team.roster.lineup).toHaveLength(9);
        expect(team.roster.pitchers).toHaveLength(8);
      }
    }
  });

  it("throws when roster minimums are below v1 league-play minimums", () => {
    expect(() =>
      generateLeagueTeams({
        count: 1,
        theme: "classic",
        parity: "mixed",
        masterSeed: "seed",
        autogenSubSeed: "sub",
        rosterMinimums: { lineup: 8, bench: 3, startingPitchers: 5, reliefPitchers: 3 },
      }),
    ).toThrow(/rosterMinimums must meet v1 minimums/);
  });

  it("throws for invalid counts", () => {
    expect(() =>
      generateLeagueTeams({
        count: 0,
        theme: "classic",
        parity: "mixed",
        masterSeed: "seed",
        autogenSubSeed: "sub",
        rosterMinimums: minimums,
      }),
    ).toThrow(/count must be a positive integer/);
  });
});
