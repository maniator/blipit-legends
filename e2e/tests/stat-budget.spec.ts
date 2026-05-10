/**
 * Stat Budget — E2E tests for per-player stat cap validation.
 *
 * Covers:
 * 1. Generated defaults produce a savable team (no cap violations on fresh generate)
 * 2. Live stat counter is visible on player cards (lineup and pitchers section)
 * 3. Pitcher cards show only pitcher stats (velocity/control/movement), not hitter stats
 * 4. Save is blocked when a player manually exceeds the hitter cap
 * 5. Over-cap error message names the player and shows total / cap
 * 6. Mobile — stat counter is visible without horizontal scroll
 */
import { expect, test } from "@playwright/test";

import { resetAppState } from "../utils/helpers";

async function openCreateEditorWithDefaults(page: Parameters<typeof resetAppState>[0]) {
  await page.getByTestId("home-manage-teams-button").click();
  await expect(page.getByTestId("manage-teams-screen")).toBeVisible({ timeout: 10_000 });
  await page.getByTestId("manage-teams-create-button").click();
  await expect(page.getByTestId("custom-team-name-input")).toBeVisible({ timeout: 5_000 });
  await page.getByTestId("custom-team-regenerate-defaults-button").click();
  await expect(page.getByTestId("custom-team-name-input")).not.toHaveValue("", { timeout: 3_000 });
}

// ─── Generated defaults are savable ─────────────────────────────────────────

test.describe("Stat Budget — generated defaults are cap compliant", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  test("generated defaults produce a team that can be saved without cap violations", async ({
    page,
  }) => {
    await openCreateEditorWithDefaults(page);
    await page.getByTestId("custom-team-name-input").fill("Cap Compliant Team");
    await page.getByTestId("custom-team-save-button").click();
    // Should navigate away from editor without showing an over-cap error
    await expect(page.getByText("Cap Compliant Team")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("custom-team-editor-error-summary")).not.toBeVisible();
  });
});

// ─── Live stat counter ───────────────────────────────────────────────────────

test.describe("Stat Budget — live counter visibility", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  test("lineup player cards show a stat budget counter after Generate Defaults", async ({
    page,
  }) => {
    await openCreateEditorWithDefaults(page);
    const lineupSection = page.getByTestId("custom-team-lineup-section");
    await expect(lineupSection).toBeVisible({ timeout: 5_000 });
    await expect(lineupSection.getByText(/Total:/).first()).toBeVisible({ timeout: 3_000 });
  });

  test("pitcher cards show a stat budget counter after Generate Defaults", async ({ page }) => {
    await openCreateEditorWithDefaults(page);
    const pitchersSection = page.getByTestId("custom-team-pitchers-section");
    await expect(pitchersSection).toBeVisible({ timeout: 5_000 });
    await expect(pitchersSection.getByText(/Total:/).first()).toBeVisible({ timeout: 3_000 });
  });
});

// ─── Pitcher-only fields ─────────────────────────────────────────────────────

test.describe("Stat Budget — pitcher card shows only pitcher stats", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  test("pitcher cards show Velocity label and not Contact label", async ({ page }) => {
    await openCreateEditorWithDefaults(page);
    const pitchersSection = page.getByTestId("custom-team-pitchers-section");
    await expect(pitchersSection).toBeVisible({ timeout: 5_000 });
    await expect(pitchersSection.getByText("Velocity").first()).toBeVisible({ timeout: 3_000 });
    await expect(pitchersSection.getByText("Contact")).not.toBeVisible();
  });

  test("lineup player cards show Contact label and not Velocity label", async ({ page }) => {
    await openCreateEditorWithDefaults(page);
    const lineupSection = page.getByTestId("custom-team-lineup-section");
    await expect(lineupSection).toBeVisible({ timeout: 5_000 });
    await expect(lineupSection.getByText("Contact").first()).toBeVisible({ timeout: 3_000 });
    await expect(lineupSection.getByText("Velocity")).not.toBeVisible();
  });
});

// ─── Over-cap validation ─────────────────────────────────────────────────────

test.describe("Stat Budget — over-cap save blocking", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  test("save is blocked and error shown when a player is over the hitter stat cap", async ({
    page,
  }) => {
    await openCreateEditorWithDefaults(page);
    await page.getByTestId("custom-team-name-input").fill("Over Cap Team");
    // Rename the first lineup player and max their stats (contact + power + speed = 300 >> 150 cap)
    const lineupSection = page.getByTestId("custom-team-lineup-section");
    await lineupSection.locator('[aria-label="Player name"]').first().fill("Maxed Player");
    for (let i = 0; i < 3; i++) {
      await lineupSection.locator('input[type="range"]').nth(i).fill("100");
    }
    await page.getByTestId("custom-team-save-button").click();
    const errorSummary = page.getByTestId("custom-team-editor-error-summary");
    await expect(errorSummary).toBeVisible({ timeout: 3_000 });
    const text = await errorSummary.textContent();
    expect(text).toMatch(/over the stat cap/i);
    expect(text).toMatch(/\d+ \/ 150/);
  });

  test("over-cap error identifies the player by name", async ({ page }) => {
    await openCreateEditorWithDefaults(page);
    await page.getByTestId("custom-team-name-input").fill("Named Cap Team");
    // Name the first lineup player and max their stats
    const lineupSection = page.getByTestId("custom-team-lineup-section");
    await lineupSection.locator('[aria-label="Player name"]').first().fill("Homer Simpson");
    for (let i = 0; i < 3; i++) {
      await lineupSection.locator('input[type="range"]').nth(i).fill("100");
    }
    await page.getByTestId("custom-team-save-button").click();
    const errorSummary = page.getByTestId("custom-team-editor-error-summary");
    await expect(errorSummary).toBeVisible({ timeout: 10_000 });
    expect(await errorSummary.textContent()).toContain("Homer Simpson");
  });

  test("save error hint near Save/Cancel buttons is visible on over-cap failure", async ({
    page,
  }) => {
    await openCreateEditorWithDefaults(page);
    await page.getByTestId("custom-team-name-input").fill("Hint Check Team");
    const lineupSection = page.getByTestId("custom-team-lineup-section");
    for (let i = 0; i < 3; i++) {
      await lineupSection.locator('input[type="range"]').nth(i).fill("100");
    }
    await page.getByTestId("custom-team-save-button").click();
    await expect(page.getByTestId("custom-team-save-error-hint")).toBeVisible({ timeout: 10_000 });
  });
});

// ─── Mobile layout sanity ────────────────────────────────────────────────────

test.describe("Stat Budget — mobile layout sanity", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  test("stat counter is visible without horizontal overflow", async ({ page }) => {
    await openCreateEditorWithDefaults(page);
    const lineupSection = page.getByTestId("custom-team-lineup-section");
    await expect(lineupSection).toBeVisible({ timeout: 5_000 });
    const noHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    );
    expect(noHorizontalScroll).toBe(true);
    await expect(lineupSection.getByText(/Total:/).first()).toBeVisible({ timeout: 3_000 });
  });
});
