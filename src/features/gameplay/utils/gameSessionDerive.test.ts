import { describe, expect, it } from "vitest";

import { deriveExhibitionSession, deriveLeagueSession } from "./gameSessionDerive";

const makeSetup = (managedTeam: 0 | 1 | null = null) => ({
  homeTeam: "team-home",
  awayTeam: "team-away",
  homeTeamLabel: "Home",
  awayTeamLabel: "Away",
  managedTeam,
  playerOverrides: { away: {}, home: {}, awayOrder: [], homeOrder: [] },
});

describe("deriveExhibitionSession", () => {
  it("returns sessionType exhibition", () => {
    expect(deriveExhibitionSession(makeSetup()).sessionType).toBe("exhibition");
  });

  it("always returns managerModeAllowed=true regardless of managedTeam (exhibition always allows toggle)", () => {
    expect(deriveExhibitionSession(makeSetup(null)).managerModeAllowed).toBe(true);
    expect(deriveExhibitionSession(makeSetup(0)).managerModeAllowed).toBe(true);
    expect(deriveExhibitionSession(makeSetup(1)).managerModeAllowed).toBe(true);
  });

  it("returns disableSave=false (exhibition games always persist saves)", () => {
    expect(deriveExhibitionSession(makeSetup()).disableSave).toBe(false);
  });

  it("returns seasonGameId=null", () => {
    expect(deriveExhibitionSession(makeSetup()).seasonGameId).toBeNull();
  });

  it("passes managedTeam=null from setup", () => {
    expect(deriveExhibitionSession(makeSetup(null)).managedTeam).toBeNull();
  });

  it("passes managedTeam=0 (away) from setup", () => {
    expect(deriveExhibitionSession(makeSetup(0)).managedTeam).toBe(0);
  });

  it("passes managedTeam=1 (home) from setup", () => {
    expect(deriveExhibitionSession(makeSetup(1)).managedTeam).toBe(1);
  });

  it("returns sessionReady=true (setup is synchronously available)", () => {
    expect(deriveExhibitionSession(makeSetup()).sessionReady).toBe(true);
  });
});

describe("deriveLeagueSession", () => {
  it("returns sessionType league", () => {
    expect(deriveLeagueSession("sg-abc", null).sessionType).toBe("league");
  });

  it("returns disableSave=true (league games never persist mid-game saves)", () => {
    expect(deriveLeagueSession("sg-abc", null).disableSave).toBe(true);
  });

  it("propagates seasonGameId", () => {
    expect(deriveLeagueSession("sg-abc", null).seasonGameId).toBe("sg-abc");
    expect(deriveLeagueSession("sg-xyz", 0).seasonGameId).toBe("sg-xyz");
  });

  it("returns managerModeAllowed=false for spectator (managedTeamIdx=null)", () => {
    expect(deriveLeagueSession("sg-abc", null).managerModeAllowed).toBe(false);
  });

  it("returns managerModeAllowed=true when managing away team (index 0)", () => {
    expect(deriveLeagueSession("sg-abc", 0).managerModeAllowed).toBe(true);
  });

  it("returns managerModeAllowed=true when managing home team (index 1)", () => {
    expect(deriveLeagueSession("sg-abc", 1).managerModeAllowed).toBe(true);
  });

  it("passes managedTeam through", () => {
    expect(deriveLeagueSession("sg-abc", null).managedTeam).toBeNull();
    expect(deriveLeagueSession("sg-abc", 0).managedTeam).toBe(0);
    expect(deriveLeagueSession("sg-abc", 1).managedTeam).toBe(1);
  });

  it("returns sessionReady=true (LeagueGamePage fetches before rendering Game)", () => {
    expect(deriveLeagueSession("sg-abc", null).sessionReady).toBe(true);
  });
});
