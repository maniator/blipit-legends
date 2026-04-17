import { expect, test } from "@playwright/test";

import {
  loadFixture,
  resetAppState,
  startGameViaPlayBall,
  waitForLogLines,
} from "../utils/helpers";

test.describe("Manager Mode", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  test("Manager Mode toggle is visible after game starts", async ({ page }) => {
    await startGameViaPlayBall(page, { seed: "manager1" });
    const toggle = page.getByTestId("manager-mode-toggle");
    await expect(toggle).toBeVisible({ timeout: 10_000 });
  });

  test("enabling Manager Mode shows strategy selector", async ({ page }) => {
    await startGameViaPlayBall(page, { seed: "manager2" });
    const toggle = page.getByTestId("manager-mode-toggle");
    await expect(toggle).toBeVisible({ timeout: 10_000 });

    // Enable manager mode
    await toggle.check();
    await expect(toggle).toBeChecked();

    // Strategy selector should appear (contains "Balanced" option)
    await expect(page.getByRole("combobox").filter({ hasText: "Balanced" })).toBeVisible({
      timeout: 5_000,
    });
  });

  test("manager decision panel appears and action can be taken", async ({ page }) => {
    // Load a fixture that already has pendingDecision=defensive_shift and
    // managerMode=true — the panel is visible immediately, no autoplay wait needed.
    await loadFixture(page, "pending-decision.json");

    await expect(page.getByTestId("manager-decision-panel")).toBeVisible({ timeout: 10_000 });

    // Take the first available action button to resolve the decision.
    const actionButtons = page.getByTestId("manager-decision-panel").getByRole("button");
    await actionButtons.first().click();

    // Decision panel should close once the action is dispatched.
    await expect(page.getByTestId("manager-decision-panel")).not.toBeVisible({ timeout: 5_000 });
  });

  test("pinch hitter decision shows handedness matchup context", async ({ page }) => {
    await loadFixture(
      page,
      "pending-decision-pinch-hitter-handedness.json",
      "pending-decision-pinch-hitter-teams.json",
    );

    const panel = page.getByTestId("manager-decision-panel");
    await expect(panel).toBeVisible({ timeout: 10_000 });

    await expect(panel.getByText(/send up a pinch hitter vs RHP/i)).toBeVisible();
    await expect(panel.getByText(/current batter platoon edge:\s*-4%/i)).toBeVisible();
    await expect(panel.getByText(/selected hitter platoon edge:\s*\+6%/i)).toBeVisible();

    const pinchHitterSelect = page.getByTestId("pinch-hitter-select");
    // Option format: "Name (Pos) [C +N, P +N, PA N] [+N%]"
    // Assert per-option to avoid false positives from cross-option regex matching.
    const jLeeOption = pinchHitterSelect.locator("option").filter({ hasText: /^J\. Lee \(LF\)/ });
    const kPatelOption = pinchHitterSelect
      .locator("option")
      .filter({ hasText: /^K\. Patel \(DH\)/ });

    await expect(jLeeOption).toHaveCount(1);
    await expect(kPatelOption).toHaveCount(1);

    await expect(jLeeOption).toHaveText(/J\. Lee \(LF\).*PA 0.*\+6%/i);
    await expect(kPatelOption).toHaveText(/K\. Patel \(DH\).*PA 0.*-2%/i);
  });
});
