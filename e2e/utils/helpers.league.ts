import { expect, type Page } from "@playwright/test";

import { resetAppState } from "./helpers.core";
import { importTeamsFixture } from "./helpers.flows";

/**
 * Advances through one wizard step by clicking the stable "wizard-next-button"
 * testid and waiting for the button to re-enable (next step rendered).
 */
async function advanceWizardStep(page: Page): Promise<void> {
  const nextBtn = page.getByTestId("wizard-next-button");
  await expect(nextBtn).toBeEnabled({ timeout: 10_000 });
  await nextBtn.click();
  // Brief pause for step transition; avoids double-click on rapid mobile renders.
  await page.waitForTimeout(200);
}

/**
 * Navigates to /leagues, starts an all-autogen season via the wizard, and
 * lands on the season home page.
 */
export async function createAutogenSeason(page: Page): Promise<void> {
  await resetAppState(page);
  await page.goto("/leagues");
  await expect(page.getByTestId("leagues-hub")).toBeVisible({ timeout: 15_000 });

  await page.getByTestId("hub-start-autogen").click();
  await expect(page).toHaveURL(/\/leagues\/new/, { timeout: 15_000 });

  // Wait for the DB-backed wizard to finish loading and show the Next button.
  await expect(page.getByTestId("wizard-next-button")).toBeVisible({ timeout: 15_000 });

  // Steps 1–4: advance through each step.
  // STEP_ORDER = [1, 2, 3, 5, 6] — step 4 was removed; 4 Next clicks reach Review.
  for (let step = 1; step <= 4; step++) {
    await advanceWizardStep(page);
  }

  // Step 6 (review): click Create Season.
  await expect(page.getByTestId("create-season-button")).toBeEnabled({ timeout: 10_000 });
  await page.getByTestId("create-season-button").click();

  await expect(page).toHaveURL(/\/leagues\/[^/]+$/, { timeout: 20_000 });
  await expect(page.getByTestId("season-home")).toBeVisible({ timeout: 15_000 });
}

/**
 * Imports fixture teams, then creates a mixed-mode managed season via the
 * wizard, landing on the season home page with a user-managed team set.
 */
export async function createMixedManagedSeason(page: Page): Promise<void> {
  await importTeamsFixture(page, "fixture-teams.json", { minTeams: 2 });
  await page.goto("/leagues/new");
  await expect(page).toHaveURL(/\/leagues\/new/, { timeout: 15_000 });

  // Wait for wizard to be ready.
  await expect(page.getByTestId("wizard-next-button")).toBeVisible({ timeout: 15_000 });

  // Step 1 → Step 2.
  await advanceWizardStep(page);

  // Step 2: select "Mixed" mode, then pick at least one team.
  const mixedRadio = page.locator('input[type="radio"][name="teamMode"][value="mixed"]');
  if (await mixedRadio.count()) {
    await mixedRadio.check();
  } else {
    // Fallback: find by label text.
    await page.getByRole("radio", { name: /mixed/i }).check();
  }

  // Check the first available custom-team checkbox.
  const firstCheckbox = page.locator('input[type="checkbox"]').first();
  await expect(firstCheckbox).toBeVisible({ timeout: 5_000 });
  await firstCheckbox.check();

  // Steps 2–4: advance through remaining steps.
  // STEP_ORDER = [1, 2, 3, 5, 6] — after the manual step 1→2 advance above,
  // 3 more Next clicks are needed: 2→3, 3→5, 5→6 (Review).
  for (let step = 2; step <= 4; step++) {
    await advanceWizardStep(page);
  }

  // Step 6 (review): select managed team before creating.
  const managedSelect = page.getByTestId("managed-team-select");
  await expect(managedSelect).toBeVisible({ timeout: 10_000 });
  const firstOption = managedSelect.locator("option").nth(1);
  const managedTeamValue = await firstOption.getAttribute("value");
  if (!managedTeamValue) throw new Error("Expected at least one managed-team option in mixed mode");
  await managedSelect.selectOption(managedTeamValue);

  await expect(page.getByTestId("create-season-button")).toBeEnabled({ timeout: 10_000 });
  await page.getByTestId("create-season-button").click();

  await expect(page).toHaveURL(/\/leagues\/[^/]+$/, { timeout: 20_000 });
  await expect(page.getByTestId("season-home")).toBeVisible({ timeout: 15_000 });
}
