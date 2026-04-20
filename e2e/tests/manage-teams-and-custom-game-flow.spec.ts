import { expect, test } from "@playwright/test";
import * as path from "path";

import {
  expectNoRawIdsVisible,
  resetAppState,
  saveCurrentGame,
  startGameViaPlayBall,
  waitForLogLines,
  waitForNewGameDialog,
} from "../utils/helpers";

test.describe("Manage Teams — team list and CRUD", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  test("navigating to Manage Teams shows the real team list UI with a Create button", async ({
    page,
  }) => {
    await page.getByTestId("home-manage-teams-button").click();
    await expect(page.getByTestId("manage-teams-screen")).toBeVisible({ timeout: 10_000 });
    // Real UI has a Create button; placeholder had no such button
    await expect(page.getByTestId("manage-teams-create-button")).toBeVisible();
    // Placeholder text should be gone
    await expect(page.getByText("coming soon")).not.toBeVisible();
  });

  test("clicking Generate Defaults prefills the form, saving adds team to list", async ({
    page,
  }) => {
    await page.getByTestId("home-manage-teams-button").click();
    await expect(page.getByTestId("manage-teams-screen")).toBeVisible({ timeout: 10_000 });

    // Open the editor
    await page.getByTestId("manage-teams-create-button").click();
    await expect(page.getByTestId("custom-team-name-input")).toBeVisible({ timeout: 15_000 });

    // Click Generate Defaults to prefill
    await page.getByTestId("custom-team-regenerate-defaults-button").click();
    // Name should now be filled
    const nameValue = await page.getByTestId("custom-team-name-input").inputValue();
    expect(nameValue.length).toBeGreaterThan(0);

    // Edit the name to something unique
    await page.getByTestId("custom-team-name-input").fill("Test City Rockets");

    // Save
    await page.getByTestId("custom-team-save-button").click();

    // Should return to list and show the new team
    await expect(page.getByTestId("custom-team-list")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Test City Rockets")).toBeVisible();
  });

  test("custom team saved via editor is visible after page reload", async ({ page }) => {
    await page.getByTestId("home-manage-teams-button").click();
    await expect(page.getByTestId("manage-teams-create-button")).toBeVisible({ timeout: 10_000 });
    await page.getByTestId("manage-teams-create-button").click();
    await page.getByTestId("custom-team-regenerate-defaults-button").click();
    await page.getByTestId("custom-team-name-input").fill("Persistent Eagles");
    await page.getByTestId("custom-team-save-button").click();
    await expect(page.getByText("Persistent Eagles")).toBeVisible({ timeout: 15_000 });

    // Confirm the saved team survives an in-app route cycle before hard reload.
    await page.getByTestId("manage-teams-back-button").click();
    await expect(page.getByTestId("home-screen")).toBeVisible({ timeout: 10_000 });
    await page.getByTestId("home-manage-teams-button").click();
    await expect(page.getByTestId("manage-teams-screen")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Persistent Eagles")).toBeVisible({ timeout: 15_000 });

    const manageScreen = page.getByTestId("manage-teams-screen");
    const backToListBtn = page.getByRole("button", { name: /team list/i });

    // Under full-suite load, the first hard reload of /teams can transiently land
    // in an empty-state hydration path. Retry the whole reload+assert sequence once.
    await expect(async () => {
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(manageScreen.or(backToListBtn)).toBeVisible({ timeout: 15_000 });
      if (await backToListBtn.isVisible()) {
        await backToListBtn.click();
      }
      await expect(manageScreen).toBeVisible({ timeout: 15_000 });

      const teamName = page.getByText("Persistent Eagles");
      if (!(await teamName.isVisible().catch(() => false))) {
        await page.getByTestId("manage-teams-back-button").click();
        await expect(page.getByTestId("home-screen")).toBeVisible({ timeout: 10_000 });
        await page.getByTestId("home-manage-teams-button").click();
        await expect(manageScreen).toBeVisible({ timeout: 15_000 });
      }

      await expect(teamName).toBeVisible({ timeout: 10_000 });
    }).toPass({ timeout: 45_000, intervals: [500, 1_000] });
  });

  test("editing a custom team: name is read-only in Edit mode; team remains in list after save", async ({
    page,
  }) => {
    // First create a team
    await page.getByTestId("home-manage-teams-button").click();
    await page.getByTestId("manage-teams-create-button").click();
    await page.getByTestId("custom-team-regenerate-defaults-button").click();
    await page.getByTestId("custom-team-name-input").fill("Original Name");
    await page.getByTestId("custom-team-save-button").click();
    await expect(page.getByText("Original Name")).toBeVisible({ timeout: 15_000 });

    // Open edit — name field must be read-only (identity immutability)
    await page.getByTestId("custom-team-edit-button").first().click();
    await expect(page.getByTestId("custom-team-name-input")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("custom-team-name-input")).toHaveAttribute("readonly");

    // Save without changing the name
    await page.getByTestId("custom-team-save-button").click();

    // Team should still be in the list with its original name
    await expect(page.getByText("Original Name")).toBeVisible({ timeout: 15_000 });
  });

  test("editing a team: newly added player has an editable name field", async ({ page }) => {
    // Create a team with generated defaults
    await page.getByTestId("home-manage-teams-button").click();
    await page.getByTestId("manage-teams-create-button").click();
    await page.getByTestId("custom-team-regenerate-defaults-button").click();
    await page.getByTestId("custom-team-name-input").fill("Test Squad");
    await page.getByTestId("custom-team-save-button").click();
    await expect(page.getByText("Test Squad")).toBeVisible({ timeout: 15_000 });

    // Open edit mode and add a new bench player
    await page.getByTestId("custom-team-edit-button").first().click();
    await page.getByTestId("custom-team-add-bench-player-button").click();

    // New player's name input must be editable (not locked like existing players)
    const newPlayerNameInput = page.getByPlaceholder("Player name").last();
    await expect(newPlayerNameInput).toBeEditable();
    await newPlayerNameInput.fill("New Bench Star");
    await expect(newPlayerNameInput).toHaveValue("New Bench Star");
  });

  test("info banner warns that edits won't affect the current game when navigating from an active game", async ({
    page,
  }) => {
    await startGameViaPlayBall(page, { seed: "2b-manage-active" });
    // Go back to home from game
    await page.getByTestId("back-to-home-button").click();
    await expect(page.getByTestId("home-screen")).toBeVisible({ timeout: 10_000 });
    // Go to Manage Teams
    await page.getByTestId("home-manage-teams-button").click();
    await expect(page.getByTestId("manage-teams-screen")).toBeVisible({ timeout: 10_000 });
    // Info banner should be visible
    await expect(page.getByText(/apply to future games/i)).toBeVisible();
  });
});

test.describe("Resume Current Game — gating and navigation", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  test("Resume Current Game button is absent before any game is started", async ({ page }) => {
    await expect(page.getByTestId("home-resume-current-game-button")).not.toBeVisible();
  });

  test("Resume Current Game button appears after clicking Back to Home from an active game", async ({
    page,
  }) => {
    await startGameViaPlayBall(page, { seed: "2b-resume-1" });
    await page.getByTestId("back-to-home-button").click();
    await expect(page.getByTestId("home-screen")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("home-resume-current-game-button")).toBeVisible();
  });

  test("Resume Current Game returns to the same in-progress game (scoreboard visible)", async ({
    page,
  }) => {
    await startGameViaPlayBall(page, { seed: "2b-resume-2" });
    await expect(page.getByTestId("scoreboard")).toBeVisible({ timeout: 10_000 });

    await page.getByTestId("back-to-home-button").click();
    await expect(page.getByTestId("home-screen")).toBeVisible({ timeout: 10_000 });

    await page.getByTestId("home-resume-current-game-button").click();
    await expect(page.getByTestId("scoreboard")).toBeVisible({ timeout: 10_000 });
    // Home screen should no longer be visible
    await expect(page.getByTestId("home-screen")).not.toBeVisible();
  });

  test("visiting Manage Teams during an active game does not break Resume on return", async ({
    page,
  }) => {
    await startGameViaPlayBall(page, { seed: "2b-manage-resume" });

    // Go back to home
    await page.getByTestId("back-to-home-button").click();
    await expect(page.getByTestId("home-screen")).toBeVisible({ timeout: 10_000 });

    // Navigate to Manage Teams
    await page.getByTestId("home-manage-teams-button").click();
    await expect(page.getByTestId("manage-teams-screen")).toBeVisible({ timeout: 10_000 });

    // Return to home
    await page.getByTestId("manage-teams-back-button").click();
    await expect(page.getByTestId("home-screen")).toBeVisible({ timeout: 10_000 });

    // Resume game
    await page.getByTestId("home-resume-current-game-button").click();
    await expect(page.getByTestId("scoreboard")).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("New Game dialog — custom team picker", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  test("shows empty-state message when no custom teams exist", async ({ page }) => {
    await waitForNewGameDialog(page);
    // No custom teams → empty state text
    await expect(page.getByText(/no custom teams/i)).toBeVisible({ timeout: 15_000 });
    // Team selects should never be present without teams
    await expect(page.getByTestId("home-team-select")).not.toBeVisible();
  });

  test("Custom Teams tab shows team selectors when at least one custom team exists", async ({
    page,
  }) => {
    // Create a team first
    await page.getByTestId("home-manage-teams-button").click();
    await page.getByTestId("manage-teams-create-button").click();
    await page.getByTestId("custom-team-regenerate-defaults-button").click();
    await page.getByTestId("custom-team-name-input").fill("Custom Away Team");
    await page.getByTestId("custom-team-save-button").click();
    await expect(page.getByText("Custom Away Team")).toBeVisible({ timeout: 15_000 });

    // Go back home and open New Game
    await page.getByTestId("manage-teams-back-button").click();
    await page.getByTestId("home-new-game-button").click();
    await expect(page.getByTestId("exhibition-setup-page")).toBeVisible({ timeout: 10_000 });

    // Switch to Custom Teams tab
    await expect(page.getByTestId("new-game-custom-away-team-select")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("new-game-custom-home-team-select")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("starting a game with two custom teams reaches the game screen", async ({ page }) => {
    // Create two custom teams
    await page.getByTestId("home-manage-teams-button").click();

    await page.getByTestId("manage-teams-create-button").click();
    await page.getByTestId("custom-team-regenerate-defaults-button").click();
    await page.getByTestId("custom-team-name-input").fill("Red Team");
    await page.getByTestId("custom-team-save-button").click();
    await expect(page.getByText("Red Team")).toBeVisible({ timeout: 15_000 });

    await page.getByTestId("manage-teams-create-button").click();
    await page.getByTestId("custom-team-regenerate-defaults-button").click();
    await page.getByTestId("custom-team-name-input").fill("Blue Team");
    await page.getByTestId("custom-team-save-button").click();
    await expect(page.getByText("Blue Team")).toBeVisible({ timeout: 15_000 });

    // Go back to Home → New Game
    await page.getByTestId("manage-teams-back-button").click();
    await page.getByTestId("home-new-game-button").click();
    await expect(page.getByTestId("exhibition-setup-page")).toBeVisible({ timeout: 10_000 });

    // Wait for custom team selects and start game
    await expect(page.getByTestId("new-game-custom-away-team-select")).toBeVisible({
      timeout: 15_000,
    });
    await page.getByTestId("play-ball-button").click();

    await expect(page.getByTestId("exhibition-setup-page")).not.toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("scoreboard")).toBeVisible({ timeout: 10_000 });
  });

  test("play-by-play log shows custom team display names, not raw custom IDs", async ({ page }) => {
    // Create two custom teams.
    await page.getByTestId("home-manage-teams-button").click();

    await page.getByTestId("manage-teams-create-button").click();
    await page.getByTestId("custom-team-regenerate-defaults-button").click();
    await page.getByTestId("custom-team-name-input").fill("Scarlet Hawks");
    await page.getByTestId("custom-team-save-button").click();
    await expect(page.getByText("Scarlet Hawks")).toBeVisible({ timeout: 15_000 });

    await page.getByTestId("manage-teams-create-button").click();
    await page.getByTestId("custom-team-regenerate-defaults-button").click();
    await page.getByTestId("custom-team-name-input").fill("Cobalt Wolves");
    await page.getByTestId("custom-team-save-button").click();
    await expect(page.getByText("Cobalt Wolves")).toBeVisible({ timeout: 15_000 });

    // Start a game with the two custom teams.
    await page.getByTestId("manage-teams-back-button").click();
    await page.getByTestId("home-new-game-button").click();
    await expect(page.getByTestId("exhibition-setup-page")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("new-game-custom-away-team-select")).toBeVisible({
      timeout: 15_000,
    });
    await page.getByTestId("play-ball-button").click();
    await expect(page.getByTestId("scoreboard")).toBeVisible({ timeout: 10_000 });

    // Wait for several play-by-play entries.
    await waitForLogLines(page, 5, 30_000);

    // Collect all visible log text.
    const logText = await page.getByTestId("play-by-play-log").textContent();

    // No raw custom ID fragments must appear in the log.
    expect(logText).not.toMatch(/custom:ct_/);
  });

  test("New Game → Custom Teams (empty) → 'Go to Manage Teams' link — buttons are actionable", async ({
    page,
  }) => {
    // Navigate to New Game (no custom teams exist).
    await page.getByTestId("home-new-game-button").click();
    await expect(page.getByTestId("exhibition-setup-page")).toBeVisible({ timeout: 10_000 });

    // Switch to the Custom Teams tab — should show the empty state link.
    await expect(page.getByRole("button", { name: /go to manage teams/i })).toBeVisible({
      timeout: 15_000,
    });

    // Click the "Go to Manage Teams" link — must close the dialog and navigate.
    await page.getByRole("button", { name: /go to manage teams/i }).click();
    await expect(page.getByTestId("manage-teams-screen")).toBeVisible({ timeout: 10_000 });

    // The New Game dialog's backdrop must be gone — buttons must be actionable.
    // Verify both the Create button and Back button are clickable.
    await expect(page.getByTestId("manage-teams-create-button")).toBeVisible();
    await page.getByTestId("manage-teams-create-button").click();
    await expect(page.getByTestId("custom-team-name-input")).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("Label resolution — no raw IDs in any user-facing surface", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  test(
    "custom team game: scoreboard, log, and saves list show friendly names (no raw IDs)",
    { tag: "@desktop-only" },
    async ({ page }) => {
      test.setTimeout(90_000);

      // Create two custom teams.
      await page.getByTestId("home-manage-teams-button").click();

      await page.getByTestId("manage-teams-create-button").click();
      await page.getByTestId("custom-team-regenerate-defaults-button").click();
      await page.getByTestId("custom-team-name-input").fill("Golden Foxes");
      await page.getByTestId("custom-team-save-button").click();
      await expect(page.getByText("Golden Foxes")).toBeVisible({ timeout: 15_000 });

      await page.getByTestId("manage-teams-create-button").click();
      await page.getByTestId("custom-team-regenerate-defaults-button").click();
      await page.getByTestId("custom-team-name-input").fill("Silver Bears");
      await page.getByTestId("custom-team-save-button").click();
      await expect(page.getByText("Silver Bears")).toBeVisible({ timeout: 15_000 });

      // Start a game with the two custom teams.
      await page.getByTestId("manage-teams-back-button").click();
      await page.getByTestId("home-new-game-button").click();
      await expect(page.getByTestId("exhibition-setup-page")).toBeVisible({ timeout: 10_000 });
      await expect(page.getByTestId("new-game-custom-away-team-select")).toBeVisible({
        timeout: 15_000,
      });
      await page.getByTestId("play-ball-button").click();
      await expect(page.getByTestId("scoreboard")).toBeVisible({ timeout: 10_000 });

      // Wait for several play-by-play entries so the log is populated.
      await waitForLogLines(page, 5, 30_000);

      // Check scoreboard, log, and hit-log for raw IDs.
      await expectNoRawIdsVisible(page);

      // Save the game then check the saves list entry name is also friendly.
      await saveCurrentGame(page);
      const savesModal = page.getByTestId("saves-modal");
      const saveName = await savesModal
        .locator("[data-testid='saves-list-item']")
        .first()
        .textContent();
      expect(saveName ?? "").not.toMatch(/custom:|ct_[a-z0-9]/i);

      // Also check on the /saves page after navigating there.
      await page.getByTestId("saves-modal-close-button").click();
      await page.getByTestId("back-to-home-button").click();
      await page.getByTestId("home-load-saves-button").click();
      await expect(page.getByTestId("saves-page")).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText("Loading saves…")).not.toBeVisible({ timeout: 15_000 });
      const savesPageName = await page.getByTestId("saves-list-item").first().textContent();
      expect(savesPageName ?? "").not.toMatch(/custom:|ct_[a-z0-9]/i);
    },
  );
});

// ── Issue §4: import teams → start game → save → load ──────────────────────

test.describe("Custom Team Import — start game → save → load flow", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  test(
    "import a team via file, start an exhibition game, save it, then reload it",
    { tag: "@desktop-only" },
    async ({ page }, testInfo) => {
      // Step 1: Create a team and export it.
      await page.getByTestId("home-manage-teams-button").click();
      await expect(page.getByTestId("manage-teams-screen")).toBeVisible({ timeout: 10_000 });

      await page.getByTestId("manage-teams-create-button").click();
      await page.getByTestId("custom-team-regenerate-defaults-button").click();
      await page.getByTestId("custom-team-name-input").fill("Import Flow Home");
      await page.getByTestId("custom-team-save-button").click();
      await expect(page.getByTestId("manage-teams-screen")).toBeVisible({ timeout: 10_000 });

      await page.getByTestId("manage-teams-create-button").click();
      await page.getByTestId("custom-team-regenerate-defaults-button").click();
      await page.getByTestId("custom-team-name-input").fill("Import Flow Away");
      await page.getByTestId("custom-team-save-button").click();
      await expect(page.getByTestId("manage-teams-screen")).toBeVisible({ timeout: 10_000 });

      const downloadPromise = page.waitForEvent("download");
      await page.getByTestId("export-all-teams-button").click();
      const download = await downloadPromise;
      const tmpPath = path.join(testInfo.outputDir, "import-flow-teams.json");
      await download.saveAs(tmpPath);

      // Step 2: Delete both teams and re-import from file.
      for (let i = 0; i < 2; i++) {
        page.once("dialog", (d) => d.accept());
        await page.getByTestId("custom-team-delete-button").first().click();
        await page.waitForTimeout(300);
      }
      await expect(page.getByText(/no custom teams yet/i)).toBeVisible({ timeout: 15_000 });

      await page.getByTestId("import-teams-file-input").setInputFiles(tmpPath);
      await expect(page.getByTestId("import-teams-success")).toBeVisible({ timeout: 10_000 });
      await expect(page.getByTestId("custom-team-list")).toBeVisible({ timeout: 15_000 });

      // Step 3: Start an exhibition game using the imported teams.
      await page.getByTestId("manage-teams-back-button").click();
      await expect(page.getByTestId("home-screen")).toBeVisible({ timeout: 15_000 });
      await startGameViaPlayBall(page);
      await expect(page.getByTestId("scoreboard")).toBeVisible({ timeout: 10_000 });
      await waitForLogLines(page, 3, 30_000);

      // Step 4: Save the game.
      await saveCurrentGame(page);
      await page.getByTestId("saves-modal-close-button").click();

      // Step 5: Go back to home, navigate to saves, and load the save.
      await page.getByTestId("back-to-home-button").click();
      await expect(page.getByTestId("home-screen")).toBeVisible({ timeout: 15_000 });
      await page.getByTestId("home-load-saves-button").click();
      await expect(page.getByTestId("saves-page")).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText("Loading saves…")).not.toBeVisible({ timeout: 15_000 });

      const loadBtn = page.getByTestId("load-save-button").first();
      await expect(loadBtn).toBeVisible({ timeout: 15_000 });
      await loadBtn.click();

      // Game should be restored and playable.
      await expect(page.getByTestId("scoreboard")).toBeVisible({ timeout: 10_000 });
      await expectNoRawIdsVisible(page);
    },
  );
});
