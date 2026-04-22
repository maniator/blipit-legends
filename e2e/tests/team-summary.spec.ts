/**
 * E2E tests for the Team Summary and per-player role-aware Career tabs
 * on the Career Stats hub (/stats).
 *
 * Split out from career-stats.spec.ts so that team-aggregate tests
 * (W/L record, run scoring, leader cards) and player career tab
 * visibility tests live alongside the data they verify.
 *
 * Fixture: team-summary-history.json
 *   - 3 games: W/L/W → streak=W1, record=2-1, RS=16, RA=10, DIFF=+6
 *   - Batting:  J.Qualify (22 AB, qualifies), P.NoQualify (4 AB, does not qualify)
 *   - Pitching: A.Starter (36 outs, qualifies), R.Reliever (3 outs, does not qualify)
 */

import { expect, type Page, test } from "@playwright/test";

import {
  clickWithRetry,
  EFFECTIVELY_PAUSED_SPEED,
  importHistoryFixture,
  loadFixture,
  startGameViaPlayBall,
} from "../utils/helpers";

// ── Team Summary + Leaders ────────────────────────────────────────────────────

test.describe("Team Summary and Leaders", () => {
  /**
   * Seeds the team-summary-history fixture and opens /stats with e2e_summary_team selected.
   * The fixture has 3 games: W/L/W → streak=W1, W/L=2-1, RS=16, RA=10, DIFF=+6.
   * Batting: J.Qualify (22 AB, qualifies), P.NoQualify (4 AB, does not qualify).
   * Pitching: A.Starter (36 outs, qualifies), R.Reliever (3 outs, does not qualify).
   */
  async function seedSummaryAndOpen(page: Page) {
    await page.addInitScript(() => {
      localStorage.setItem("speed", EFFECTIVELY_PAUSED_SPEED);
    });
    await loadFixture(page, "sample-save.json");
    await importHistoryFixture(page, "team-summary-history.json");
    await page.goto("/stats");
    await expect(page.getByTestId("career-stats-page")).toBeVisible({ timeout: 15_000 });
    const teamSelect = page.getByTestId("career-stats-team-select");
    await expect(teamSelect).toBeVisible({ timeout: 5_000 });
    // Wait for the e2e_summary_team option to appear in the dropdown before
    // selecting it.  On slow CI/mobile WebKit runners the reactive teamsWithHistory
    // subscription can still be in-flight when the page first renders, so calling
    // selectOption before the option exists would throw a Playwright error.
    await expect(teamSelect.locator('option[value="e2e_summary_team"]')).toBeAttached({
      timeout: 15_000,
    });
    await teamSelect.selectOption("e2e_summary_team");
    // With the RxDB reactive subscription fix in useCareerStatsData, the imported
    // history rows are now guaranteed to be reflected in the query result.  Use a
    // generous 45 s timeout to accommodate slow CI runners (iphone-15-pro-max WebKit
    // can take longer than 30 s to process the RxDB subscription update and re-render).
    const summaryWL = page.getByTestId("summary-wl");
    await expect(summaryWL).toHaveText("2-1", { timeout: 45_000 });
  }

  test("team summary section shows W/L record", async ({ page }) => {
    await seedSummaryAndOpen(page);
    // W/L = 2-1
    await expect(page.getByTestId("summary-wl")).toHaveText("2-1", { timeout: 10_000 });
  });

  test("team summary section shows correct RS and RA", async ({ page }) => {
    await seedSummaryAndOpen(page);
    // RS=16 (7+3+6), RA=10 (3+5+2)
    await expect(page.getByTestId("summary-rs")).toHaveText("16", { timeout: 10_000 });
    await expect(page.getByTestId("summary-ra")).toHaveText("10", { timeout: 5_000 });
  });

  test("team summary section shows correct run differential", async ({ page }) => {
    await seedSummaryAndOpen(page);
    // DIFF = +6
    await expect(page.getByTestId("summary-diff")).toHaveText("+6", { timeout: 10_000 });
  });

  test("team summary section shows current streak", async ({ page }) => {
    await seedSummaryAndOpen(page);
    // Last game is a win → streak = W1
    await expect(page.getByTestId("summary-streak")).toHaveText("W1", { timeout: 10_000 });
  });

  test("team summary section shows last-10 record", async ({ page }) => {
    await seedSummaryAndOpen(page);
    // 3 games total, 2 wins 1 loss
    await expect(page.getByTestId("summary-last10")).toHaveText("2-1", { timeout: 10_000 });
  });

  test("HR leader card shows J. Qualify with 1 HR", async ({ page }) => {
    await seedSummaryAndOpen(page);
    const hrCard = page.getByTestId("hr-leader-card");
    await expect(hrCard).toBeVisible({ timeout: 10_000 });
    await expect(hrCard).toContainText("J. Qualify");
    await expect(hrCard).toContainText("1");
  });

  test("AVG leader card shows J. Qualify (qualifies with 22 AB)", async ({ page }) => {
    await seedSummaryAndOpen(page);
    const avgCard = page.getByTestId("avg-leader-card");
    await expect(avgCard).toBeVisible({ timeout: 10_000 });
    await expect(avgCard).toContainText("J. Qualify");
    // P. NoQualify (4 AB) should not appear — they don't meet the threshold
    await expect(avgCard).not.toContainText("P. NoQualify");
  });

  test("ERA leader shows A. Starter (qualifies with 36 outs)", async ({ page }) => {
    await seedSummaryAndOpen(page);
    const eraCard = page.getByTestId("era-leader-card");
    await expect(eraCard).toBeVisible({ timeout: 10_000 });
    await expect(eraCard).toContainText("A. Starter");
    // R. Reliever (3 outs) should not appear — doesn't meet the threshold
    await expect(eraCard).not.toContainText("R. Reliever");
  });

  test("saves leader card shows R. Reliever with 1 save", async ({ page }) => {
    await seedSummaryAndOpen(page);
    const svCard = page.getByTestId("saves-leader-card");
    await expect(svCard).toBeVisible({ timeout: 10_000 });
    await expect(svCard).toContainText("R. Reliever");
    await expect(svCard).toContainText("1");
  });

  test("clicking HR leader card navigates to the player's career page", async ({ page }) => {
    await seedSummaryAndOpen(page);
    const hrCard = page.getByTestId("hr-leader-card");
    await expect(hrCard).toBeVisible({ timeout: 10_000 });
    await clickWithRetry(() => page.getByTestId("hr-leader-card"));
    await expect(page.getByTestId("player-career-page")).toBeVisible({ timeout: 15_000 });
    expect(page.url()).toContain("/stats/");
    expect(page.url()).toContain("e2e_batter_qualify");
  });
});

