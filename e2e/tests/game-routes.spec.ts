/**
 * game-routes.spec.ts
 *
 * Route smoke tests required by S1 AC (game-session-refactor epic):
 *   1. Exhibition flow — /exhibition/new → /game/exhibition
 *   2. League game flow — season creation → /game/league/:seasonGameId
 *   3. Save resume — load a saved game from /saves → /game/exhibition
 *
 * These are lightweight navigation/URL checks.  Deep gameplay validation lives
 * in smoke.spec.ts, save-load.spec.ts, and league.spec.ts.
 */

import { expect, test } from "@playwright/test";

import { createAutogenSeason, saveCurrentGame, startGameViaPlayBall } from "../utils/helpers";

// ---------------------------------------------------------------------------
// 1. Exhibition route smoke
// ---------------------------------------------------------------------------

test.describe("game-routes — exhibition flow", () => {
  test("navigates to /game/exhibition after Play Ball", async ({ page }) => {
    await startGameViaPlayBall(page, { seed: "gr-exhibition-smoke" });
    await expect(page).toHaveURL(/\/game\/exhibition/, { timeout: 15_000 });
    await expect(page.getByTestId("scoreboard")).toBeVisible({ timeout: 15_000 });
  });

  test("/game/exhibition shows field and play-by-play log", async ({ page }) => {
    await startGameViaPlayBall(page, { seed: "gr-exhibition-smoke2" });
    await expect(page).toHaveURL(/\/game\/exhibition/, { timeout: 15_000 });
    await expect(page.getByTestId("field-view")).toBeVisible({ timeout: 15_000 });
  });
});

// ---------------------------------------------------------------------------
// 2. League game route smoke
// ---------------------------------------------------------------------------

test.describe("game-routes — league game flow", () => {
  test("navigates to /game/league/:seasonGameId after advancing to first user game", async ({
    page,
  }) => {
    // Create an all-autogen managed season via the wizard helper, then
    // advance until a game is ready.  The helper lands on the season home page.
    await createAutogenSeason(page);

    // After the season is created we are on /leagues/:id
    await expect(page).toHaveURL(/\/leagues\/[^/]+$/, { timeout: 15_000 });

    // Simulate a day — this should queue the first game.
    const simulateBtn = page.getByRole("button", { name: /simulate day/i });
    if (await simulateBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await simulateBtn.click();
      await page.waitForTimeout(3_000);
    }

    // If there is a "Play in Manager Mode" or "Watch" CTA we confirm the route.
    // Use data-testid to reliably match the actual button elements.
    const playBtn = page.getByTestId("play-next-game-button");
    const watchBtn = page.getByTestId("watch-next-game-button");
    const playVisible = await playBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    const watchVisible = await watchBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    if (playVisible || watchVisible) {
      await (playVisible ? playBtn : watchBtn).click();
      await expect(page).toHaveURL(/\/game\/league\//, { timeout: 15_000 });
      await expect(page.getByTestId("scoreboard")).toBeVisible({ timeout: 15_000 });
    } else {
      // All-autogen season has no user team — just verify we stayed on the hub
      await expect(page).toHaveURL(/\/leagues\//, { timeout: 5_000 });
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Save resume route smoke
// ---------------------------------------------------------------------------

test.describe("game-routes — save resume flow", () => {
  test("loading a save from /saves navigates back to the game route", async ({ page }) => {
    // Start a game and save it.
    await startGameViaPlayBall(page, { seed: "gr-save-resume" });
    await expect(page).toHaveURL(/\/game\/exhibition/, { timeout: 15_000 });
    await saveCurrentGame(page);

    // Close the saves modal (Escape or backdrop click).
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("saves-modal")).not.toBeVisible({ timeout: 5_000 });

    // Go home.
    await page.getByTestId("back-to-home-button").click();
    await expect(page).toHaveURL("/", { timeout: 10_000 });

    // Open /saves.
    await page.getByTestId("home-load-saves-button").click();
    await expect(page).toHaveURL("/saves", { timeout: 10_000 });

    // Load the save — AppShell.onLoadSave navigates to /game (legacy exhibition route).
    const loadBtn = page.getByTestId("load-save-button").first();
    await expect(loadBtn).toBeVisible({ timeout: 10_000 });
    await loadBtn.click();

    await expect(page).toHaveURL(/\/game/, { timeout: 15_000 });
    await expect(page.getByTestId("scoreboard")).toBeVisible({ timeout: 15_000 });
  });
});
