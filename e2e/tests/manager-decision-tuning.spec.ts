import { expect, test } from "@playwright/test";

import { loadFixture, resetAppState } from "../utils/helpers";

/**
 * E2E coverage for the Manager Mode → Decision Tuning panel:
 *
 *   1. The new TouchTooltip ⓘ buttons toggle their popovers on tap and behave
 *      correctly across mobile + desktop projects (tap = click = toggle).
 *      Opening a second tooltip closes the first.
 *
 *   2. The "Reset to defaults" button restores both slider values and toggle
 *      states to their `DEFAULT_MANAGER_DECISION_VALUES`.
 *
 * All selectors are `data-testid` / `aria-label` based so the test is robust
 * to copy edits.
 *
 * Uses the `pending-decision.json` fixture which has `managerMode=true`.
 * Note: the Decision Tuning toggle is always visible regardless of Manager Mode
 * (it controls AI behavior too), so no autoplay is required.
 */
test.describe("Manager Mode — Decision Tuning panel", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
    await loadFixture(page, "pending-decision.json");

    // Expand the Decision Tuning panel.
    const tuningToggle = page.getByTestId("manager-decision-tuning-toggle");
    await expect(tuningToggle).toBeVisible({ timeout: 10_000 });
    await tuningToggle.click();
    await expect(page.getByTestId("manager-decision-tuning-panel")).toBeVisible({
      timeout: 5_000,
    });
  });

  test("TouchTooltip ⓘ buttons toggle on tap and only one is open at a time", async ({ page }) => {
    // TouchTooltip triggers now use a short generic aria-label ("More info"),
    // so we scope each one within its corresponding setting row label and
    // pick the adjacent ⓘ button.
    const tuningPanel = page.getByTestId("manager-decision-tuning-panel");
    const stealTooltip = tuningPanel
      .locator("label", { hasText: "Steal offer threshold" })
      .getByRole("button", { name: "More info" });
    const buntTooltip = tuningPanel
      .locator("label", { hasText: "Sacrifice bunt" })
      .getByRole("button", { name: "More info" });

    await expect(stealTooltip).toBeVisible();
    await expect(buntTooltip).toBeVisible();

    /**
     * Park the mouse cursor at (0, 0) so the desktop `:hover` CSS rule on the
     * tooltip Bubble (see `src/shared/components/TouchTooltip/styles.ts`) does
     * not keep a popover visible after we click-to-toggle the trigger on a
     * hover-capable device. Required only for desktop / tablet projects;
     * mobile projects have no hover state, so this is a no-op there.
     */
    const moveCursorAwayToClearHover = () => page.mouse.move(0, 0);

    // ── Initial state ──────────────────────────────────────────────────────
    await moveCursorAwayToClearHover();
    await expect(stealTooltip).toHaveAttribute("aria-expanded", "false");
    await expect(buntTooltip).toHaveAttribute("aria-expanded", "false");

    // The Bubble (`role="tooltip"`) is always in the DOM (CSS-controlled
    // visibility).  Assert that no tooltip popover is currently visible to
    // the user.
    await expect(page.getByRole("tooltip").filter({ visible: true })).toHaveCount(0);

    // ── Tap to open the steal tooltip ──────────────────────────────────────
    await stealTooltip.click();
    await expect(stealTooltip).toHaveAttribute("aria-expanded", "true");

    // The bubble for the just-clicked tooltip should be visible (via $open
    // state, independent of hover).
    await expect(stealTooltip.locator("xpath=following-sibling::*[@role='tooltip']")).toBeVisible();

    // A visible tooltip popover should now exist with the steal-related text.
    const visibleTooltips = page.getByRole("tooltip").filter({ visible: true });
    await expect(visibleTooltips).toHaveCount(1);
    await expect(visibleTooltips.first()).toContainText(/steal/i);

    // ── Tap again to close ─────────────────────────────────────────────────
    await stealTooltip.click();
    await moveCursorAwayToClearHover();
    await expect(stealTooltip).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByRole("tooltip").filter({ visible: true })).toHaveCount(0);

    // ── Open the steal tooltip, then open the bunt one — steal should close ─
    await stealTooltip.click();
    await expect(stealTooltip).toHaveAttribute("aria-expanded", "true");

    await buntTooltip.click();
    await moveCursorAwayToClearHover();
    await expect(buntTooltip).toHaveAttribute("aria-expanded", "true");
    await expect(stealTooltip).toHaveAttribute("aria-expanded", "false");

    // Only the bunt tooltip's bubble should be visible.
    const onlyBubble = page.getByRole("tooltip").filter({ visible: true });
    await expect(onlyBubble).toHaveCount(1);
    await expect(onlyBubble.first()).toContainText(/sacrifice bunt/i);
  });

  test("Reset to defaults restores slider and toggle values", async ({ page }) => {
    const slider = page.getByTestId("manager-steal-min-pct-slider");
    const sliderValue = page.getByTestId("manager-steal-min-pct-value");
    const stealToggle = page.getByTestId("steal-enabled-toggle");
    const resetButton = page.getByTestId("manager-decision-tuning-reset");

    // ── Mutate state away from defaults ────────────────────────────────────
    // Range inputs respond to `.fill()` with the desired numeric value.
    await slider.fill("70");
    await expect(sliderValue).toHaveText("70%");

    await expect(stealToggle).toBeChecked();
    await stealToggle.uncheck();
    await expect(stealToggle).not.toBeChecked();

    // ── Reset and verify defaults restored ─────────────────────────────────
    await resetButton.click();

    // Default `stealMinOfferPct` is 80 (raised from 72 in realism-tuning pass).
    await expect(sliderValue).toHaveText("80%");
    await expect(slider).toHaveValue("80");
    await expect(stealToggle).toBeChecked();
  });
});
