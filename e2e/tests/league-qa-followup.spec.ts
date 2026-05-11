import { expect, test } from "@playwright/test";

import { importTeamsFixture, resetAppState } from "../utils/helpers";
import { createAutogenSeason, createMixedManagedSeason } from "../utils/helpers.league";

// ---------------------------------------------------------------------------
// P0-1: watch-mode launches must not expose manager controls
// ---------------------------------------------------------------------------

test.describe("League QA — watch-mode spectator gating", () => {
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
      // Spectator sessions must never show the manager-mode toggle.
      await expect(page.getByTestId("manager-mode-toggle")).not.toBeVisible();
    },
  );
});

// ---------------------------------------------------------------------------
// P0-3/P0-4: mixed-mode wizard must enforce explicit managed-team selection
// ---------------------------------------------------------------------------

test.describe("League QA — mixed-mode wizard validation", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  test(
    "mixed-mode review step requires explicit managed-team selection before create",
    { tag: "@league" },
    async ({ page }) => {
      await importTeamsFixture(page, "fixture-teams.json", { minTeams: 2 });
      await page.goto("/leagues/new");
      await expect(page).toHaveURL(/\/leagues\/new/, { timeout: 15_000 });

      // Wait for wizard to finish loading.
      const nextBtn = page.getByTestId("wizard-next-button");
      await expect(nextBtn).toBeEnabled({ timeout: 15_000 });

      // Advance to step 2 (Team Setup).
      await nextBtn.click();
      await page.waitForTimeout(200);

      // Switch to Mixed mode and pick one team.
      const mixedRadio = page.locator('input[type="radio"][name="teamMode"][value="mixed"]');
      if ((await mixedRadio.count()) > 0) {
        await mixedRadio.check();
      } else {
        await page.getByRole("radio", { name: /mixed/i }).check();
      }
      await page.locator('input[type="checkbox"]').first().check();

      // Advance through steps 2→4 (STEP_ORDER=[1,2,3,5,6]: after the step-1→2
      // click above, 3 more Next clicks land on Review: 2→3, 3→5, 5→6).
      for (let step = 2; step <= 4; step++) {
        await expect(page.getByTestId("wizard-next-button")).toBeEnabled({ timeout: 10_000 });
        await page.getByTestId("wizard-next-button").click();
        await page.waitForTimeout(200);
      }

      // Step 6 (review): managed-team select must be visible, Create must be disabled.
      await expect(page.getByTestId("managed-team-select")).toBeVisible({ timeout: 10_000 });
      await expect(page.getByTestId("create-season-button")).toBeDisabled();
      await expect(page.getByText("Please select which team you will manage.")).toBeVisible();
    },
  );
});

// ---------------------------------------------------------------------------
// P0-2: managed-team auto-sim action on next-game-ready branch
// ---------------------------------------------------------------------------

test.describe("League QA — managed auto-sim CTA", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  test(
    "managed-team next-game-ready branch exposes auto-simulate action",
    { tag: "@league" },
    async ({ page }) => {
      await createMixedManagedSeason(page);

      await page.getByTestId("simulate-day-button").click();
      await expect(page.getByTestId("next-game-ready-msg")).toBeVisible({ timeout: 20_000 });
      await expect(page.getByTestId("auto-sim-next-game-button")).toBeVisible({ timeout: 10_000 });

      await page.getByTestId("auto-sim-next-game-button").click();
      await expect(page.getByTestId("season-home")).toBeVisible({ timeout: 20_000 });
    },
  );
});
