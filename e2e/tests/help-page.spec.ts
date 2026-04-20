/**
 * Regression tests for the Help page (/help) — specifically guards against
 * the mobile scrolling regression where flex children shrank to fit the fixed
 * 100dvh container height, making long content unscrollable.
 *
 * The "container scrollable" and "body overflow" tests are mobile-only because
 * on desktop the page uses normal document flow (min-height, no fixed height)
 * so the body scrolls naturally.  On mobile (≤768 px) body has overflow:hidden
 * and the PageContainer must act as the scroll container.
 */

import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

import { disableAnimations, resetAppState } from "../utils/helpers";

/** Mobile project names — viewports ≤ 768 px where PageContainer scrolls. */
/** Open every closed <details> in the help page and wait until all 9 are open. */
async function expandAllSections(page: Page): Promise<void> {
  const closedSummaries = page.locator('[data-testid="help-page"] details:not([open]) > summary');
  while ((await closedSummaries.count()) > 0) {
    await closedSummaries.first().click();
  }
  await expect(page.locator('[data-testid="help-page"] details[open]')).toHaveCount(9);
}

test.describe("Help page — all sections present", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
    await disableAnimations(page);
    await page.getByTestId("home-help-button").click();
    await expect(page.getByTestId("help-page")).toBeVisible({ timeout: 10_000 });
  });

  test("all 9 accordion sections are present", async ({ page }) => {
    const sections = page.locator('[data-testid="help-page"] details');
    await expect(sections).toHaveCount(9);
  });

  test("all sections can be expanded and show content", async ({ page }) => {
    await expandAllSections(page);
    // After expanding, every section body must have visible list items.
    const listItems = page.locator('[data-testid="help-page"] details[open] li');
    await expect(listItems.first()).toBeVisible();
    const count = await listItems.count();
    expect(count).toBeGreaterThan(0);
  });
});

test.describe("Help page — mobile scrollability regression", { tag: "@mobile-only" }, () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
    await disableAnimations(page);
    await page.getByTestId("home-help-button").click();
    await expect(page.getByTestId("help-page")).toBeVisible({ timeout: 10_000 });
  });

  /**
   * On mobile (≤768 px) body has overflow:hidden.  The PageContainer must be
   * the scroll container (scrollHeight > clientHeight) rather than squishing
   * its flex children into the fixed 100dvh height.
   *
   * Before the fix, flex-shrink:1 caused children to compress to fit 100dvh,
   * so scrollHeight == clientHeight and scrolling was impossible.
   */
  test("PageContainer is scrollable when all sections are expanded", async ({ page }) => {
    await expandAllSections(page);

    const helpPage = page.getByTestId("help-page");
    const { scrollHeight, clientHeight } = await helpPage.evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }));

    // Container must overflow and be scrollable.
    expect(scrollHeight).toBeGreaterThan(clientHeight);
  });

  /**
   * Confirms the PageContainer can actually be scrolled on mobile after all
   * sections are expanded — scrollTop advances from 0, proving the container
   * is the scroll host.
   */
  test("can scroll PageContainer to the bottom with all sections open", async ({ page }) => {
    await expandAllSections(page);

    const helpPage = page.getByTestId("help-page");
    await helpPage.evaluate((el) => el.scrollTo(0, el.scrollHeight));

    const scrollTop = await helpPage.evaluate((el) => el.scrollTop);
    expect(scrollTop).toBeGreaterThan(0);
  });

  /**
   * On mobile the body must not grow to fit expanded content.
   * body { overflow: hidden } is applied at ≤768 px, so body.scrollHeight
   * must stay at or near window.innerHeight.
   */
  test("body does not grow beyond viewport when all sections are open", async ({ page }) => {
    await expandAllSections(page);

    const { bodyScrollHeight, viewportHeight } = await page.evaluate(() => ({
      bodyScrollHeight: document.body.scrollHeight,
      viewportHeight: window.innerHeight,
    }));

    // 2px tolerance for sub-pixel rounding.
    expect(bodyScrollHeight).toBeLessThanOrEqual(viewportHeight + 2);
  });
});
