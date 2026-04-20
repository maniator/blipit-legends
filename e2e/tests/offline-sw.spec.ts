import { expect, test } from "@playwright/test";

import { resetAppState } from "../utils/helpers";

test.describe("Offline — service worker navigation fallback", { tag: "@desktop-only" }, () => {
  test.afterEach(async ({ context }) => {
    await context.setOffline(false);
  });

  test("navigates offline to a client-side route and renders app shell", async ({
    page,
    context,
  }) => {
    test.setTimeout(60_000);

    // Step 1: Load the app while online so the SW installs, activates, and precaches all assets
    await resetAppState(page);

    // Step 2: Wait for the SW to be active (ready resolves once SW is activated).
    // Use .then(() => true) so Playwright receives a JSON-serializable boolean
    // instead of a non-serializable ServiceWorkerRegistration object.
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));

    // Step 3: Reload so the SW claims the page and navigator.serviceWorker.controller
    // is set; then wait until controller is non-null before proceeding.
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

    // Step 4: Switch to offline mode
    await context.setOffline(true);

    // Step 5: Navigate directly to a client-side route while offline
    await page.goto("/exhibition/new", { waitUntil: "domcontentloaded" });

    // Step 6: Assert the app shell rendered (not a network error page)
    await expect(page.getByTestId("exhibition-setup-page")).toBeVisible({ timeout: 15_000 });
  });
});
