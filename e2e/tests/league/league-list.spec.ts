/**
 * League List Page — E2E tests
 *
 * Covers:
 * - Empty state renders "No active leagues" when no leagues exist
 * - "Create New League" header button navigates to /league/new
 * - "Create League" button inside empty-state CTA also navigates to /league/new
 * - Back button returns to home screen
 * - League list shows a created league with a View link
 * - Visual snapshot of the empty state
 *
 * All tests run desktop-only (@desktop-only tag) — league list layout is
 * viewport-independent and running one project keeps CI time reasonable.
 */

import { expect, test } from "@playwright/test";

import { disableAnimations, importTeamsFixture, resetAppState } from "../../utils/helpers";
import { createLeagueViaUI } from "./helpers";

test.describe("League List Page", { tag: "@desktop-only" }, () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  // ── Empty state ─────────────────────────────────────────────────────────────

  test("shows empty state when no leagues exist", async ({ page }) => {
    await page.goto("/league");
    await expect(page.getByTestId("league-list-page")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("league-list-empty")).toBeVisible({ timeout: 10_000 });
    // CTA button inside empty state
    await expect(page.getByTestId("create-league-empty-button")).toBeVisible();
  });

  // ── Navigation from empty state ─────────────────────────────────────────────

  test("header Create New League button navigates to setup page", async ({ page }) => {
    await page.goto("/league");
    await expect(page.getByTestId("league-list-page")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("create-league-button").click();
    await expect(page).toHaveURL(/\/league\/new/);
    await expect(page.getByTestId("league-setup-page")).toBeVisible({ timeout: 10_000 });
  });

  test("empty-state Create League CTA navigates to setup page", async ({ page }) => {
    await page.goto("/league");
    await expect(page.getByTestId("league-list-empty")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("create-league-empty-button").click();
    await expect(page).toHaveURL(/\/league\/new/);
    await expect(page.getByTestId("league-setup-page")).toBeVisible({ timeout: 10_000 });
  });

  // ── Back navigation ─────────────────────────────────────────────────────────

  test("back button returns to home screen", async ({ page }) => {
    await page.goto("/league");
    await expect(page.getByTestId("league-list-page")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("league-list-back-button").click();
    await expect(page).toHaveURL("/");
    await expect(page.getByTestId("home-screen")).toBeVisible({ timeout: 10_000 });
  });

  // ── League list with entries ─────────────────────────────────────────────────

  test("shows created league in list with a View link", async ({ page }) => {
    // Import teams, then create a league via SPA navigation helper
    await importTeamsFixture(page, "fixture-teams.json");
    const leagueId = await createLeagueViaUI(page, "E2E List Test League");

    // Navigate to league list
    await page.goto("/league");
    await expect(page.getByTestId("league-list-page")).toBeVisible({ timeout: 15_000 });
    // Empty state must NOT be shown
    await expect(page.getByTestId("league-list-empty")).not.toBeVisible();
    // The league list should render
    await expect(page.getByTestId("league-list")).toBeVisible();
    // A View link for our league should exist
    await expect(page.getByTestId(`league-view-link-${leagueId}`)).toBeVisible();
  });

  // ── Visual snapshot ──────────────────────────────────────────────────────────

  test("visual snapshot — empty state", async ({ page }) => {
    await page.goto("/league");
    await expect(page.getByTestId("league-list-page")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("league-list-empty")).toBeVisible({ timeout: 10_000 });
    await disableAnimations(page);

    await expect(page.getByTestId("league-list-page")).toHaveScreenshot("league-list-empty.png", {
      maxDiffPixelRatio: 0.05,
    });
  });
});
