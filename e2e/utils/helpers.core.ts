import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Speed value that effectively pauses autoplay (9 999 999 ms/pitch).
 * Set via `page.addInitScript` before loading a fixture to prevent rapid
 * game re-renders from detaching UI elements during E2E test setup flows.
 */
export const EFFECTIVELY_PAUSED_SPEED = "9999999";
/** Default seed used by helper-driven game starts when a test does not provide one. */
export const DEFAULT_E2E_SEED = "e2e-fixed-seed";

/**
 * Clicks a locator using dispatchEvent inside a retry loop until `assertion`
 * passes. Pass a `guard` predicate to skip the click when it is not needed
 * (e.g. the target state is already reached).
 */
export async function dispatchClickUntil(
  locator: Locator,
  assertion: () => Promise<void>,
  options?: { guard?: () => Promise<boolean>; timeout?: number },
): Promise<void> {
  const timeout = options?.timeout ?? 30_000;
  await expect(async () => {
    const shouldClick = options?.guard ? await options.guard() : true;
    if (shouldClick) {
      try {
        await locator.dispatchEvent("click", {}, { timeout: 2_000 });
      } catch {
        // Element was mid-detach; retry loop will try again.
      }
    }
    await assertion();
  }).toPass({ timeout });
}

/**
 * Fills a textarea or input locator with `value` then dispatches a synthetic
 * `"input"` event. Required on WebKit headless runners where Playwright's
 * `.fill()` skips the native input event, causing React's controlled-component
 * `onChange` to never fire (import button stays disabled).
 */
export async function fillAndDispatchInput(locator: Locator, value: string): Promise<void> {
  await locator.fill(value);
  await locator.dispatchEvent("input");
}

/**
 * Registers an `addInitScript` that mutes announcement volume exactly once per
 * `Page` instance. Safe to call from any helper.
 */
export async function ensureMutedAnnouncementsInit(page: Page): Promise<void> {
  const typedPage = page as Page & { _ballgameAnnouncementInitAdded?: boolean };
  if (!typedPage._ballgameAnnouncementInitAdded) {
    await page.addInitScript(() => {
      localStorage.setItem("announcementVolume", "0");
    });
    typedPage._ballgameAnnouncementInitAdded = true;
  }
}

/**
 * Registers an `addInitScript` that suppresses demo-team seeding exactly once
 * per `Page` instance. Safe to call from any helper.
 */
export async function ensureDemoSeedSuppressed(page: Page): Promise<void> {
  const typedPage = page as Page & { _ballgameDemoSeedSuppressed?: boolean };
  if (!typedPage._ballgameDemoSeedSuppressed) {
    await page.addInitScript(() => {
      try {
        localStorage.setItem("ballgame:demoSeedDone", "1");
      } catch {
        // localStorage may be blocked in some browser security configurations.
      }
    });
    typedPage._ballgameDemoSeedSuppressed = true;
  }
}

/**
 * Navigates to the app root and waits for it to finish loading (DB ready).
 */
export async function resetAppState(page: Page): Promise<void> {
  await ensureMutedAnnouncementsInit(page);
  await ensureDemoSeedSuppressed(page);

  const home = page.getByTestId("home-screen");
  const loading = page.getByText("Loading game…");
  const debugConsole: string[] = [];
  const debugPageErrors: string[] = [];

  const onConsole = (message: { type: () => string; text: () => string }) => {
    if (debugConsole.length < 10) {
      debugConsole.push(`${message.type()}: ${message.text()}`);
    }
  };
  const onPageError = (error: Error) => {
    if (debugPageErrors.length < 10) {
      debugPageErrors.push(error.message);
    }
  };

  page.on("console", onConsole);
  page.on("pageerror", onPageError);

  try {
    const maxAttempts = 2;
    const runAttempt = async (attempt: number): Promise<void> => {
      await page.goto("/", { waitUntil: "domcontentloaded" });

      try {
        await expect(home.or(loading)).toBeVisible({ timeout: 30_000 });
        await expect(loading).not.toBeVisible({ timeout: 30_000 });
        await expect(home).toBeVisible({ timeout: 30_000 });
        return;
      } catch (err) {
        if (attempt >= maxAttempts - 1) {
          const url = page.url();
          const title = await page.title().catch(() => "<no-title>");
          const bodyText = await page
            .locator("body")
            .innerText()
            .then((txt) => txt.slice(0, 500))
            .catch(() => "<no-body-text>");
          const htmlSnippet = await page
            .content()
            .then((html) => html.slice(0, 1000))
            .catch(() => "<no-html>");

          const consoleLog = debugConsole.length > 0 ? `console=[${debugConsole.join("; ")}]` : "";
          const errorLog =
            debugPageErrors.length > 0 ? `errors=[${debugPageErrors.join("; ")}]` : "";

          throw new Error(
            `resetAppState failed after 2 attempts. url=${url} title=${title} body=${bodyText} html=${htmlSnippet} ${consoleLog} ${errorLog}`,
            { cause: err as Error },
          );
        }
        await page.waitForTimeout(500);
        await runAttempt(attempt + 1);
      }

      return;
    };

    await runAttempt(0);
  } finally {
    page.off("console", onConsole);
    page.off("pageerror", onPageError);
  }
}

