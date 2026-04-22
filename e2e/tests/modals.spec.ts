import { expect, test } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

import {
  fillAndDispatchInput,
  importSaveFromFixture,
  importTeamsFixture,
  openSavesModal,
  resetAppState,
  saveCurrentGame,
  startGameViaPlayBall,
  waitForLogLines,
  waitForNewGameDialog,
} from "../utils/helpers";

/**
 * Modal / dialog smoke tests — verify open/close behavior, form state,
 * and one representative destructive action for each key dialog in the app.
 *
 * These tests run across all non-determinism viewport projects so we catch
 * any layout issues that might prevent a button from being reachable.
 */
test.describe("Modals", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  // ── New Game setup ────────────────────────────────────────────────────────

  test.describe("New Game setup", () => {
    test("opens via New Game button and shows Play Ball button", async ({ page }) => {
      await waitForNewGameDialog(page);
      await expect(page.getByTestId("exhibition-setup-page")).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId("play-ball-button")).toBeVisible();
    });

    test("submitting the form (Play Ball!) navigates to the game", async ({ page }) => {
      await startGameViaPlayBall(page, { seed: "modal0" });
      await expect(page.getByTestId("scoreboard")).toBeVisible({ timeout: 10_000 });
    });
  });

  // ── Saves modal ────────────────────────────────────────────────────────────

  test.describe("Saves modal", () => {
    test("opens via the Saves button and shows the import section", async ({ page }) => {
      await startGameViaPlayBall(page, { seed: "modal1" });
      await openSavesModal(page);
      const modal = page.getByTestId("saves-modal");
      await expect(modal).toBeVisible();
      // Import textarea is always present inside the modal.
      await expect(modal.getByTestId("import-save-textarea")).toBeVisible();
    });

    test("Close button dismisses the modal", async ({ page }) => {
      await startGameViaPlayBall(page, { seed: "modal2" });
      await openSavesModal(page);
      await expect(page.getByTestId("saves-modal")).toBeVisible();
      await page.getByRole("button", { name: /close/i }).click();
      await expect(page.getByTestId("saves-modal")).not.toBeVisible({ timeout: 5_000 });
    });

    test("import textarea clears after a successful import", async ({ page }) => {
      await startGameViaPlayBall(page, { seed: "modal3" });
      await openSavesModal(page);

      // Read the sample fixture and paste it into the import textarea.
      const fixturePath = path.resolve(__dirname, "../fixtures/sample-save.json");
      const fixtureJson = fs.readFileSync(fixturePath, "utf-8");
      const importTextareaEl = page.getByTestId("import-save-textarea");
      await fillAndDispatchInput(importTextareaEl, fixtureJson);
      await expect(page.getByTestId("import-save-button")).toBeEnabled({ timeout: 5_000 });

      await page.getByTestId("import-save-button").click();

      // After a successful import the app clears the textarea.
      await expect(page.getByTestId("import-save-textarea")).toHaveValue("", { timeout: 10_000 });
    });

    test("delete button removes a save from the list", async ({ page }) => {
      await startGameViaPlayBall(page, { seed: "modal4" });
      await waitForLogLines(page, 5);
      await saveCurrentGame(page);

      // Wait for both the auto-save (created on game start) and the manual save
      // to appear in the reactive RxDB-backed list before we snapshot the count.
      // Both are created asynchronously; we need ≥ 2 items so there is always
      // at least one left after deletion — avoiding a false "still 1" result when
      // the autosave appears concurrently with (or just after) the deletion.
      const modal = page.getByTestId("saves-modal");
      const listItems = modal.locator("li");
      await expect(async () => {
        expect(await listItems.count()).toBeGreaterThanOrEqual(2);
      }).toPass({ timeout: 10_000 });
      const countBefore = await listItems.count();

      // Click the delete (✕) button on the first save.
      // The save deletion shows a window.confirm — accept it.
      page.once("dialog", (dialog) => dialog.accept());
      await listItems
        .first()
        .getByRole("button", { name: /delete save/i })
        .click();

      // The list should have one fewer item after deletion.
      await expect(async () => {
        expect(await listItems.count()).toBeLessThan(countBefore);
      }).toPass({ timeout: 10_000 });
    });
  });

  // ── Import save form ───────────────────────────────────────────────────────

  test.describe("Import save form", () => {
    test("Import from text button is disabled when textarea is empty", async ({ page }) => {
      await startGameViaPlayBall(page, { seed: "modal5" });
      await openSavesModal(page);
      const importBtn = page.getByTestId("import-save-button");
      await expect(importBtn).toBeDisabled();
    });

    test("invalid JSON in import textarea shows an error message", async ({ page }) => {
      await startGameViaPlayBall(page, { seed: "modal6" });
      await openSavesModal(page);

      // Enter clearly invalid JSON.
      // fillAndDispatchInput ensures React's synthetic onChange fires on
      // WebKit, where Playwright's .fill() may not trigger it automatically.
      const importTextarea = page.getByTestId("import-save-textarea");
      await fillAndDispatchInput(importTextarea, "not-valid-json");
      await expect(page.getByTestId("import-save-button")).toBeEnabled({ timeout: 5_000 });
      await page.getByTestId("import-save-button").click();

      // An error message should appear inside the modal.
      await expect(page.getByTestId("import-error")).toBeVisible({ timeout: 5_000 });
    });
  });

  // ── Regression: load-from-modal autoplay + save ───────────────────────────
  //
  // These tests guard the two bugs fixed in this PR:
  //   1. The autoplay tick-chain died when a save was loaded via the in-game modal
  //      while the previous game was already finished (stale gameStateRef guard).
  //   2. Clicking "Save current game" after a modal load threw a DataCloneError
  //      because `dispatch` leaked into the stored state snapshot.

  test.describe("Modal load regression", () => {
    test("autoplay continues after loading a save from the in-game modal", async ({ page }) => {
      // Start a fresh game so the scheduler is running.
      await startGameViaPlayBall(page, { seed: "regr-autoplay" });
      await waitForLogLines(page, 5);

      // Snapshot the log entry count before the modal load.
      const linesBefore = await page
        .getByTestId("play-by-play-log")
        .locator("[data-log-index]")
        .count();

      // Import + auto-load an in-progress fixture via the in-game saves modal.
      await importSaveFromFixture(page, "sample-save.json");

      // After the modal load the scheduler must resume — new log entries must
      // appear within a reasonable timeout.
      await expect(async () => {
        const linesAfter = await page
          .getByTestId("play-by-play-log")
          .locator("[data-log-index]")
          .count();
        expect(linesAfter).toBeGreaterThan(linesBefore);
      }).toPass({ timeout: 20_000 });
    });

    test("saving after loading from the in-game modal succeeds without DataCloneError", async ({
      page,
    }) => {
      // Start a fresh game, then load a different save via the in-game modal.
      await startGameViaPlayBall(page, { seed: "regr-dataclone" });
      await waitForLogLines(page, 5);
      await importSaveFromFixture(page, "sample-save.json");

      // Open the saves modal and trigger a save of the restored game.
      // If dispatch leaked into the stored snapshot this would throw DataCloneError
      // and the log would show "Failed to save game: …" instead of "Game saved!".
      await openSavesModal(page);
      await page.getByTestId("save-game-button").click();

      await expect(page.getByTestId("play-by-play-log")).toContainText("Game saved!", {
        timeout: 10_000,
      });
      const logText = await page.getByTestId("play-by-play-log").textContent();
      expect(logText).not.toContain("Failed to save game");
    });

    // This test uses the exact save + teams that the user reported in the PR comment
    // (Boston Pioneers vs Portland Dynamo, Inning 8). Both teams must be imported first
    // because importRxdbSave validates that referenced custom teams exist locally.
    test("exact user-reported save loads and autoplay resumes (regression: inning-8 custom teams)", async ({
      page,
    }) => {
      // Import the custom teams referenced by the user's save before starting any game.
      await resetAppState(page);
      await importTeamsFixture(page, "pr-regression-teams.json");

      // Start a game with fixture teams so the scheduler is running.
      await startGameViaPlayBall(page, { seed: "regr-pr-save" });
      await waitForLogLines(page, 5);

      const linesBefore = await page
        .getByTestId("play-by-play-log")
        .locator("[data-log-index]")
        .count();

      // Load the exact user-reported inning-8 save via the in-game modal.
      await importSaveFromFixture(page, "pr-regression-inning8-save.json");

      // Autoplay must resume after the modal load.
      await expect(async () => {
        const linesAfter = await page
          .getByTestId("play-by-play-log")
          .locator("[data-log-index]")
          .count();
        expect(linesAfter).toBeGreaterThan(linesBefore);
      }).toPass({ timeout: 20_000 });

      // Saving must also succeed without DataCloneError.
      await openSavesModal(page);
      await page.getByTestId("save-game-button").click();
      await expect(page.getByTestId("play-by-play-log")).toContainText("Game saved!", {
        timeout: 10_000,
      });
    });
  });
});
