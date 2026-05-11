import { expect, type Locator, type Page, test } from "@playwright/test";

import { resetAppState, saveCurrentGame, startGameViaPlayBall } from "../utils/helpers";

const assertPseudoInsetAndEdgeProbe = async (
  page: Page,
  locator: Locator,
  minInsetPx: number,
): Promise<void> => {
  await expect(locator).toBeVisible({ timeout: 15_000 });

  const inset = await locator.evaluate((el) => {
    const s = window.getComputedStyle(el, "::before");
    return {
      top: Number.parseFloat(s.top || "0"),
      left: Number.parseFloat(s.left || "0"),
    };
  });
  expect(inset.top).toBeLessThanOrEqual(-minInsetPx);
  expect(inset.left).toBeLessThanOrEqual(-minInsetPx);

  const box = await locator.boundingBox();
  expect(box).toBeTruthy();
  if (!box) return;

  await locator.evaluate((el) => {
    const w = window as Window & { __tapProbeCount?: number };
    w.__tapProbeCount = 0;
    const handler = (event: Event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      w.__tapProbeCount = (w.__tapProbeCount ?? 0) + 1;
    };
    el.addEventListener("click", handler, { capture: true, once: true });
  });

  const edgeProbeOffset = Math.max(1, Math.floor(minInsetPx / 2));
  await page.mouse.click(box.x + box.width + edgeProbeOffset, box.y + box.height / 2);
  const clickCount = await page.evaluate(() => {
    const w = window as Window & { __tapProbeCount?: number };
    return w.__tapProbeCount ?? 0;
  });
  expect(clickCount).toBe(1);
};

test.describe("touch target hit expansion", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  test("expands help and instructions close icon hit areas via ::before", async ({ page }) => {
    await startGameViaPlayBall(page, { seed: "touch-target-help" });

    const helpButton = page.getByTestId("instructions-help-button");
    await assertPseudoInsetAndEdgeProbe(page, helpButton, 5);

    await helpButton.click();
    await expect(page.getByTestId("instructions-modal")).toBeVisible();

    const closeButton = page.getByTestId("instructions-close-button");
    await assertPseudoInsetAndEdgeProbe(page, closeButton, 8);
  });

  test("expands save-slot action button hit areas via ::before", async ({ page }) => {
    await startGameViaPlayBall(page, { seed: "touch-target-saves" });
    await saveCurrentGame(page);

    await assertPseudoInsetAndEdgeProbe(page, page.getByTestId("load-save-button").first(), 6);
    await assertPseudoInsetAndEdgeProbe(page, page.getByTestId("export-save-button").first(), 6);
    await assertPseudoInsetAndEdgeProbe(page, page.getByTestId("delete-save-button").first(), 6);
  });
});