export async function openNewGameDialog(page: Page): Promise<void> {
  await waitForNewGameDialog(page);
}

/**
 * Waits until New Game setup UI is visible.
 */
export async function waitForNewGameDialog(page: Page): Promise<void> {
  const setupUi = page.getByTestId("exhibition-setup-page").or(page.getByTestId("new-game-dialog"));

  await expect(page.getByTestId("home-screen").or(setupUi)).toBeVisible({ timeout: 15_000 });

  const homeVisible = await page.getByTestId("home-screen").isVisible();
  const setupVisible = await setupUi.isVisible();
  if (homeVisible && !setupVisible) {
    await page.getByTestId("home-new-game-button").click();
    await expect(page.getByText("Loading game…")).not.toBeVisible({ timeout: 15_000 });
  }

  await expect(setupUi).toBeVisible({ timeout: 15_000 });
}

export async function closeNewGameDialog(page: Page): Promise<void> {
  if (await page.getByTestId("exhibition-setup-page").isVisible()) {
    await page.getByTestId("new-game-back-home-button").click();
    await expect(page.getByTestId("exhibition-setup-page")).not.toBeVisible({ timeout: 15_000 });
  } else {
    await page.evaluate(() => {
      const dialog = document.querySelector(
        '[data-testid="new-game-dialog"]',
      ) as HTMLDialogElement | null;
      dialog?.close();
    });
    await expect(page.getByTestId("new-game-dialog")).not.toBeVisible({ timeout: 15_000 });
  }
}

export interface GameConfig {
  seed?: string;
  managedTeam?: "0" | "1";
}

export async function configureNewGame(page: Page, options: GameConfig = {}): Promise<void> {
  await waitForNewGameDialog(page);

  if (options.seed !== undefined) {
    const seedField = page.getByTestId("seed-input");
    await seedField.clear();
    await seedField.fill(options.seed);
  }
  if (options.managedTeam !== undefined) {
    await page.locator(`input[name="managed"][value="${options.managedTeam}"]`).check();
  }
}

/**
 * Clicks a locator with retries (for transient visibility issues on slow browsers).
 * Waits for element to be visible, scrolls into view, and clicks. Retries on failure.
 */
export async function clickWithRetry(
  getLocator: () => ReturnType<Page["locator"]>,
  attempts = 3,
): Promise<void> {
  if (attempts < 1) {
    throw new Error(`clickWithRetry requires attempts >= 1 (received ${attempts})`);
  }

  let lastError: unknown;
  for (let i = 0; i < attempts; i += 1) {
    const locator = getLocator();
    try {
      await locator.waitFor({ state: "visible", timeout: 20_000 });
      await locator.scrollIntoViewIfNeeded();
      await locator.click({ timeout: 20_000 });
      return;
    } catch (error) {
      lastError = error;
      try {
        await locator.waitFor({ state: "attached", timeout: 20_000 });
      } catch {
        // Best effort: keep retrying even if the element does not reattach in time.
      }
      await locator.page().waitForTimeout(750);
    }
  }
  throw lastError;
}

/**
 * Locates the first table row that contains the provided player-name text.
 */
export function playerRow(page: Page, name: string) {
  return page.locator("tbody tr", { hasText: name }).first();
}

/**
 * Locates the player-link button inside the first matching player row.
 * The button must have an exact accessible name match to `name`.
 */
export function playerRowButton(page: Page, name: string) {
  return playerRow(page, name).getByRole("button", { name, exact: true });
}
