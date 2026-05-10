import { expect, test } from "@playwright/test";

import { resetAppState } from "../utils/helpers";

test.describe("League season creation", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  test("all-autogen flow creates a season and lands on season home", { tag: "@league" }, async ({
    page,
  }) => {
    await page.goto("/leagues");
    await expect(page.getByTestId("leagues-hub")).toBeVisible({ timeout: 15_000 });

    await page.getByTestId("hub-start-autogen").click();
    await expect(page.getByTestId("league-setup-wizard")).toBeVisible({ timeout: 15_000 });

    await page.getByTestId("create-season-button").click();

    await expect(page).toHaveURL(/\/leagues\/[^/]+$/, { timeout: 20_000 });
    await expect(page.getByTestId("season-home")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Something went wrong")).not.toBeVisible();
  });
});
