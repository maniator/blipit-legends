import { expect, test } from "@playwright/test";

import { disableAnimations, loadFixture, resetAppState } from "../../utils/helpers";

/**
 * Visual regression snapshots for the Manager Decision Panel.
 *
 * Uses pre-crafted save fixtures so the panel is visible immediately —
 * no autoplay or real-time game progression needed.
 * Restricted to desktop only.
 */

// ─── Manager decision panel ───────────────────────────────────────────────────
test.describe("Visual — Manager decision panel", { tag: "@desktop-only" }, () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
    await disableAnimations(page);
  });

  /**
   * Manager decision panel screenshot — captures the DecisionPanel UI that
   * appears when Manager Mode is active and a decision point is reached.
   *
   * Uses a pre-crafted save fixture (pending-decision.json) that already has
   * pendingDecision set to "defensive_shift", making this test instant instead
   * of waiting up to 120 s for autoplay to reach a decision point.
   *
   * Restricted to desktop because the panel layout is identical across viewports.
   */
  test("manager decision panel screenshot", async ({ page }) => {
    await loadFixture(page, "pending-decision.json");
    // The fixture has pendingDecision=defensive_shift and managerMode=true,
    // so the panel is visible immediately after load.
    await expect(page.getByTestId("manager-decision-panel")).toBeVisible({ timeout: 10_000 });

    // Snapshot just the decision panel itself so the screenshot is stable
    // regardless of what is happening in the scoreboard / log behind it.
    await expect(page.getByTestId("manager-decision-panel")).toHaveScreenshot(
      "manager-decision-panel.png",
      { maxDiffPixelRatio: 0.05 },
    );
  });
});

// ─── Pinch hitter player dropdown in Decision Panel ──────────────────────────
//
// Captures the player-selection dropdown inside the DecisionPanel when a
// pinch-hitter opportunity arises in a managed custom-team game.
// Uses a pre-crafted save fixture so the panel is visible immediately —
// no autoplay or real-time game progression needed.
// Restricted to desktop only.
test.describe(
  "Visual — Pinch hitter player dropdown in Decision Panel",
  { tag: "@desktop-only" },
  () => {
    test.beforeEach(async ({ page }) => {
      await resetAppState(page);
      await disableAnimations(page);
    });

    /**
     * Loads a fixture whose stateSnapshot has pendingDecision set to a
     * pinch_hitter decision with two named bench candidates.  Because the
     * fixture also carries managerMode=true, the DecisionPanel mounts
     * instantly and shows the player-selection dropdown.
     */
    test("pinch hitter player dropdown visible in Decision Panel (desktop)", async ({ page }) => {
      await loadFixture(
        page,
        "pending-decision-pinch-hitter.json",
        "pending-decision-pinch-hitter-teams.json",
      );
      // The fixture has pendingDecision=pinch_hitter with candidates, so the
      // player-selection dropdown is visible immediately after load.
      await expect(page.getByTestId("pinch-hitter-select")).toBeVisible({ timeout: 10_000 });

      // Snapshot the decision panel with the dropdown visible.
      await expect(page.getByTestId("manager-decision-panel")).toHaveScreenshot(
        "manager-decision-panel-pinch-hitter-dropdown.png",
        { maxDiffPixelRatio: 0.05 },
      );
    });
  },
);
