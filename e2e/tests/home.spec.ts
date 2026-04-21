import { expect, test } from "@playwright/test";

import {
  openSavesModal,
  resetAppState,
  saveCurrentGame,
  startGameViaPlayBall,
  waitForNewGameDialog,
} from "../utils/helpers";

test.describe("Home Screen", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  test("shows Home screen on app launch", async ({ page }) => {
    await expect(page.getByTestId("home-screen")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("home-new-game-button")).toBeVisible();
    await expect(page.getByTestId("home-load-saves-button")).toBeVisible();
    await expect(page.getByTestId("home-manage-teams-button")).toBeVisible();
  });

  test("New Game button navigates to exhibition setup page", async ({ page }) => {
    await waitForNewGameDialog(page);
    await expect(page.getByTestId("exhibition-setup-page")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("play-ball-button")).toBeVisible();
    // Home screen should no longer be visible
    await expect(page.getByTestId("home-screen")).not.toBeVisible();
  });

  test("New Game path leads to a working game", async ({ page }) => {
    await startGameViaPlayBall(page, { seed: "home-test1" });
    await expect(page.getByTestId("scoreboard")).toBeVisible({ timeout: 10_000 });
  });

  test("Load Saved Game button navigates to /saves page", async ({ page }) => {
    await page.getByTestId("home-load-saves-button").click();
    await expect(page).toHaveURL(/\/saves/);
    await expect(page.getByTestId("saves-page")).toBeVisible({ timeout: 10_000 });
    // Home screen should no longer be visible
    await expect(page.getByTestId("home-screen")).not.toBeVisible();
  });

  // ── Stranded-close guard ───────────────────────────────────────────────────

  test("Load Saved Game → back button returns to Home screen", async ({ page }) => {
    await page.getByTestId("home-load-saves-button").click();
    await expect(page.getByTestId("saves-page")).toBeVisible({ timeout: 10_000 });
    // Back button on saves page should route back to Home
    await page.getByTestId("saves-page-back-button").click();
    await expect(page.getByTestId("home-screen")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("saves-page")).not.toBeVisible();
  });

  test("Load Saved Game → load a save → stays on game screen (regression guard)", async ({
    page,
  }) => {
    // First start a game, save it, and go back to Home.
    await startGameViaPlayBall(page, { seed: "load-saves-regression" });
    await saveCurrentGame(page);
    // Close the saves modal before navigating — the modal is still open after
    // saving and a showModal() dialog makes all elements outside it inert.
    await page.getByTestId("saves-modal-close-button").click();
    await expect(page.getByTestId("saves-modal")).not.toBeVisible({ timeout: 10_000 });
    // Navigate back to Home.
    await page.getByTestId("back-to-home-button").click();
    await expect(page.getByTestId("home-screen")).toBeVisible({ timeout: 10_000 });

    // Now enter via Load Saved Game path → saves page.
    await page.getByTestId("home-load-saves-button").click();
    await expect(page.getByTestId("saves-page")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Loading saves…")).not.toBeVisible({ timeout: 5_000 });

    // Load the save — should navigate to /game, NOT back to Home.
    await page.getByTestId("saves-page").getByTestId("load-save-button").first().click();
    await expect(page).toHaveURL(/\/game/);
    await expect(page.getByTestId("scoreboard")).toBeVisible({ timeout: 15_000 });
    // Critically: Home screen must NOT appear.
    await expect(page.getByTestId("home-screen")).not.toBeVisible();
  });

  test("New Game setup shows a Back to Home button", async ({ page }) => {
    await waitForNewGameDialog(page);
    await expect(page.getByTestId("new-game-back-home-button")).toBeVisible({ timeout: 10_000 });
  });

  test("New Game setup Back to Home button returns to Home screen", async ({ page }) => {
    await waitForNewGameDialog(page);
    await page.getByTestId("new-game-back-home-button").click();
    await expect(page.getByTestId("home-screen")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("exhibition-setup-page")).not.toBeVisible();
  });

  // ── Back to Home button ────────────────────────────────────────────────────

  test("Back to Home button is visible in game UI after starting a game", async ({ page }) => {
    await startGameViaPlayBall(page, { seed: "home-btn1" });
    await expect(page.getByTestId("back-to-home-button")).toBeVisible({ timeout: 10_000 });
  });

  test("Back to Home button returns to Home screen from an active game", async ({ page }) => {
    await startGameViaPlayBall(page, { seed: "home-btn2" });
    await page.getByTestId("back-to-home-button").click();
    await expect(page.getByTestId("home-screen")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("scoreboard")).not.toBeVisible();
  });

  test("Back to Home button is visible before game starts (exhibition setup open)", async ({
    page,
  }) => {
    await waitForNewGameDialog(page);
    // The exhibition setup page has its own back button (new-game-back-home-button).
    await expect(page.getByTestId("new-game-back-home-button")).toBeVisible({ timeout: 10_000 });
  });

  test("normal in-game saves modal close button label is 'Close'", async ({ page }) => {
    await startGameViaPlayBall(page, { seed: "home-btn-close" });
    await openSavesModal(page);
    await expect(page.getByTestId("saves-modal-close-button")).toHaveText("Close");
  });

  test("Back to Home from Save/Load modal area works after opening Saves", async ({ page }) => {
    await startGameViaPlayBall(page, { seed: "home-btn3" });
    await openSavesModal(page);
    // Close the saves modal first, then use Back to Home
    await page.getByTestId("saves-modal-close-button").click();
    await page.getByTestId("back-to-home-button").click();
    await expect(page.getByTestId("home-screen")).toBeVisible({ timeout: 10_000 });
  });

  // ── Manage Teams placeholder ──────────────────────────────────────────────

  test("Manage Teams button navigates to Manage Teams placeholder screen", async ({ page }) => {
    await page.getByTestId("home-manage-teams-button").click();
    await expect(page.getByTestId("manage-teams-screen")).toBeVisible({ timeout: 10_000 });
    // Home screen should no longer be visible
    await expect(page.getByTestId("home-screen")).not.toBeVisible();
  });

  test("Manage Teams back button returns to Home screen", async ({ page }) => {
    await page.getByTestId("home-manage-teams-button").click();
    await expect(page.getByTestId("manage-teams-screen")).toBeVisible({ timeout: 10_000 });
    await page.getByTestId("manage-teams-back-button").click();
    await expect(page.getByTestId("home-screen")).toBeVisible({ timeout: 10_000 });
  });

  // ── Home → New Game when a game is already active ──────────────────────────

  test("New Game navigates to exhibition setup even when an active game already exists", async ({
    page,
  }) => {
    // Start a real game so the active-game session is created.
    await startGameViaPlayBall(page, { seed: "home-new-game-active" });
    await expect(page.getByTestId("scoreboard")).toBeVisible({ timeout: 10_000 });

    // Go back to Home — Resume Current Game button should appear.
    await page.getByTestId("back-to-home-button").click();
    await expect(page.getByTestId("home-screen")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("home-resume-current-game-button")).toBeVisible();

    // Click New Game — the Exhibition Setup page MUST open.
    await page.getByTestId("home-new-game-button").click();
    await expect(page.getByTestId("exhibition-setup-page")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("play-ball-button")).toBeVisible();
  });

  test("Resume Current Game returns to the in-progress game after going Home", async ({ page }) => {
    await startGameViaPlayBall(page, { seed: "home-resume-active" });
    await expect(page.getByTestId("scoreboard")).toBeVisible({ timeout: 10_000 });

    await page.getByTestId("back-to-home-button").click();
    await expect(page.getByTestId("home-screen")).toBeVisible({ timeout: 10_000 });

    await page.getByTestId("home-resume-current-game-button").click();
    await expect(page.getByTestId("scoreboard")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("home-screen")).not.toBeVisible();
  });

  // ── Help button ────────────────────────────────────────────────────────────

  test("Help button navigates to /help page", async ({ page }) => {
    await expect(page.getByTestId("home-help-button")).toBeVisible();
    await page.getByTestId("home-help-button").click();
    await expect(page).toHaveURL(/\/help/);
    await expect(page.getByTestId("help-page")).toBeVisible({ timeout: 10_000 });
    // Home screen should no longer be visible
    await expect(page.getByTestId("home-screen")).not.toBeVisible();
  });
});

test.describe("Home page League Mode", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  test("Home page shows a League Mode button", async ({ page }) => {
    await expect(page.getByTestId("home-screen")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("home-league-button")).toBeVisible();
    await expect(page.getByTestId("home-league-button")).toContainText(/league mode/i);
  });

  test("League Mode button is a clickable button", async ({ page }) => {
    await expect(page.getByTestId("home-screen")).toBeVisible({ timeout: 15_000 });
    const leagueBtn = page.getByTestId("home-league-button");
    await expect(leagueBtn).toBeVisible();
    const tagName = await leagueBtn.evaluate((el) => el.tagName.toLowerCase());
    expect(tagName).toBe("button");
  });
});
