import { expect, type Locator, type Page, test } from "@playwright/test";
import path from "path";

import {
  loadFixture,
  resetAppState,
  startGameViaPlayBall,
  waitForLogLines,
} from "../utils/helpers";

/**
 * Player Stats Panel E2E tests.
 *
 * These tests are intentionally kept on a single project (desktop) for the
 * time-sensitive "RBI values after scoring" test, but the fast structural
 * tests run on all viewports.
 */

/** Returns the RBI cell text contents for the currently-active tab. */
async function getActiveTabRbiTexts(statsPanel: Locator): Promise<string[]> {
  return statsPanel.locator("tbody tr td:last-child").allTextContents();
}

/**
 * Clicks the home-team tab (on the global TeamTabBar in the log panel),
 * reads its RBI cells from the stats panel, then restores the away tab.
 * Returns the combined [away…, home…] RBI text values.
 *
 * Uses the stable `data-testid` attributes on the global tab buttons
 * (`team-tab-away` / `team-tab-home`) that live in the shared TeamTabBar
 * above the stats panel in the log panel.
 */
async function getBothTabsRbi(page: Page, statsPanel: Locator): Promise<string[]> {
  const awayTexts = await getActiveTabRbiTexts(statsPanel);
  await page.getByTestId("team-tab-home").click();
  const homeTexts = await getActiveTabRbiTexts(statsPanel);
  await page.getByTestId("team-tab-away").click();
  return [...awayTexts, ...homeTexts];
}

test.describe("Player Stats Panel — structure", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  test("batting stats table has RBI column header", async ({ page }) => {
    await startGameViaPlayBall(page, { seed: "statsrbi1" });
    const statsPanel = page.getByTestId("player-stats-panel");
    await expect(statsPanel).toBeVisible({ timeout: 10_000 });
    // The RBI column header must appear in the thead
    await expect(statsPanel.getByRole("columnheader", { name: "RBI" })).toBeVisible();
  });

  test("PlayerStatsPanel is ordered before HitLog in the log panel", async ({ page }) => {
    await startGameViaPlayBall(page, { seed: "statsorder1" });
    // Both elements must be present before checking order.
    // hit-log renders when not collapsed (default); player-stats-panel is always visible.
    await expect(page.getByTestId("player-stats-panel")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("hit-log")).toBeVisible({ timeout: 10_000 });

    // Verify DOM order: player-stats-panel precedes hit-log in document order.
    // Node.DOCUMENT_POSITION_FOLLOWING (4) means the second argument comes
    // AFTER the first in tree order.
    const statsFirst = await page.evaluate(() => {
      const stats = document.querySelector('[data-testid="player-stats-panel"]');
      const hitLog = document.querySelector('[data-testid="hit-log"]');
      if (!stats || !hitLog) return false;
      return !!(stats.compareDocumentPosition(hitLog) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    expect(statsFirst).toBe(true);
  });

  test("stats table shows AB, H, BB, K and RBI columns", async ({ page }) => {
    await startGameViaPlayBall(page, { seed: "statsrbi2" });
    const statsPanel = page.getByTestId("player-stats-panel");
    await expect(statsPanel).toBeVisible({ timeout: 10_000 });
    const headers = ["AB", "H", "BB", "K", "RBI"];
    for (const h of headers) {
      await expect(statsPanel.getByRole("columnheader", { name: h })).toBeVisible();
    }
  });
});

test.describe("Player Stats Panel — RBI values (desktop only)", { tag: "@desktop-only" }, () => {
  test("RBI values update after a scoring play", async ({ page }) => {
    // Restrict to desktop to keep CI runtime lean.
    // Load a fixture that already has playLog entries with rbi>0 — no need to
    // wait for autoplay to reach a scoring play.
    await loadFixture(page, "mid-game-with-rbi.json");

    const statsPanel = page.getByTestId("player-stats-panel");
    await expect(statsPanel).toBeVisible({ timeout: 10_000 });

    // At least one team must have a non-zero RBI cell.
    const allRbi = await getBothTabsRbi(page, statsPanel);
    expect(allRbi.some((t) => t !== "–" && t.trim() !== "")).toBe(true);
  });

  test("RBI stats are preserved after save and reload", async ({ page }) => {
    // Load fixture that already has RBI values — no autoplay wait needed.
    await loadFixture(page, "mid-game-with-rbi.json");

    const statsPanel = page.getByTestId("player-stats-panel");
    await expect(statsPanel).toBeVisible({ timeout: 10_000 });

    // Confirm RBI values are present before saving.
    const rbiBeforeSave = await getBothTabsRbi(page, statsPanel);
    expect(rbiBeforeSave.some((t) => t !== "–")).toBe(true);

    // Save the game.
    await page.getByTestId("saves-button").click();
    await expect(page.getByTestId("saves-modal")).toBeVisible({ timeout: 10_000 });
    await page.getByTestId("save-game-button").click();
    await expect(page.getByTestId("load-save-button").first()).toBeVisible({ timeout: 10_000 });

    // Load the saved game back.
    await page.getByTestId("load-save-button").first().click();
    await expect(page.getByTestId("saves-modal")).not.toBeVisible({ timeout: 10_000 });

    // RBI values must still be non-zero after reload.
    const rbiAfterLoad = await getBothTabsRbi(page, statsPanel);
    expect(rbiAfterLoad.some((t) => t !== "–" && t.trim() !== "")).toBe(true);
  });

  test("imported old save (no rbi field) loads without errors and shows stats", async ({
    page,
  }) => {
    await resetAppState(page);
    await startGameViaPlayBall(page, { seed: "importrbi" });
    await waitForLogLines(page, 3);

    // Import the sample fixture (has empty playLog — no rbi fields).
    // Auto-load closes the modal and activates the game immediately.
    const fixturePath = path.resolve(__dirname, "../fixtures/sample-save.json");
    await page.getByTestId("saves-button").click();
    await expect(page.getByTestId("saves-modal")).toBeVisible({ timeout: 10_000 });
    await page.getByTestId("import-save-file-input").setInputFiles(fixturePath);
    await expect(page.getByTestId("saves-modal")).not.toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("scoreboard")).toBeVisible({ timeout: 10_000 });

    // Stats panel must be visible and show RBI column (empty playLog → all "–").
    const statsPanel = page.getByTestId("player-stats-panel");
    await expect(statsPanel).toBeVisible({ timeout: 10_000 });
    await expect(statsPanel.getByRole("columnheader", { name: "RBI" })).toBeVisible();
    // With an empty playLog all computed RBI values remain 0, so every RBI cell renders as "–".
    const rbiCells = statsPanel.locator("tbody tr td:last-child");
    const texts = await rbiCells.allTextContents();
    expect(texts.every((t) => t === "–")).toBe(true);
  });
});
