/**
 * Stage 4A routing integration tests.
 *
 * Covers the new react-router-based navigation:
 * - Home → /exhibition/new page (primary New Game path)
 * - Exhibition Setup defaults to Custom Teams tab
 * - Home ↔ Game ↔ Resume Current Game
 * - Home → /saves page (Load Saved Game path)
 * - Home → /help page (How to Play path)
 * - Teams URL routes: /teams/new, /teams/:id/edit
 * - Autoplay pauses when navigating away from /game
 * - Deep-link unknown paths redirect to Home
 */

import { expect, test } from "@playwright/test";

import {
  resetAppState,
  saveCurrentGame,
  startGameViaPlayBall,
  waitForLogLines,
} from "../utils/helpers";

test.describe("Routing — exhibition setup page", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  test("Home → New Game navigates to /exhibition/new", async ({ page }) => {
    await page.getByTestId("home-new-game-button").click();
    await expect(page).toHaveURL(/\/exhibition\/new/);
    await expect(page.getByTestId("exhibition-setup-page")).toBeVisible({ timeout: 10_000 });
  });

  test("Exhibition Setup shows custom-teams layout with Play Ball button", async ({ page }) => {
    await page.getByTestId("home-new-game-button").click();
    await expect(page.getByTestId("exhibition-setup-page")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("play-ball-button")).toBeVisible();
  });

  test("Exhibition Setup back button returns to Home (/)", async ({ page }) => {
    await page.getByTestId("home-new-game-button").click();
    await expect(page.getByTestId("exhibition-setup-page")).toBeVisible({ timeout: 10_000 });
    await page.getByTestId("new-game-back-home-button").click();
    await expect(page).toHaveURL("/");
    await expect(page.getByTestId("home-screen")).toBeVisible({ timeout: 10_000 });
  });

  test("browser Back from /exhibition/new returns to Home", async ({ page }) => {
    await page.getByTestId("home-new-game-button").click();
    await expect(page.getByTestId("exhibition-setup-page")).toBeVisible({ timeout: 10_000 });
    await page.goBack();
    await expect(page.getByTestId("home-screen")).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("Routing — game view navigation", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  test("Home → Load Saved Game navigates to /saves page", async ({ page }) => {
    await page.getByTestId("home-load-saves-button").click();
    await expect(page).toHaveURL(/\/saves/);
    await expect(page.getByTestId("saves-page")).toBeVisible({ timeout: 10_000 });
  });

  test("Load Saved Game → back button returns to Home screen", async ({ page }) => {
    await page.getByTestId("home-load-saves-button").click();
    await expect(page.getByTestId("saves-page")).toBeVisible({ timeout: 10_000 });
    await page.getByTestId("saves-page-back-button").click();
    await expect(page.getByTestId("home-screen")).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL("/");
  });

  test("saves page shows empty state and back button works when no saves exist", async ({
    page,
  }) => {
    await page.getByTestId("home-load-saves-button").click();
    await expect(page.getByTestId("saves-page")).toBeVisible({ timeout: 10_000 });
    // Wait for loading to finish
    await expect(page.getByText("Loading saves…")).not.toBeVisible({ timeout: 5_000 });
    // Empty state message must be visible (no load button)
    await expect(page.getByTestId("saves-page-empty")).toBeVisible();
    await expect(page.getByTestId("load-save-button")).not.toBeVisible();
    // Back button still works
    await page.getByTestId("saves-page-back-button").click();
    await expect(page.getByTestId("home-screen")).toBeVisible({ timeout: 10_000 });
  });

  test("Load Saved Game → load a save → navigates to /game", async ({ page }) => {
    // First start a game, save it, then go back to Home.
    await startGameViaPlayBall(page, { seed: "routing-load-save1" });
    await saveCurrentGame(page);
    await page.getByTestId("saves-modal-close-button").click();
    await expect(page.getByTestId("saves-modal")).not.toBeVisible({ timeout: 10_000 });
    await page.getByTestId("back-to-home-button").click();
    await expect(page.getByTestId("home-screen")).toBeVisible({ timeout: 10_000 });

    // Now enter via Load Saved Game → saves page.
    await page.getByTestId("home-load-saves-button").click();
    await expect(page.getByTestId("saves-page")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Loading saves…")).not.toBeVisible({ timeout: 5_000 });

    // Load the save — should navigate to /game.
    await page.getByTestId("saves-page").getByTestId("load-save-button").first().click();
    await expect(page).toHaveURL(/\/game/);
    await expect(page.getByTestId("scoreboard")).toBeVisible({ timeout: 15_000 });
  });

  test("Back to Home from game navigates to /", async ({ page }) => {
    await startGameViaPlayBall(page, { seed: "routing-back1" });
    await expect(page).toHaveURL(/\/game/);
    await page.getByTestId("back-to-home-button").click();
    await expect(page).toHaveURL("/");
    await expect(page.getByTestId("home-screen")).toBeVisible({ timeout: 10_000 });
  });

  test(
    "game UI is unmounted (not visible) after navigating away from /game",
    { tag: "@desktop-only" },
    async ({ page }) => {
      await startGameViaPlayBall(page, { seed: "routing-unmount1" });
      await expect(page.getByTestId("scoreboard")).toBeVisible({ timeout: 10_000 });

      await page.getByTestId("back-to-home-button").click();
      await expect(page.getByTestId("home-screen")).toBeVisible({ timeout: 5_000 });

      // The scoreboard should not exist in the DOM once the /game route is unmounted.
      await expect(page.getByTestId("scoreboard")).not.toBeVisible({ timeout: 3_000 });
      await expect(page.getByTestId("field-view")).not.toBeVisible({ timeout: 3_000 });
    },
  );

  test("Resume Current Game navigates back to /game", async ({ page }) => {
    await startGameViaPlayBall(page, { seed: "routing-resume1" });
    await page.getByTestId("back-to-home-button").click();
    await expect(page.getByTestId("home-screen")).toBeVisible({ timeout: 10_000 });

    await page.getByTestId("home-resume-current-game-button").click();
    await expect(page).toHaveURL(/\/game/);
    await expect(page.getByTestId("scoreboard")).toBeVisible({ timeout: 10_000 });
  });

  test("Home → Manage Teams navigates to /teams", async ({ page }) => {
    await page.getByTestId("home-manage-teams-button").click();
    await expect(page).toHaveURL(/\/teams/);
    await expect(page.getByTestId("manage-teams-screen")).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("Routing — teams sub-routes", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  test("Create Team button navigates to /teams/new", async ({ page }) => {
    await page.getByTestId("home-manage-teams-button").click();
    await expect(page.getByTestId("manage-teams-screen")).toBeVisible({ timeout: 10_000 });
    await page.getByTestId("manage-teams-create-button").click();
    await expect(page).toHaveURL(/\/teams\/new/);
    await expect(page.getByTestId("manage-teams-editor-shell")).toBeVisible({ timeout: 10_000 });
  });

  test("browser Back from /teams/new returns to /teams list", async ({ page }) => {
    await page.getByTestId("home-manage-teams-button").click();
    await expect(page.getByTestId("manage-teams-screen")).toBeVisible({ timeout: 10_000 });
    await page.getByTestId("manage-teams-create-button").click();
    await expect(page.getByTestId("manage-teams-editor-shell")).toBeVisible({ timeout: 10_000 });
    await page.goBack();
    await expect(page.getByTestId("manage-teams-screen")).toBeVisible({ timeout: 10_000 });
  });

  test(
    "direct navigation to /teams/:id/edit loads the team form",
    { tag: "@desktop-only" },
    async ({ page }) => {
      test.setTimeout(60_000);

      // Create a team via the UI so we have a real ID in the DB.
      await page.getByTestId("home-manage-teams-button").click();
      await expect(page.getByTestId("manage-teams-screen")).toBeVisible({ timeout: 10_000 });
      await page.getByTestId("manage-teams-create-button").click();
      await expect(page.getByTestId("manage-teams-editor-shell")).toBeVisible({ timeout: 10_000 });

      // Fill in the team name so we have something to assert on.
      await page.getByTestId("custom-team-name-input").fill("Deep Link Team");

      // Generate a random roster to meet the save requirements.
      await page.getByTestId("custom-team-regenerate-defaults-button").click();
      await page.waitForTimeout(500);

      // Override just the name (generate may overwrite it).
      await page.getByTestId("custom-team-name-input").fill("Deep Link Team");

      // Save the team and capture the edit URL from the resulting list.
      await page.getByTestId("custom-team-save-button").click();
      await expect(page.getByTestId("manage-teams-screen")).toBeVisible({ timeout: 10_000 });

      // Click Edit on the newly created team to capture the edit URL.
      await page.getByTestId("custom-team-edit-button").first().click();
      const editUrl = page.url();
      expect(editUrl).toMatch(/\/teams\/[^/]+\/edit/);

      // Navigate away then deep-link back to the same edit URL.
      await page.goto("/");
      await expect(page.getByTestId("home-screen")).toBeVisible({ timeout: 10_000 });
      await page.goto(editUrl);

      // Editor must load with the team name populated (not empty).
      await expect(page.getByTestId("manage-teams-editor-shell")).toBeVisible({ timeout: 15_000 });
      const nameInput = page.getByTestId("custom-team-name-input");
      await expect(nameInput).toBeVisible({ timeout: 10_000 });
      await expect(nameInput).not.toHaveValue("");
    },
  );

  test(
    "/teams/:id/edit with unknown id shows not-found state",
    { tag: "@desktop-only" },
    async ({ page }) => {
      await page.goto("/teams/nonexistent-team-id/edit");
      await expect(page.getByTestId("manage-teams-editor-shell")).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText(/team not found/i)).toBeVisible({ timeout: 5_000 });
    },
  );
});

test.describe("Routing — help page", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  test("Home → Help navigates to /help", async ({ page }) => {
    await page.getByTestId("home-help-button").click();
    await expect(page).toHaveURL(/\/help/);
    await expect(page.getByTestId("help-page")).toBeVisible({ timeout: 10_000 });
  });

  test("browser Back from /help returns to Home", async ({ page }) => {
    await page.getByTestId("home-help-button").click();
    await expect(page.getByTestId("help-page")).toBeVisible({ timeout: 10_000 });
    await page.goBack();
    await expect(page.getByTestId("home-screen")).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/\//);
  });

  test("help back button navigates back to Home", async ({ page }) => {
    await page.getByTestId("home-help-button").click();
    await expect(page.getByTestId("help-page")).toBeVisible({ timeout: 10_000 });
    await page.getByTestId("help-page-back-button").click();
    await expect(page.getByTestId("home-screen")).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("Routing — deep-link and unknown paths", () => {
  test("unknown path redirects to Home screen", async ({ page }) => {
    await page.goto("/this-path-does-not-exist");
    await expect(page.getByTestId("home-screen")).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL("/");
  });
});

/**
 * Direct-navigation smoke tests — each top-level route is visited via `page.goto`
 * (simulating a deep link / fresh tab) and asserts its stable page-level element.
 * These tests are desktop-only to keep CI time reasonable; the behaviour is
 * viewport-independent because it's purely router correctness.
 */
test.describe("Routing — direct-navigation smoke tests", { tag: "@desktop-only" }, () => {
  test("direct visit to / shows Home screen", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("home-screen")).toBeVisible({ timeout: 15_000 });
  });

  test("direct visit to /exhibition/new shows Exhibition Setup page", async ({ page }) => {
    await page.goto("/exhibition/new");
    await expect(page.getByTestId("exhibition-setup-page")).toBeVisible({ timeout: 15_000 });
  });

  test("direct visit to /teams shows Manage Teams screen", async ({ page }) => {
    await page.goto("/teams");
    await expect(page.getByTestId("manage-teams-screen")).toBeVisible({ timeout: 15_000 });
  });

  test("direct visit to /teams/new shows team editor shell", async ({ page }) => {
    await page.goto("/teams/new");
    await expect(page.getByTestId("manage-teams-editor-shell")).toBeVisible({ timeout: 15_000 });
  });

  test("direct visit to /teams/:id/edit with unknown id shows not-found in editor", async ({
    page,
  }) => {
    await page.goto("/teams/nonexistent-direct-link/edit");
    await expect(page.getByTestId("manage-teams-editor-shell")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/team not found/i)).toBeVisible({ timeout: 5_000 });
  });

  test("direct visit to /saves shows Saves page", async ({ page }) => {
    await page.goto("/saves");
    await expect(page.getByTestId("saves-page")).toBeVisible({ timeout: 15_000 });
  });

  test("direct visit to /help shows Help page", async ({ page }) => {
    await page.goto("/help");
    await expect(page.getByTestId("help-page")).toBeVisible({ timeout: 15_000 });
  });

  test("direct visit to /game shows scoreboard", async ({ page }) => {
    await page.goto("/game");
    // Direct visit with no pending setup auto-restores or shows empty game state.
    await expect(page.getByTestId("scoreboard")).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("Routing — autoplay pauses off /game", () => {
  test(
    "autoplay stops producing log entries when navigating away from /game",
    { tag: "@desktop-only" },
    async ({ page }) => {
      test.setTimeout(60_000);

      await page.addInitScript(() => {
        localStorage.setItem("speed", "150"); // SPEED_FAST
      });

      await startGameViaPlayBall(page, { seed: "routing-pause1" });
      // Wait for a few autoplay entries to confirm the scheduler is running.
      await waitForLogLines(page, 5, 30_000);

      // Count entries before navigating away.
      const countBefore = await page
        .getByTestId("play-by-play-log")
        .locator("[data-log-index]")
        .count();

      // Navigate away — autoplay should pause.
      await page.getByTestId("back-to-home-button").click();
      await expect(page.getByTestId("home-screen")).toBeVisible({ timeout: 5_000 });

      // Wait a short period; with autoplay running this would produce more entries.
      await page.waitForTimeout(2_000);

      // Navigate back to /game.
      await page.getByTestId("home-resume-current-game-button").click();
      await expect(page.getByTestId("scoreboard")).toBeVisible({ timeout: 10_000 });

      // Expand the log to check.
      const logToggle = page.getByRole("button", { name: /expand play-by-play/i });
      if (await logToggle.isVisible()) await logToggle.click();

      // Entry count must not have grown significantly while we were on Home.
      // Allow 1 extra entry for any in-flight pitch at navigation time.
      const countAfter = await page
        .getByTestId("play-by-play-log")
        .locator("[data-log-index]")
        .count();
      expect(countAfter).toBeLessThanOrEqual(countBefore + 2);
    },
  );
});

test.describe("New Game seed auto-regeneration", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  test("New Game seed input is pre-filled on open", async ({ page }) => {
    await page.goto("/exhibition/new");
    await expect(page.getByTestId("exhibition-setup-page")).toBeVisible({ timeout: 15_000 });
    const seedInput = page.getByTestId("seed-input");
    await expect(seedInput).toBeVisible();
    const value = await seedInput.inputValue();
    expect(value.length).toBeGreaterThan(0);
  });

  test("closing and reopening New Game regenerates a different seed", async ({ page }) => {
    // First open
    await page.goto("/exhibition/new");
    await expect(page.getByTestId("exhibition-setup-page")).toBeVisible({ timeout: 15_000 });
    const firstSeed = await page.getByTestId("seed-input").inputValue();

    // Navigate away and back
    await page.goto("/");
    await expect(page.getByTestId("home-screen")).toBeVisible({ timeout: 10_000 });
    await page.goto("/exhibition/new");
    await expect(page.getByTestId("exhibition-setup-page")).toBeVisible({ timeout: 15_000 });
    const secondSeed = await page.getByTestId("seed-input").inputValue();

    // Seeds must differ (fresh generation each open)
    expect(secondSeed).not.toBe(firstSeed);
  });
});
