import { expect, test } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

import {
  importSaveFromFixture,
  importTeamsFixture,
  openSavesModal,
  resetAppState,
  startGameViaPlayBall,
  waitForLogLines,
} from "../utils/helpers";

test.describe("Import Save", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  test("importing a save fixture auto-loads the game and save appears in list", async ({
    page,
  }) => {
    await startGameViaPlayBall(page, { seed: "importsetup" });
    await expect(page.getByTestId("scoreboard")).toBeVisible({ timeout: 10_000 });

    // Import auto-loads and closes the modal
    await importSaveFromFixture(page, "sample-save.json");
    await expect(page.getByTestId("scoreboard")).toBeVisible({ timeout: 10_000 });

    // Reopen modal and confirm save is in the list
    await openSavesModal(page);
    await expect(
      page.getByTestId("saves-modal").getByText("Visitors vs Locals").first(),
    ).toBeVisible({
      timeout: 10_000,
    });
  });

  test("importing a save auto-loads and game becomes active", async ({ page }) => {
    await startGameViaPlayBall(page, { seed: "importme" });
    await waitForLogLines(page, 3);

    // Import auto-loads and closes the modal
    await importSaveFromFixture(page, "sample-save.json");
    await expect(page.getByTestId("scoreboard")).toBeVisible({ timeout: 10_000 });
  });

  test("importing a save via paste JSON on /saves page loads the game", async ({ page }) => {
    const fixturePath = path.resolve(__dirname, "../fixtures/sample-save.json");
    const fixtureJson = fs.readFileSync(fixturePath, "utf8");

    // Fixture teams must exist before importing the save.
    await importTeamsFixture(page, "fixture-teams.json");

    // Navigate to /saves via Home → Load Saved Game
    await page.getByTestId("home-load-saves-button").click();
    await expect(page.getByTestId("saves-page")).toBeVisible({ timeout: 10_000 });

    // Paste the fixture JSON into the textarea and click Import
    const pasteTextareaEl = page.getByTestId("paste-save-textarea");
    await pasteTextareaEl.fill(fixtureJson);
    await pasteTextareaEl.dispatchEvent("input");
    await page.getByTestId("paste-save-button").click();

    // The import auto-loads the save and navigates to /game
    await expect(page.getByTestId("scoreboard")).toBeVisible({ timeout: 15_000 });
  });

  test("paste import shows error for invalid JSON on /saves page", async ({ page }) => {
    await page.getByTestId("home-load-saves-button").click();
    await expect(page.getByTestId("saves-page")).toBeVisible({ timeout: 10_000 });

    // dispatchEvent("input") ensures React's synthetic onChange fires on WebKit.
    const pasteInvalidTextarea = page.getByTestId("paste-save-textarea");
    await pasteInvalidTextarea.fill("not valid json");
    await pasteInvalidTextarea.dispatchEvent("input");
    await page.getByTestId("paste-save-button").click();

    // Increased from 5 s → 10 s: mobile WebKit on CI can be slow to propagate
    // the synchronous JSON.parse error back through the React state update.
    await expect(page.getByTestId("import-error")).toBeVisible({ timeout: 10_000 });
  });
});
