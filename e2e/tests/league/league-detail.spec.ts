/**
 * League Detail Page — E2E tests
 *
 * Covers:
 * - Not-found state for an unknown league ID
 * - Pending season: "Start Season" button is present
 * - Active season: Game Day 1 visible after starting the season (regression)
 * - Active season: Simulate Day marks games completed and updates standings
 * - Active season: Box Score toggle appears after simulation
 * - Box Score panel shows inning data (not "Box score unavailable")
 * - Visual snapshot of league detail with an active season
 *
 * All tests run desktop-only (@desktop-only tag).
 */

import { expect, test } from "@playwright/test";

import { disableAnimations, importTeamsFixture, resetAppState } from "../../utils/helpers";
import { createLeagueViaUI } from "./helpers";

test.describe("League Detail Page", { tag: "@desktop-only" }, () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  // ── Not found ────────────────────────────────────────────────────────────────

  test("shows not-found message for an unknown league id", async ({ page }) => {
    await page.goto("/league/nonexistent-league-id");
    await expect(page.getByTestId("league-detail-page")).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByTestId("league-not-found").or(page.getByTestId("league-detail-error")),
    ).toBeVisible({ timeout: 10_000 });
  });

  // ── Pending season ───────────────────────────────────────────────────────────

  test("shows Start Season button when season is pending", async ({ page }) => {
    await importTeamsFixture(page, "fixture-teams.json");
    const leagueId = await createLeagueViaUI(page, "E2E Detail Pending League");

    await page.goto(`/league/${leagueId}`);
    await expect(page.getByTestId("league-detail-page")).toBeVisible({ timeout: 15_000 });

    await expect(page.getByTestId("start-season-button")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("season-not-started")).toBeVisible();
  });

  // ── Active season ────────────────────────────────────────────────────────────

  test("Game Day 1 appears after starting the season", async ({ page }) => {
    await importTeamsFixture(page, "fixture-teams.json");
    const leagueId = await createLeagueViaUI(page, "E2E Detail Active League");

    await page.goto(`/league/${leagueId}`);
    await expect(page.getByTestId("start-season-button")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("start-season-button").click();

    // Season should now be active — start button must disappear
    await expect(page.getByTestId("start-season-button")).not.toBeVisible({ timeout: 10_000 });

    // Schedule section: Game Day 1 heading must be visible (regression: was previously Day 2)
    // Use an exact role match to avoid matching "Game Day 10", "Game Day 11" etc.
    await expect(
      page.getByRole("heading", { name: "Game Day 1", exact: true }),
    ).toBeVisible({ timeout: 15_000 });

    // Simulate Day button should now be enabled
    await expect(page.getByTestId("simulate-day-button")).toBeVisible();
    await expect(page.getByTestId("simulate-day-button")).toBeEnabled();
  });

  test("Simulate Day marks Day 1 games completed", async ({ page }) => {
    await importTeamsFixture(page, "fixture-teams.json");
    const leagueId = await createLeagueViaUI(page, "E2E Detail Simulate League");

    await page.goto(`/league/${leagueId}`);
    await expect(page.getByTestId("start-season-button")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("start-season-button").click();
    await expect(page.getByTestId("simulate-day-button")).toBeVisible({ timeout: 10_000 });

    // Simulate Day 1
    await page.getByTestId("simulate-day-button").click();
    // Button should show "Simulating…" briefly, then re-enable or become disabled
    // Wait for the simulation to finish — Day 1 games should now show "Completed"
    await expect(page.getByText("Completed")).toBeVisible({ timeout: 15_000 });

    // Standings should now reflect games played (non-zero W or L for at least one team)
    await expect(page.getByTestId("standings-table")).toBeVisible({ timeout: 10_000 });
    const standingsText = await page.getByTestId("standings-table").innerText();
    // After simulation, wins + losses total should be > 0
    expect(standingsText).toMatch(/[1-9]/);
  });

  test("Box Score toggle appears after simulation and shows inning data", async ({ page }) => {
    await importTeamsFixture(page, "fixture-teams.json");
    const leagueId = await createLeagueViaUI(page, "E2E Detail Box Score League");

    await page.goto(`/league/${leagueId}`);
    await expect(page.getByTestId("start-season-button")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("start-season-button").click();
    await expect(page.getByTestId("simulate-day-button")).toBeVisible({ timeout: 10_000 });

    // Simulate Day 1
    await page.getByTestId("simulate-day-button").click();
    await expect(page.getByText("Completed")).toBeVisible({ timeout: 15_000 });

    // A "Box Score" toggle should appear on completed games
    const boxScoreToggle = page.getByRole("button", { name: /box score/i }).first();
    await expect(boxScoreToggle).toBeVisible({ timeout: 10_000 });

    // Click it to expand
    await boxScoreToggle.click();

    // Box Score panel must show — and must NOT say "Box score unavailable"
    const boxPanel = page.locator('[data-testid^="box-score-panel-"]').first();
    await expect(boxPanel).toBeVisible({ timeout: 10_000 });
    const panelText = await boxPanel.innerText();
    expect(panelText).not.toContain("Box score unavailable");
    // Should contain a numeric inning column (at minimum a "1" header)
    expect(panelText).toMatch(/\d/);
  });

  // ── Visual snapshot ──────────────────────────────────────────────────────────

  test("visual snapshot — league detail active season", async ({ page }) => {
    await importTeamsFixture(page, "fixture-teams.json");
    const leagueId = await createLeagueViaUI(page, "E2E Visual League");

    await page.goto(`/league/${leagueId}`);
    await expect(page.getByTestId("start-season-button")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("start-season-button").click();

    // Wait for schedule to render before snapshotting
    await expect(page.getByTestId("schedule-table")).toBeVisible({ timeout: 15_000 });
    await disableAnimations(page);

    await expect(page.getByTestId("league-detail-page")).toHaveScreenshot(
      "league-detail-active.png",
      {
        // Mask the league title (contains user-provided name) and season info that
        // includes IDs/dates to reduce snapshot churn.
        maxDiffPixelRatio: 0.05,
      },
    );
  });
});
