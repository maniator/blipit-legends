import { expect, test } from "@playwright/test";

import {
  disableAnimations,
  resetAppState,
  startGameViaPlayBall,
  waitForNewGameDialog,
} from "../../utils/helpers";

/**
 * Visual regression snapshots — run across all 6 non-determinism viewport projects
 * (desktop, tablet, iphone-15-pro-max, iphone-15, pixel-7, pixel-5).
 * Captures home screen, dialog/modal screens, and the new route pages
 * (/help, /saves, /teams/new).
 */
test.describe("Visual", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
    await disableAnimations(page);
  });

  test("Home screen screenshot", async ({ page }) => {
    await expect(page.getByTestId("home-screen")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("home-screen")).toHaveScreenshot("home-screen.png", {
      maxDiffPixelRatio: 0.05,
    });
  });

  test("Exhibition Setup page screenshot", async ({ page }) => {
    await waitForNewGameDialog(page);
    await expect(page.getByTestId("exhibition-setup-page")).toHaveScreenshot(
      "new-game-dialog.png",
      {
        mask: [page.getByTestId("seed-input")],
        maxDiffPixelRatio: 0.05,
      },
    );
  });

  /**
   * How to Play modal — default state.
   *
   * Starts a game to reach the /game route where the "How to Play" button
   * lives (inside GameControls). The "Basics" section is open by default;
   * all other sections are collapsed.
   */
  test("How to Play modal default state screenshot", async ({ page }) => {
    // Start a game so we're on /game where the How to Play button is available.
    await startGameViaPlayBall(page, { seed: "howtoplay1" });
    await page.getByRole("button", { name: /how to play/i }).click();
    await expect(page.getByTestId("instructions-modal")).toBeVisible();
    await expect(page.getByTestId("instructions-modal")).toHaveScreenshot(
      "instructions-modal-default.png",
      { maxDiffPixelRatio: 0.05 },
    );
  });

  /**
   * How to Play modal — all accordion sections expanded.
   *
   * Desktop-only to keep CI time reasonable; the accordion layout is the
   * same across all viewports.  We programmatically open every closed
   * <details> element and then wait until all 9 sections are structurally
   * open before snapshotting.
   */
  test(
    "How to Play modal all sections expanded screenshot",
    { tag: "@desktop-only" },
    async ({ page }) => {
      // Start a game to reach /game where the How to Play button is available.
      await startGameViaPlayBall(page, { seed: "howtoplay2" });
      await page.getByRole("button", { name: /how to play/i }).click();
      await expect(page.getByTestId("instructions-modal")).toBeVisible();
      // Use Playwright clicks (correct screen coordinates) so the dialog's
      // outside-click handler doesn't close it due to clientX/Y = 0.
      const closedSummaries = page.locator(
        '[data-testid="instructions-modal"] details:not([open]) > summary',
      );
      while ((await closedSummaries.count()) > 0) {
        await closedSummaries.first().click();
      }
      // Wait until all 10 sections are structurally open before snapshotting.
      await expect(page.locator('[data-testid="instructions-modal"] details[open]')).toHaveCount(
        10,
      );
      await expect(page.getByTestId("instructions-modal")).toHaveScreenshot(
        "instructions-modal-all-sections.png",
        { maxDiffPixelRatio: 0.05 },
      );
    },
  );
});

// ─── Help page (/help) ─────────────────────────────────────────────────────
/**
 * Help page — reachable via "How to Play" link on Home.
 * Desktop-only: the page is a styled scrollable list; one baseline
 * is sufficient to catch copy regressions and layout changes.
 */
