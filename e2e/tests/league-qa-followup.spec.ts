import { expect, type Page, test } from "@playwright/test";

import { importTeamsFixture, resetAppState } from "../utils/helpers";

const createAutogenSeason = async (page: Page): Promise<void> => {
  await page.goto("/leagues");
  await expect(page.getByTestId("leagues-hub")).toBeVisible({ timeout: 15_000 });
  await page.getByTestId("hub-start-autogen").click();
  await expect(page.getByRole("button", { name: /next →/i })).toBeVisible({ timeout: 15_000 });

  for (let step = 1; step <= 5; step++) {
    await page.getByRole("button", { name: /next →/i }).click();
  }

  await page.getByTestId("create-season-button").click();
  await expect(page).toHaveURL(/\/leagues\/[^/]+$/, { timeout: 20_000 });
  await expect(page.getByTestId("season-home")).toBeVisible({ timeout: 15_000 });
};

const createMixedManagedSeason = async (page: Page): Promise<void> => {
  await importTeamsFixture(page, "fixture-teams.json", { minTeams: 2 });
  await page.goto("/leagues/new");
  await expect(page.getByRole("button", { name: /next →/i })).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: /next →/i }).click();

  await page.getByLabel("Mixed").check();
  const firstTeamCheckbox = page
    .locator("input[type='checkbox']")
    .filter({ hasNot: page.locator("[disabled]") })
    .first();
  await firstTeamCheckbox.check();

  for (let step = 2; step <= 5; step++) {
    await page.getByRole("button", { name: /next →/i }).click();
  }

  const managedSelect = page.getByTestId("managed-team-select");
  await expect(managedSelect).toBeVisible({ timeout: 10_000 });
  const managedTeamValue = await managedSelect.locator("option").nth(1).getAttribute("value");
  if (!managedTeamValue) throw new Error("Expected at least one managed-team option in mixed mode");
  await managedSelect.selectOption(managedTeamValue);

  await page.getByTestId("create-season-button").click();
  await expect(page).toHaveURL(/\/leagues\/[^/]+$/, { timeout: 20_000 });
  await expect(page.getByTestId("season-home")).toBeVisible({ timeout: 15_000 });
};

test.describe("League v1 QA follow-up regressions", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  test(
    "watch launches are spectator-only with no manager controls",
    { tag: "@league" },
    async ({ page }) => {
      await createAutogenSeason(page);

      await page.getByTestId("season-nav-schedule").click();
      await expect(page.getByTestId("season-schedule")).toBeVisible({ timeout: 15_000 });

      const watchButton = page.locator("[data-testid^='watch-game-']").first();
      await expect(watchButton).toBeVisible({ timeout: 15_000 });
      await watchButton.click();

      await expect(page.getByTestId("scoreboard")).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId("manager-mode-toggle")).not.toBeVisible();
    },
  );

  test(
    "mixed-mode review requires explicit managed-team selection",
    { tag: "@league" },
    async ({ page }) => {
      await importTeamsFixture(page, "fixture-teams.json", { minTeams: 2 });
      await page.goto("/leagues/new");
      await expect(page.getByRole("button", { name: /next →/i })).toBeVisible({ timeout: 15_000 });

      await page.getByRole("button", { name: /next →/i }).click();
      await page.getByLabel("Mixed").check();
      await page.locator("input[type='checkbox']").first().check();

      for (let step = 2; step <= 5; step++) {
        await page.getByRole("button", { name: /next →/i }).click();
      }

      await expect(page.getByTestId("managed-team-select")).toBeVisible();
      await expect(page.getByTestId("create-season-button")).toBeDisabled();
      await expect(page.getByText("Please select which team you will manage.")).toBeVisible();
    },
  );

  test(
    "managed-team next-game-ready branch exposes auto-simulate action",
    { tag: "@league" },
    async ({ page }) => {
      await createMixedManagedSeason(page);

      await page.getByTestId("simulate-day-button").click();
      await expect(page.getByTestId("next-game-ready-msg")).toBeVisible({ timeout: 20_000 });
      await expect(page.getByTestId("auto-sim-next-game-button")).toBeVisible({ timeout: 10_000 });

      await page.getByTestId("auto-sim-next-game-button").click();
      await expect(page.getByTestId("season-home")).toBeVisible({ timeout: 15_000 });
    },
  );
});
