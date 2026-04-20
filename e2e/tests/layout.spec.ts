import { expect, type Page, test } from "@playwright/test";

import {
  disableAnimations,
  pauseGame,
  startGameViaPlayBall,
  waitForLogLines,
} from "../utils/helpers";

/**
 * Game-layout visual regression snapshots.
 *
 * Each test overrides the viewport to a specific size and captures the full
 * GameDiv so that responsive CSS changes are caught across the key layout
 * breakpoints:
 *
 *   - Mobile portrait  (390 × 844)
 *   - Tablet portrait  (820 × 1180)
 *   - Tablet landscape (1368 × 912)
 *   - Desktop          (1280 × 800)
 *   - Large desktop    (1728 × 1117)
 *
 * All tests are restricted to the "desktop" project to avoid multiplying CI
 * time — viewport behavior is independent of the Playwright browser device
 * preset.  The snapshots are named after the viewport so the filename clearly
 * identifies which layout is under test.
 *
 * Non-visual assertions verify:
 *  - The game container fills a large portion of the viewport width on
 *    tablet/desktop (no tiny centered island with huge black margins).
 *  - The field container is visible and has a non-trivial bounding box.
 *  - There is no horizontal page overflow.
 */

type Viewport = { width: number; height: number };

/**
 * Waits for the locator's bounding-box height to remain stable for
 * `stableChecks` consecutive polls spaced `intervalMs` apart.
 *
 * Heights are compared with a 1-pixel tolerance to avoid false instability
 * from sub-pixel rounding between polls.  Both `streak < stableChecks` and
 * `attempts < maxAttempts` are checked in the loop condition so the loop
 * exits cleanly on either termination.  Throws a clear error — including the
 * last measured height — if the element is not found or never becomes stable.
 */
async function waitForStableHeight(
  page: Page,
  selector: string,
  stableChecks = 4,
  intervalMs = 400,
  maxAttempts = 40,
): Promise<void> {
  let lastHeight = -1;
  let streak = 0;
  let attempts = 0;
  while (streak < stableChecks && attempts < maxAttempts) {
    attempts++;
    const box = await page.locator(selector).first().boundingBox();
    if (box === null || box.height <= 0) {
      throw new Error(`waitForStableHeight: element "${selector}" is not visible or has no height`);
    }
    const h = Math.round(box.height);
    if (Math.abs(h - lastHeight) <= 1) {
      streak++;
    } else {
      lastHeight = h;
      streak = 0;
    }
    await page.waitForTimeout(intervalMs);
  }
  if (streak < stableChecks) {
    throw new Error(
      `waitForStableHeight: layout did not stabilise for "${selector}" after ${maxAttempts} attempts (last height: ${lastHeight}px)`,
    );
  }
}

/**
 * Resize the page, start a game with a fixed seed, wait for the layout to
 * stabilize before taking screenshots.
 *
 * Order matters:
 * 1. setViewportSize — must happen before navigation (persists across it)
 * 2. startGameViaPlayBall — navigates to "/" and starts the game
 * 3. disableAnimations — must be called AFTER navigation (style tags are cleared on nav)
 * 4. waitForLogLines — wait for enough entries to fill the log panels
 * 5. waitForStableHeight — confirm the layout has stopped growing
 */
async function setupLayout(page: Page, viewport: Viewport): Promise<void> {
  await page.setViewportSize(viewport);
  await startGameViaPlayBall(page, { seed: "layout1" });
  await disableAnimations(page);
  // Wait for enough entries so AnnouncementsArea and HitLog fill to max-height.
  await waitForLogLines(page, 30, 90_000);
  await waitForStableHeight(page, "main");
  await pauseGame(page);
}

test.describe("Game layout snapshots", { tag: "@desktop-only" }, () => {
  test("game layout - mobile portrait (390×844)", async ({ page }) => {
    const vp: Viewport = { width: 390, height: 844 };
    await setupLayout(page, vp);

    const gameDiv = page.locator("main").first();
    await expect(gameDiv).toHaveScreenshot("game-layout-mobile-portrait.png", {
      maxDiffPixelRatio: 0.05,
    });

    // No horizontal overflow
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("game layout - tablet portrait (820×1180)", async ({ page }) => {
    const vp: Viewport = { width: 820, height: 1180 };
    await setupLayout(page, vp);

    const gameDiv = page.locator("main").first();
    await expect(gameDiv).toHaveScreenshot("game-layout-tablet-portrait.png", {
      maxDiffPixelRatio: 0.05,
    });

    // Container should use most of the viewport width (>= 75%)
    const box = await gameDiv.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(vp.width * 0.75);

    // Field should be visible and substantially sized
    const field = page.getByTestId("field-view");
    const fieldBox = await field.boundingBox();
    expect(fieldBox).not.toBeNull();
    expect(fieldBox!.height).toBeGreaterThan(300);

    // No horizontal overflow
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("game layout - tablet landscape (1368×912)", async ({ page }) => {
    const vp: Viewport = { width: 1368, height: 912 };
    await setupLayout(page, vp);

    const gameDiv = page.locator("main").first();
    await expect(gameDiv).toHaveScreenshot("game-layout-tablet-landscape.png", {
      maxDiffPixelRatio: 0.05,
    });

    // Container should use most of the viewport width (>= 85%)
    const box = await gameDiv.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(vp.width * 0.85);

    // Field should be substantially sized on a large viewport
    const field = page.getByTestId("field-view");
    const fieldBox = await field.boundingBox();
    expect(fieldBox).not.toBeNull();
    expect(fieldBox!.height).toBeGreaterThan(350);

    // No horizontal overflow
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("game layout - desktop (1280×800)", async ({ page }) => {
    const vp: Viewport = { width: 1280, height: 800 };
    await setupLayout(page, vp);

    const gameDiv = page.locator("main").first();
    await expect(gameDiv).toHaveScreenshot("game-layout-desktop.png", {
      maxDiffPixelRatio: 0.05,
    });

    // Container should use most of the viewport width (>= 85%)
    const box = await gameDiv.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(vp.width * 0.85);

    // Field should be substantially sized
    const field = page.getByTestId("field-view");
    const fieldBox = await field.boundingBox();
    expect(fieldBox).not.toBeNull();
    expect(fieldBox!.height).toBeGreaterThan(350);

    // No horizontal overflow
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("game layout - large desktop (1728×1117)", async ({ page }) => {
    const vp: Viewport = { width: 1728, height: 1117 };
    await setupLayout(page, vp);

    const gameDiv = page.locator("main").first();
    await expect(gameDiv).toHaveScreenshot("game-layout-large-desktop.png", {
      maxDiffPixelRatio: 0.05,
    });

    // Container should use most of the viewport width (>= 85%)
    const box = await gameDiv.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(vp.width * 0.85);

    // Field should be the largest of all viewports (max cap of ~560 px)
    const field = page.getByTestId("field-view");
    const fieldBox = await field.boundingBox();
    expect(fieldBox).not.toBeNull();
    expect(fieldBox!.height).toBeGreaterThan(400);

    // No horizontal overflow
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
