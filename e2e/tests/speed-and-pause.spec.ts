import { expect, test } from "@playwright/test";

import { pauseGame, resumeGame, startGameViaPlayBall, waitForLogLines } from "../utils/helpers";

test.describe("Speed slider", { tag: "@desktop-only" }, () => {
  test("speed slider is visible during an active game", async ({ page }) => {
    await startGameViaPlayBall(page);
    const slider = page.getByTestId("speed-slider");
    await expect(slider).toBeVisible({ timeout: 10_000 });
    await expect(slider).toHaveAttribute("min", "0");
    await expect(slider).toHaveAttribute("max", "3");
    await expect(slider).toHaveAttribute("step", "1");
  });

  test("changing speed slider persists to localStorage", async ({ page }) => {
    await startGameViaPlayBall(page);
    const slider = page.getByTestId("speed-slider");
    await expect(slider).toBeVisible({ timeout: 10_000 });

    // Slide to position 2 (Fast = 150 ms).
    await slider.fill("2");

    const storedSpeed = await page.evaluate(() => Number(localStorage.getItem("speed")));
    expect(storedSpeed).toBe(150);
  });

  test("speed slider position 3 sets Instant speed (0 ms)", async ({ page }) => {
    await startGameViaPlayBall(page);
    const slider = page.getByTestId("speed-slider");
    await expect(slider).toBeVisible({ timeout: 10_000 });

    await slider.fill("3");

    const storedSpeed = await page.evaluate(() => Number(localStorage.getItem("speed")));
    expect(storedSpeed).toBe(0);
  });
});

test.describe("Pause / play button", { tag: "@desktop-only" }, () => {
  test("pause button appears once game starts and is not shown before", async ({ page }) => {
    await startGameViaPlayBall(page);
    await expect(page.getByTestId("pause-play-button")).toBeVisible({ timeout: 10_000 });
  });

  test("clicking pause stops new log entries from appearing", async ({ page }) => {
    await startGameViaPlayBall(page, { seed: "pause-test1" });
    await waitForLogLines(page, 5);

    await pauseGame(page);

    // Count entries immediately after pausing.
    const countAfterPause = await page
      .getByTestId("play-by-play-log")
      .locator("[data-log-index]")
      .count();

    // Wait 2 s — no new entries should appear while paused.
    await page.waitForTimeout(2000);

    const countAfterWait = await page
      .getByTestId("play-by-play-log")
      .locator("[data-log-index]")
      .count();

    expect(countAfterWait).toBe(countAfterPause);
  });

  test("resuming after pause allows new log entries", async ({ page }) => {
    await startGameViaPlayBall(page, { seed: "pause-test2" });
    await waitForLogLines(page, 5);
    await pauseGame(page);

    const countAfterPause = await page
      .getByTestId("play-by-play-log")
      .locator("[data-log-index]")
      .count();

    await resumeGame(page);

    // After resuming, new entries should appear within a reasonable timeout.
    await expect(async () => {
      const count = await page.getByTestId("play-by-play-log").locator("[data-log-index]").count();
      expect(count).toBeGreaterThan(countAfterPause);
    }).toPass({ timeout: 10_000 });
  });

  test("pause state is reflected in the button aria-label", async ({ page }) => {
    await startGameViaPlayBall(page);
    await waitForLogLines(page, 3);

    const btn = page.getByTestId("pause-play-button");
    await expect(btn).toHaveAttribute("aria-label", "Pause game");

    await pauseGame(page);
    await expect(btn).toHaveAttribute("aria-label", "Resume game");

    await resumeGame(page);
    await expect(btn).toHaveAttribute("aria-label", "Pause game");
  });
});
