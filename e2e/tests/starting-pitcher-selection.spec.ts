/**
 * Starting Pitcher Selection — E2E tests for the pregame pitcher selector.
 *
 * Covers:
 * 1. Pitcher selector is absent when no team is managed
 * 2. Pitcher selector appears for the managed team in a custom game
 * 3. Selector only shows SP-eligible pitchers (SP or SP/RP roles)
 * 4. Selecting a starter and starting the game applies the chosen pitcher
 */
import { expect, test } from "@playwright/test";

import {
  disableAnimations,
  resetAppState,
  waitForLogLines,
  waitForNewGameDialog,
} from "../utils/helpers";

/** Helper: create and save a custom team, then return to the home screen. */
async function createAndSaveTeam(
  page: Parameters<typeof resetAppState>[0],
  name: string,
): Promise<void> {
  await page.getByTestId("home-manage-teams-button").click();
  await expect(page.getByTestId("manage-teams-screen")).toBeVisible({ timeout: 10_000 });
  await page.getByTestId("manage-teams-create-button").click();
  await expect(page.getByTestId("custom-team-name-input")).toBeVisible({ timeout: 5_000 });
  await page.getByTestId("custom-team-regenerate-defaults-button").click();
  await expect(page.getByTestId("custom-team-name-input")).not.toHaveValue("", {
    timeout: 3_000,
  });
  await page.getByTestId("custom-team-name-input").fill(name);
  await page.getByTestId("custom-team-save-button").click();
  await expect(page.getByText(name)).toBeVisible({ timeout: 5_000 });
  await page.getByTestId("manage-teams-back-button").click();
  await expect(page.getByTestId("home-screen")).toBeVisible({ timeout: 10_000 });
}

test.describe("Starting pitcher selector — New Game dialog", { tag: "@desktop-only" }, () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
    await disableAnimations(page);
  });

  test("pitcher selector is absent when no team is managed (just watch)", async ({ page }) => {
    await createAndSaveTeam(page, "SP Test Home 1");
    await createAndSaveTeam(page, "SP Test Away 1");

    await waitForNewGameDialog(page);
    await expect(
      page.getByTestId("new-game-custom-away-team-select").locator("option"),
    ).toHaveCount(2, { timeout: 5_000 });

    // "None — just watch" is the default; pitcher selector should not appear
    await expect(page.getByTestId("starting-pitcher-select")).not.toBeVisible();
  });

  test("pitcher selector appears for the managed team in a custom game", async ({ page }) => {
    await createAndSaveTeam(page, "SP Test Home 2");
    await createAndSaveTeam(page, "SP Test Away 2");

    await waitForNewGameDialog(page);
    await expect(
      page.getByTestId("new-game-custom-away-team-select").locator("option"),
    ).toHaveCount(2, { timeout: 5_000 });

    // Select managed away team
    await page.locator('input[name="managed"][value="0"]').check();

    // Pitcher selector should appear with at least one SP-eligible option.
    await expect(page.getByTestId("starting-pitcher-select")).toBeVisible({ timeout: 3_000 });
    const options = page.getByTestId("starting-pitcher-select").locator("option");
    const count = await options.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // Every option must be SP or SP/RP — pure RP pitchers must not appear.
    // Default rosters always include 3 RP relievers; this confirms they are filtered out.
    const optionTexts = await options.allTextContents();
    for (const text of optionTexts) {
      // Option format: "Name (role)" or just "Name" when role is unset.
      // A pure RP pitcher always renders as "Name (RP)".
      expect(text).not.toContain("(RP)");
    }
  });

  test("selecting a starter and starting the game applies the chosen pitcher", async ({ page }) => {
    await createAndSaveTeam(page, "SP Apply Home");
    await createAndSaveTeam(page, "SP Apply Away");

    await waitForNewGameDialog(page);
    await expect(
      page.getByTestId("new-game-custom-away-team-select").locator("option"),
    ).toHaveCount(2, { timeout: 5_000 });

    // Manage the away team and read all SP-eligible options.
    await page.locator('input[name="managed"][value="0"]').check();
    await expect(page.getByTestId("starting-pitcher-select")).toBeVisible({ timeout: 3_000 });

    // Read the options and capture the text of the first SP-eligible pitcher (the default
    // selected starter).  Default rosters always place the sole SP at index 0, so the first
    // option is always the SP.  We store the name to assert it appears in the SubstitutionPanel
    // after the game starts.
    const options = page.getByTestId("starting-pitcher-select").locator("option");
    const firstOptionText = await options.first().textContent();
    // Strip the role suffix "(SP)" to get the bare pitcher name for the UI assertion below.
    const chosenPitcherName = (firstOptionText ?? "").replace(/\s*\([^)]*\)\s*$/, "").trim();
    expect(chosenPitcherName).toBeTruthy();

    // Start the game with the chosen (default) starter.
    await page.getByTestId("seed-input").fill("sp-select1");
    await page.getByTestId("play-ball-button").click();
    await expect(page.getByTestId("scoreboard")).toBeVisible({ timeout: 15_000 });
    await waitForLogLines(page, 2);

    // Enable manager mode so the Substitution button is rendered, then open the panel
    // to confirm "Current:" shows the pitcher we selected pregame.
    await page.getByTestId("manager-mode-toggle").check();
    await page.getByRole("button", { name: "Substitution" }).click();
    await expect(page.getByTestId("substitution-panel")).toBeVisible({ timeout: 5_000 });

    // The panel shows "Current: <pitcher name>" in the Pitching Change section.
    await expect(page.getByTestId("substitution-panel")).toContainText(
      `Current: ${chosenPitcherName}`,
    );
  });
});
