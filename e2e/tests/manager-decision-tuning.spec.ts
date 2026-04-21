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
 * Uses the `pending-decision.json` fixture which already has `managerMode=true`,
 * so the Decision Tuning toggle is mounted immediately — no autoplay required.
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
    // Each TouchTooltip renders a <button> whose aria-label is the tooltip body
    // text.  We target two specific tooltips by aria-label prefix:
    //   • "Minimum steal success % …"  →  next to "Steal offer threshold"
    //   • "Offer / attempt sacrifice bunt …"  →  next to "Sacrifice bunt"
    const stealTooltip = page.getByRole("button", {
      name: /^Minimum steal success % for you to be prompted/,
    });
    const buntTooltip = page.getByRole("button", {
      name: /^Offer \/ attempt sacrifice bunt/,
    });

    await expect(stealTooltip).toBeVisible();
    await expect(buntTooltip).toBeVisible();

    // Helper: park the cursor at the top-left so the desktop `:hover`
    // CSS rule on the Bubble does not keep a popover visible after we
    // click-to-toggle on a hover-capable device. The mobile projects are
    // unaffected (no hover state); calling this is a no-op there.
    const clearHover = () => page.mouse.move(0, 0);

    // ── Initial state ──────────────────────────────────────────────────────
    await clearHover();
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
    await clearHover();
    await expect(stealTooltip).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByRole("tooltip").filter({ visible: true })).toHaveCount(0);

    // ── Open the steal tooltip, then open the bunt one — steal should close ─
    await stealTooltip.click();
    await expect(stealTooltip).toHaveAttribute("aria-expanded", "true");

    await buntTooltip.click();
    await clearHover();
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
    await slider.fill("80");
    await expect(sliderValue).toHaveText("80%");

    await expect(stealToggle).toBeChecked();
    await stealToggle.uncheck();
    await expect(stealToggle).not.toBeChecked();

    // ── Reset and verify defaults restored ─────────────────────────────────
    await resetButton.click();

    // Default `stealMinOfferPct` is 72 (see DEFAULT_MANAGER_DECISION_VALUES).
    await expect(sliderValue).toHaveText("72%");
    await expect(slider).toHaveValue("72");
    await expect(stealToggle).toBeChecked();
  });
});
