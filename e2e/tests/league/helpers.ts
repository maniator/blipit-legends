/**
 * Shared helpers for league E2E tests.
 */

import { expect, type Page } from "@playwright/test";

/**
 * Creates a league via the UI and returns the new league's ID.
 *
 * Prerequisites:
 *   - `importTeamsFixture(page, "fixture-teams.json")` must already be called
 *     so the custom teams "Visitors" and "Locals" exist in IndexedDB.
 *   - After `importTeamsFixture`, the page should be at `/` (home screen).
 *
 * This helper navigates WITHIN the app (SPA clicks) rather than using
 * `page.goto("/league/new")` to avoid a full-page reload that can race with
 * IndexedDB persistence of the just-imported teams.
 *
 * Steps:
 *   1. Click the Leagues nav item → /league
 *   2. Click "Create New League" → /league/new
 *   3. Fill league name
 *   4. Select both available fixture teams (Visitors + Locals)
 *   5. Click "Start League"
 *   6. Wait for navigation to /league/:id
 *   7. Return the extracted league ID
 */
export async function createLeagueViaUI(page: Page, leagueName: string): Promise<string> {
  // Navigate into the league section via SPA link (avoids full-page reload
  // that could race with IndexedDB flush of just-imported teams).
  await expect(page.getByTestId("home-screen")).toBeVisible({ timeout: 10_000 });
  await page.getByTestId("home-league-button").click();
  await expect(page).toHaveURL(/\/league/, { timeout: 10_000 });
  await expect(page.getByTestId("league-list-page")).toBeVisible({ timeout: 10_000 });

  // Click the "Create New League" header button
  await page.getByTestId("create-league-button").click();
  await expect(page).toHaveURL(/\/league\/new/, { timeout: 10_000 });
  await expect(page.getByTestId("league-setup-page")).toBeVisible({ timeout: 10_000 });

  // Fill league name
  await page.getByTestId("league-name-input").fill(leagueName);

  // Wait for the MultiSelect to be populated (teams load asynchronously)
  await expect(page.getByTestId("league-teams-select")).toBeVisible({ timeout: 15_000 });

  // Select both fixture teams by label
  await page.getByTestId("league-teams-select").selectOption([
    { label: "Visitors" },
    { label: "Locals" },
  ]);

  // Submit the form
  await page.getByTestId("start-league-button").click();

  // Wait for navigation to the detail page
  await expect(page).toHaveURL(/\/league\/[^/]+$/, { timeout: 20_000 });
  await expect(page.getByTestId("league-detail-page")).toBeVisible({ timeout: 15_000 });

  // Extract the league ID from the URL
  const url = page.url();
  const match = url.match(/\/league\/([^/]+)$/);
  if (!match) {
    throw new Error(`Could not extract league ID from URL: ${url}`);
  }
  return match[1];
}