test.describe("Visual — Help page", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
    await disableAnimations(page);
  });

  test("help page screenshot (desktop)", { tag: "@desktop-only" }, async ({ page }) => {
    await page.getByTestId("home-help-button").click();
    await expect(page.getByTestId("help-page")).toBeVisible({ timeout: 10_000 });

    await expect(page.getByTestId("help-page")).toHaveScreenshot("help-page.png", {
      maxDiffPixelRatio: 0.05,
    });
  });

  /**
   * iphone-15 representative: confirms the help page is readable and
   * the Back button is not obscured on narrow viewports.
   */
  test("help page screenshot (iphone-15)", { tag: "@iphone-15-only" }, async ({ page }) => {
    await page.getByTestId("home-help-button").click();
    await expect(page.getByTestId("help-page")).toBeVisible({ timeout: 10_000 });

    await expect(page.getByTestId("help-page")).toHaveScreenshot("help-page-mobile.png", {
      maxDiffPixelRatio: 0.05,
    });
  });

  /**
   * Mobile regression snapshot — all accordion sections expanded on iphone-15.
   *
   * This captures the state that previously caused all sections to be squished
   * into a fixed 100dvh container with no scrolling.  After expanding all
   * sections, the test snapshots the help page at the initial scroll position
   * (top of the page) to validate that content can expand and that the layout
   * remains readable on a narrow viewport.
   *
   * Visual diff failures here most likely indicate a CSS regression in
   * PageContainer mobile styles (flex-shrink / overflow-y).
   */
  test(
    "help page all sections expanded screenshot (iphone-15)",
    { tag: "@iphone-15-only" },
    async ({ page }) => {
      await page.getByTestId("home-help-button").click();
      await expect(page.getByTestId("help-page")).toBeVisible({ timeout: 10_000 });

      // Expand every closed section.
      const closedSummaries = page.locator(
        '[data-testid="help-page"] details:not([open]) > summary',
      );
      while ((await closedSummaries.count()) > 0) {
        await closedSummaries.first().click();
      }
      await expect(page.locator('[data-testid="help-page"] details[open]')).toHaveCount(10);

      // Snapshot at the initial scroll position (top of page).
      await expect(page.getByTestId("help-page")).toHaveScreenshot(
        "help-page-mobile-all-sections.png",
        { maxDiffPixelRatio: 0.05 },
      );
    },
  );
});

// ─── Saves page (/saves) ──────────────────────────────────────────────────
/**
 * Exhibition Saves page — reachable via "Load Saved Game" on Home.
 * Captures the empty-state and the back-button layout.
 * Desktop-only: one baseline is sufficient for a simple list page.
 */
test.describe("Visual — Saves page", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
    await disableAnimations(page);
  });

  test(
    "saves page empty state screenshot (desktop)",
    { tag: "@desktop-only" },
    async ({ page }) => {
      await page.getByTestId("home-load-saves-button").click();
      await expect(page.getByTestId("saves-page")).toBeVisible({ timeout: 10_000 });
      // Wait for loading indicator to clear
      await expect(page.getByText("Loading saves…")).not.toBeVisible({ timeout: 5_000 });

      await expect(page.getByTestId("saves-page")).toHaveScreenshot("saves-page-empty.png", {
        maxDiffPixelRatio: 0.05,
      });
    },
  );

  /**
   * iphone-15 representative: confirms the page header and back button
   * fit without overflow on narrow viewports.
   */
  test(
    "saves page empty state screenshot (iphone-15)",
    { tag: "@iphone-15-only" },
    async ({ page }) => {
      await page.getByTestId("home-load-saves-button").click();
      await expect(page.getByTestId("saves-page")).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText("Loading saves…")).not.toBeVisible({ timeout: 5_000 });

      await expect(page.getByTestId("saves-page")).toHaveScreenshot("saves-page-empty-mobile.png", {
        maxDiffPixelRatio: 0.05,
      });
    },
  );
});

// ─── Home page — League Mode button ──────────────────────────────────────────
/**
 * Desktop-only snapshot that captures the home screen with the League Mode
 * button, confirming it appears in the main menu.
 */
test.describe("Visual — Home League Mode button", { tag: "@desktop-only" }, () => {
  test("home screen with league mode button (desktop)", async ({ page }) => {
    await resetAppState(page);
    await disableAnimations(page);
    await expect(page.getByTestId("home-screen")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("home-league-button")).toBeVisible();
    await expect(page.getByTestId("home-screen")).toHaveScreenshot("home-league-button.png", {
      maxDiffPixelRatio: 0.05,
    });
  });
});

// ─── New Game — seed auto-regenerated ────────────────────────────────────────
/**
 * Desktop-only snapshot of the New Game setup page with the seed field
 * pre-populated by the auto-generation on mount.  The seed value itself is
 * masked (it changes every run) but the field must be non-empty.
 */
test.describe("Visual — New Game seed auto-generated", { tag: "@desktop-only" }, () => {
  test("New Game page with auto-generated seed (desktop)", async ({ page }) => {
    await resetAppState(page);
    await disableAnimations(page);
    await waitForNewGameDialog(page);
    // Verify seed is populated before snapshotting
    const seedInput = page.getByTestId("seed-input");
    await expect(seedInput).not.toHaveValue("");
    await expect(page.getByTestId("exhibition-setup-page")).toHaveScreenshot(
      "new-game-seed-autogenerated.png",
      {
        mask: [seedInput],
        maxDiffPixelRatio: 0.05,
      },
    );
  });
});
