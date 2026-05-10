/**
 * Screenshot capture script for documentation purposes.
 * Captures desktop (1280x800) and mobile (390x844) viewports for key app pages.
 * Run with: PLAYWRIGHT_SCREENSHOTS=1 npx playwright test e2e/tests/take-screenshots.spec.ts --project=screenshots
 *
 * Output is written to docs/screenshots/.
 */

import { type BrowserContext, devices, expect, type Page, test } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

import {
  importHistoryFixture,
  loadFixture,
  resetAppState,
  startGameViaPlayBall,
  waitForLogLines,
} from "../utils/helpers";

// Output directory for screenshots
const SCREENSHOTS_DIR = path.join(process.cwd(), "docs", "screenshots");

// Ensure output directory exists
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

// Helper to take a screenshot and save it
async function captureScreenshot(page: Page, filename: string): Promise<void> {
  const outputPath = path.join(SCREENSHOTS_DIR, filename);
  await page.screenshot({ path: outputPath, fullPage: false });
  console.log(`✅ Saved: ${filename}`);
}

// ──────────────────────────────────────────────────────────────────────────────
// Each test creates fresh BrowserContext instances (one per viewport) via the
// Playwright `browser` fixture so IndexedDB/localStorage are fully isolated
// between screenshots.  The baseURL comes from the active Playwright project
// config so the spec works with any configured server without hardcoding.
// ──────────────────────────────────────────────────────────────────────────────

const VIEWPORTS = {
  desktop: { width: 1280, height: 800 },
  mobile: { width: 390, height: 844 },
} as const;

type ViewportName = keyof typeof VIEWPORTS;

// We only need the "screenshots" project to run (we control viewports ourselves).
// Use test.describe.configure to run tests serially so screenshots don't race.
test.describe.configure({ mode: "serial" });

