/**
 * Phase 5A — League Mode E2E tests.
 *
 * Covers the core league happy path and key UI states:
 * - Navigation from Home to the league list page
 * - Empty state when no leagues exist
 * - Navigation to the league setup page
 * - Validation error when starting a league with no teams selected
 * - Not-found state for an invalid league ID
 * - Back-button navigation from the list and setup pages
 *
 * These tests are scoped to the desktop project (`@desktop-only`) to keep
 * CI time reasonable; league routing behaviour is viewport-independent.
 */

import { expect, test } from "@playwright/test";

import { resetAppState } from "../utils/helpers";

test.describe("League Mode", { tag: "@desktop-only" }, () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  // ── Navigation ──────────────────────────────────────────────────────────────

  test("navigates to league list from home", async ({ page }) => {
    await page.getByTestId("home-league-button").click();
    await expect(page).toHaveURL(/\/league/);
    await expect(page.getByTestId("league-list-page")).toBeVisible({ timeout: 10_000 });
    // Home screen should no longer be visible
    await expect(page.getByTestId("home-screen")).not.toBeVisible();
  });

  // ── League list page ─────────────────────────────────────────────────────────

  test("shows empty state when no leagues exist", async ({ page }) => {
    await page.goto("/league");
    await expect(page.getByTestId("league-list-page")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("league-list-empty")).toBeVisible({ timeout: 10_000 });
  });

  test("navigates to setup page from list", async ({ page }) => {
    await page.goto("/league");
    await expect(page.getByTestId("league-list-page")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("create-league-button").click();
    await expect(page).toHaveURL(/\/league\/new/);
    await expect(page.getByTestId("league-setup-page")).toBeVisible({ timeout: 10_000 });
  });

  // ── League setup page ────────────────────────────────────────────────────────

  test("shows validation error when no teams selected", async ({ page }) => {
    await page.goto("/league/new");
    await expect(page.getByTestId("league-setup-page")).toBeVisible({ timeout: 15_000 });
    // Fill in the league name but do not select any teams
    await page.getByTestId("league-name-input").fill("Test League");
    await page.getByTestId("start-league-button").click();
    await expect(page.getByTestId("league-setup-validation-error")).toBeVisible({
      timeout: 10_000,
    });
  });

  // ── League detail page ───────────────────────────────────────────────────────

  test("shows not found when league id is invalid", async ({ page }) => {
    await page.goto("/league/nonexistent-id");
    // Either data-testid works — accommodate both possible implementations
    const notFound = page
      .getByTestId("league-not-found")
      .or(page.getByTestId("league-detail-error"));
    await expect(notFound).toBeVisible({ timeout: 15_000 });
  });

  // ── Back navigation ──────────────────────────────────────────────────────────

  test("back button from league list goes home", async ({ page }) => {
    await page.goto("/league");
    await expect(page.getByTestId("league-list-page")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("league-list-back-button").click();
    await expect(page).toHaveURL("/");
    await expect(page.getByTestId("home-screen")).toBeVisible({ timeout: 10_000 });
  });

  test("back button from setup page goes home", async ({ page }) => {
    await page.goto("/league/new");
    await expect(page.getByTestId("league-setup-page")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("league-setup-back-button").click();
    await expect(page).toHaveURL("/");
    await expect(page.getByTestId("home-screen")).toBeVisible({ timeout: 10_000 });
  });
});