// ── Role-aware Player Career tabs ─────────────────────────────────────────────

test.describe("Role-aware Player Career tabs", () => {
  async function seedForRoleAware(page: Page) {
    await page.addInitScript(() => {
      localStorage.setItem("speed", EFFECTIVELY_PAUSED_SPEED);
    });
    await startGameViaPlayBall(page);
    await importHistoryFixture(page, "team-summary-history.json");
  }

  test("batter-only player (no pitching history) does NOT show Pitching tab", async ({ page }) => {
    await seedForRoleAware(page);
    await page.goto("/stats/e2e_summary_team/players/e2e_batter_qualify");
    await expect(page.getByTestId("player-career-page")).toBeVisible({ timeout: 15_000 });
    // Wait for player name (only rendered after loading completes) to avoid checking
    // not.toBeVisible() while loading=true shows both tabs as placeholders.
    await expect(page.getByText("J. Qualify")).toBeVisible({ timeout: 10_000 });
    // Pitching tab must NOT be shown for a batter-only player
    await expect(page.getByRole("button", { name: /^pitching$/i })).not.toBeVisible({
      timeout: 10_000,
    });
  });

  test("pitcher-only player (no batting history) does NOT show Batting tab", async ({ page }) => {
    await seedForRoleAware(page);
    await page.goto("/stats/e2e_summary_team/players/e2e_pitcher_starter");
    await expect(page.getByTestId("player-career-page")).toBeVisible({ timeout: 15_000 });
    // Wait for player name (only rendered after loading completes) to avoid checking
    // not.toBeVisible() while loading=true shows both tabs as placeholders.
    await expect(page.getByText("A. Starter")).toBeVisible({ timeout: 10_000 });
    // Batting tab must NOT be shown for a pitcher-only player
    await expect(page.getByRole("button", { name: /^batting$/i })).not.toBeVisible({
      timeout: 10_000,
    });
  });

  test("player with no history shows only the tab matching their roster role", async ({ page }) => {
    await seedForRoleAware(page);
    await page.goto("/stats/e2e_summary_team/players/e2e_unknown_player");
    await expect(page.getByTestId("player-career-page")).toBeVisible({ timeout: 15_000 });
    // e2e_unknown_player is a batter in the fixture — only Batting tab should appear
    await expect(page.getByRole("button", { name: /^batting$/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: /^pitching$/i })).not.toBeVisible({
      timeout: 5_000,
    });
  });
});