test.describe("Documentation Screenshots", () => {
  let contexts: Map<ViewportName, BrowserContext> = new Map();
  let pages: Map<ViewportName, Page> = new Map();

  test.beforeEach(async ({ browser }, testInfo) => {
    const baseURL = testInfo.project.use.baseURL ?? "http://localhost:5173";
    contexts = new Map();
    pages = new Map();

    for (const [name, viewport] of Object.entries(VIEWPORTS) as [
      ViewportName,
      { width: number; height: number },
    ][]) {
      const ctx = await browser.newContext({
        viewport,
        ...(name === "mobile" ? { userAgent: devices["iPhone 15 Pro Max"].userAgent } : {}),
        baseURL,
        locale: "en-US",
      });
      // Disable CSS animations/transitions on every navigation in this context
      // so screenshots are stable (no mid-transition frames captured).
      await ctx.addInitScript(() => {
        document.addEventListener("DOMContentLoaded", () => {
          const style = document.createElement("style");
          style.textContent =
            "*, *::before, *::after { animation-duration: 0s !important; animation-delay: 0s !important; transition-duration: 0s !important; transition-delay: 0s !important; }";
          document.head.appendChild(style);
        });
      });
      // Mute announcement volume on every page load so the scheduler doesn't
      // wait up to 8 s for Web Speech API announcements between pitches.
      await ctx.addInitScript(() => {
        try {
          localStorage.setItem("announcementVolume", "0");
        } catch {
          // localStorage may be unavailable in some security contexts.
        }
      });
      const pg = await ctx.newPage();
      contexts.set(name, ctx);
      pages.set(name, pg);
    }
  });

  test.afterEach(async () => {
    for (const ctx of contexts.values()) {
      await ctx.close();
    }
  });

  // Helper to run for both viewports
  async function forBothViewports(
    fn: (page: Page, viewportName: ViewportName) => Promise<void>,
  ): Promise<void> {
    for (const name of ["desktop", "mobile"] as ViewportName[]) {
      const pg = pages.get(name)!;
      await fn(pg, name);
    }
  }

  // Navigate to "/" without suppressing demo-team seeding so screenshots
  // that need demo teams (New Game dialog, Manage Teams) see them populated.
  // Audio is already muted by the context-level init script in beforeEach.
  async function goHomeForDocs(page: Page): Promise<void> {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-testid='home-screen']", {
      state: "visible",
      timeout: 30_000,
    });
  }

  // ── 1. Home Screen ──────────────────────────────────────────────────────────
  test("1. Home screen", async () => {
    await forBothViewports(async (page, viewport) => {
      await resetAppState(page);
      await page.waitForSelector("[data-testid='home-screen']", {
        state: "visible",
        timeout: 30_000,
      });
      await captureScreenshot(page, `home-${viewport}.png`);
    });
  });

  // ── 2. New Game Dialog ──────────────────────────────────────────────────────
  test("2. New Game dialog", async () => {
    await forBothViewports(async (page, viewport) => {
      // Use goHomeForDocs (no demo-seed suppression) so the team selects show
      // the seeded Riverside Rockets / Lakewood Legends demo teams.
      await goHomeForDocs(page);
      await page.getByTestId("home-new-game-button").click();
      await page.waitForSelector("[data-testid='exhibition-setup-page']", {
        state: "visible",
        timeout: 15_000,
      });
      // Wait for demo teams to seed and auto-select in the custom-team selects.
      await page
        .getByTestId("new-game-custom-away-team-select")
        .waitFor({ state: "visible", timeout: 20_000 });
      await expect(page.getByTestId("new-game-custom-away-team-select")).not.toHaveValue("", {
        timeout: 10_000,
      });
      await captureScreenshot(page, `new-game-${viewport}.png`);
    });
  });

  // ── 3. In-game view ─────────────────────────────────────────────────────────
  test("3. In-game view (with play-by-play)", async () => {
    await forBothViewports(async (page, viewport) => {
      await startGameViaPlayBall(page, { seed: "abc123" });
      // Wait for some play-by-play entries to appear
      await waitForLogLines(page, 5, 60_000);
      // Try to expand the play-by-play log if there's a toggle
      const logToggle = page.getByRole("button", { name: /expand play-by-play/i });
      if (await logToggle.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await logToggle.click();
        // Wait until the log section is visible/expanded before screenshotting
        await page
          .getByTestId("play-by-play-log")
          .waitFor({ state: "visible", timeout: 5_000 })
          .catch(() => {});
      }
      await captureScreenshot(page, `in-game-${viewport}.png`);
    });
  });

  // ── 4. How to Play page ─────────────────────────────────────────────────────
  test("4. How to Play page", async () => {
    await forBothViewports(async (page, viewport) => {
      await resetAppState(page);
      await page.goto("/help", { waitUntil: "domcontentloaded" });
      await page.waitForSelector("[data-testid='help-page']", { state: "visible" });
      await captureScreenshot(page, `how-to-play-${viewport}.png`);
    });
  });

  // ── 5. Saves page ───────────────────────────────────────────────────────────
  test("5. Saves page", async () => {
    await forBothViewports(async (page, viewport) => {
      // Load a save fixture so the saves page shows an example save row instead
      // of the empty state.  loadFixture auto-navigates to /game after import;
      // we then navigate back to /saves to take the screenshot.
      await loadFixture(page, "sample-save.json");
      await page.goto("/saves", { waitUntil: "domcontentloaded" });
      await page.waitForSelector("[data-testid='saves-page']", { state: "visible" });
      await page.waitForSelector("[data-testid='saves-list-item']", {
        state: "visible",
        timeout: 10_000,
      });
      await captureScreenshot(page, `saves-${viewport}.png`);
    });
  });

  // ── 6. Career Stats page ────────────────────────────────────────────────────
  test("6. Career Stats page", async () => {
    await forBothViewports(async (page, viewport) => {
      // Start a game so the saves modal is accessible, then import the history
      // fixture to populate leaderboards and stat tables.
      await startGameViaPlayBall(page, { seed: "carstats" });
      await importHistoryFixture(page, "career-stats-history.json");
      await page.goto("/stats", { waitUntil: "domcontentloaded" });
      await page.waitForSelector("[data-testid='career-stats-page']", { state: "visible" });
      await captureScreenshot(page, `career-stats-${viewport}.png`);
    });
  });

  // ── 7a. Manage Teams page ───────────────────────────────────────────────────
  test("7a. Manage Teams page", async () => {
    await forBothViewports(async (page, viewport) => {
      // Use goHomeForDocs (no demo-seed suppression) so the team list shows the
      // seeded Riverside Rockets / Lakewood Legends demo teams.
      await goHomeForDocs(page);
      await page.goto("/teams", { waitUntil: "domcontentloaded" });
      await page.waitForSelector("[data-testid='manage-teams-screen']", { state: "visible" });
      // Wait for demo teams to finish seeding and appear in the list.
      // useCustomTeams fetches once on mount — if seeding hasn't completed yet
      // when the initial DB query runs, the list will appear empty.  In that
      // case, wait briefly for seeding to finish and reload so the hook
      // re-runs its fetch with the freshly-inserted teams.
      // NOTE: The correct testid is "custom-team-list-item" (see TeamListItem.tsx).
      const teamItemLocator = page.locator("[data-testid='custom-team-list-item']");
      const found = await teamItemLocator
        .first()
        .waitFor({ state: "visible", timeout: 8_000 })
        .then(() => true)
        .catch(() => false);
      if (!found) {
        // Seeding was still in flight — reload to re-trigger the DB fetch.
        await page.reload({ waitUntil: "domcontentloaded" });
        await page.waitForSelector("[data-testid='manage-teams-screen']", { state: "visible" });
        await page.waitForSelector("[data-testid='custom-team-list-item']", {
          state: "visible",
          timeout: 15_000,
        });
      }
      await captureScreenshot(page, `manage-teams-${viewport}.png`);
    });
  });

  // ── 7b. Team Editor (new team) ──────────────────────────────────────────────
  test("7b. Team Editor (new team form)", async () => {
    await forBothViewports(async (page, viewport) => {
      await resetAppState(page);
      await page.goto("/teams/new", { waitUntil: "domcontentloaded" });
      await page.waitForSelector("[data-testid='custom-team-name-input']", { state: "visible" });
      // Fill in a team name so the form is more illustrative
      await page.getByTestId("custom-team-name-input").fill("Demo Stars");
      await captureScreenshot(page, `team-editor-${viewport}.png`);
    });
  });

  // ── 8. League Hub page ──────────────────────────────────────────────────────
  test("8. League Hub page (empty state)", async () => {
    await forBothViewports(async (page, viewport) => {
      await resetAppState(page);
      await page.goto("/leagues", { waitUntil: "domcontentloaded" });
      await page.waitForSelector("[data-testid='leagues-hub']", {
        state: "visible",
        timeout: 15_000,
      });
      await captureScreenshot(page, `league-hub-${viewport}.png`);
    });
  });

  // ── 9. League Schedule page ──────────────────────────────────────────────────
  // Creates a season via the wizard (all-autogen, accept all defaults) then
  // navigates to its schedule page.  This uses only the desktop page so the
  // wizard interaction is simpler; the mobile screenshot navigates directly.
  test("9. League Schedule page", async () => {
    await forBothViewports(async (page, viewport) => {
      await resetAppState(page);

      // Navigate to the setup wizard using the hub's "Start a Season (all
      // autogenerated)" CTA — this creates a season with no custom teams.
      await page.goto("/leagues", { waitUntil: "domcontentloaded" });
      await page.waitForSelector("[data-testid='leagues-hub']", {
        state: "visible",
        timeout: 15_000,
      });
      await page.getByTestId("hub-start-autogen").click();
      await page.waitForSelector("[data-testid='league-setup-wizard']", {
        state: "visible",
        timeout: 15_000,
      });

      // Step through the 6-step wizard using "Next →" / "Create Season" on the
      // last step.  All defaults are fine for a documentation screenshot.
      for (let step = 1; step <= 5; step++) {
        await page.getByRole("button", { name: /next →/i }).click();
        // Wait briefly for the next step to render before proceeding.
        await page.waitForTimeout(300);
      }

      // Final step — click "Create Season".
      await page.getByTestId("create-season-button").click();

      // After creation the app should redirect to /leagues/:id (season home).
      await page.waitForURL(/\/leagues\/[^/]+$/, { timeout: 20_000 });
      await page.waitForSelector("[data-testid='season-home']", {
        state: "visible",
        timeout: 15_000,
      });

      // Navigate to the schedule page.
      await page.getByTestId("season-nav-schedule").click();
      await page.waitForSelector("[data-testid='season-schedule']", {
        state: "visible",
        timeout: 15_000,
      });

      await captureScreenshot(page, `league-schedule-${viewport}.png`);
    });
  });
});
