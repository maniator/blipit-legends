/**
 * Unit tests for seasonPresets.
 */
import { describe, expect, it } from "vitest";

import { SPRINT_TOTAL_GAME_DAYS, getTotalGameDays } from "./seasonPresets";

describe("seasonPresets", () => {
  it("SPRINT_TOTAL_GAME_DAYS is 14", () => {
    expect(SPRINT_TOTAL_GAME_DAYS).toBe(14);
  });

  it("getTotalGameDays('mini', 'sprint') returns 14", () => {
    expect(getTotalGameDays("mini", "sprint")).toBe(14);
  });

  it("getTotalGameDays('standard', 'marathon') falls back to SPRINT_TOTAL_GAME_DAYS", () => {
    expect(getTotalGameDays("standard", "marathon")).toBe(SPRINT_TOTAL_GAME_DAYS);
  });

  it("getTotalGameDays('mini', 'unknown') falls back to SPRINT_TOTAL_GAME_DAYS", () => {
    expect(getTotalGameDays("mini", "unknown")).toBe(SPRINT_TOTAL_GAME_DAYS);
  });
});
