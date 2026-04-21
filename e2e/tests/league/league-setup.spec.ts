/**
 * League Setup Page — E2E tests
 *
 * Covers:
 * - Back button returns to home screen
 * - Validation: name required (fires even with no teams loaded)
 * - Validation: at least 2 teams required
 * - "No custom teams" message when the team store is empty
 * - Successful creation navigates to the league detail page
 *
 * Tests that need teams use SPA navigation (home → /league → /league/new)
 * instead of `page.goto("/league/new")` directly, to avoid a full-page reload
 * that races with IndexedDB persistence of just-imported teams.
 *
 * All tests run desktop-only (@desktop-only tag).
 */

import { expect, test } from "@playwright/test";

import { importTeamsFixture, resetAppState } from "../../utils/helpers";
import { createLeagueViaUI } from "./helpers";

/** Navigate to the league setup page via SPA clicks (home → league list → new). */
async function navigateToLeagueSetupViaSPA(page: Parameters<typeof resetAppState>[0]) {
  await expect(page.getByTestId("home-screen")).toBeVisible({ timeout: 10_000 });
  await page.getByTestId("home-league-button").click();
  await expect(page.getByTestId("league-list-page")).toBeVisible({ timeout: 10_000 });
  await page.getByTestId("create-league-button").click();
  await expect(page.getByTestId("league-setup-page")).toBeVisible({ timeout: 10_000 });
}

test.describe("League Setup Page", { tag: "@desktop-only" }, () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  // ── Back navigation ──────────────────────────────────────────────────────────

  test("back button navigates back to home screen", async ({ page }) => {
    await page.goto("/league/new");
    await expect(page.getByTestId("league-setup-page")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("league-setup-back-button").click();
    await expect(page).toHaveURL("/");
    await expect(page.getByTestId("home-screen")).toBeVisible({ timeout: 10_000 });
  });

  // ── Validation ───────────────────────────────────────────────────────────────

  test("shows validation error when league name is empty", async ({ page }) => {
    // No teams needed — empty-name validation fires before team check.
    // Use page.goto since there are no teams to race with IndexedDB.
    await page.goto("/league/new");
    await expect(page.getByTestId("league-setup-page")).toBeVisible({ timeout: 15_000 });

    // Wait for the loading state to settle (button must be enabled)
    await expect(page.getByTestId("start-league-button")).toBeEnabled({ timeout: 10_000 });

    // Fill name with only whitespace — passes browser-native `required`
    // constraint but fails React's `name.trim()` check, triggering our
    // custom validation message instead of the browser tooltip.
    await page.getByTestId("league-name-input").fill("   ");
    await page.getByTestId("start-league-button").click();

    await expect(page.getByTestId("league-setup-validation-error")).toBeVisible({
      timeout: 10_000,
    });
    // Should remain on the setup page
    await expect(page).toHaveURL(/\/league\/new/);
  });

  test("shows validation error when fewer than 2 teams are selected", async ({ page }) => {
    // Import teams first, then use SPA navigation to avoid full-page reload race.
    await importTeamsFixture(page, "fixture-teams.json");
    await navigateToLeagueSetupViaSPA(page);

    // Fill name but select only one team
    await page.getByTestId("league-name-input").fill("One Team League");
    await expect(page.getByTestId("league-teams-select")).toBeVisible({ timeout: 10_000 });
    await page.getByTestId("league-teams-select").selectOption([{ label: "Visitors" }]);
    await page.getByTestId("start-league-button").click();

    await expect(page.getByTestId("league-setup-validation-error")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page).toHaveURL(/\/league\/new/);
  });

  test("shows no-teams message when no custom teams exist", async ({ page }) => {
    // Skip team import so the store is empty
    await page.goto("/league/new");
    await expect(page.getByTestId("league-setup-page")).toBeVisible({ timeout: 15_000 });

    // The MultiSelect should NOT be present; instead the empty-teams message
    await expect(page.getByTestId("league-teams-select")).not.toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/No custom teams found/i)).toBeVisible({ timeout: 10_000 });
  });

  // ── Successful creation ───────────────────────────────────────────────────────

  test("creates league and navigates to detail page", async ({ page }) => {
    // Import teams then create via SPA navigation helper
    await importTeamsFixture(page, "fixture-teams.json");
    const leagueId = await createLeagueViaUI(page, "E2E Setup Test League");

    // Should be on the league detail page
    await expect(page).toHaveURL(new RegExp(`/league/${leagueId}`));
    await expect(page.getByTestId("league-detail-page")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("E2E Setup Test League")).toBeVisible();
  });
});
