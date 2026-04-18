/**
 * Audio system E2E tests.
 *
 * These tests verify that the home-screen music system initializes correctly in
 * a real browser context — something that cannot be fully covered by unit tests
 * because the Web Audio API autoplay-policy behavior is browser-specific.
 *
 * Notes on scope:
 *  - Playwright headless Chromium does not enforce the autoplay policy, so
 *    AudioContext.state is already "running" on load.  We therefore cannot
 *    reproduce the "suspended until gesture" path here, but we CAN verify that:
 *      a) AudioContext is constructed and resume() is called on mount, and
 *      b) the volume-bar UI is present/absent on the correct routes.
 *  - Audio-initialization tests are scoped to the desktop project — audio
 *    behavior is viewport-independent and running on all 7 projects would
 *    add unnecessary CI time.
 */
import { expect, test } from "@playwright/test";

import { resetAppState, startGameViaPlayBall } from "../utils/helpers";

// ---------------------------------------------------------------------------
// Volume bar route visibility
// ---------------------------------------------------------------------------

test.describe("Volume bar visibility", () => {
  test("volume bar is visible on the home screen", async ({ page }) => {
    await resetAppState(page);
    await expect(page.getByTestId("app-volume-bar")).toBeVisible();
  });

  test("volume bar is hidden during gameplay", async ({ page }) => {
    await startGameViaPlayBall(page, { seed: "audiogame1" });
    await expect(page.getByTestId("app-volume-bar")).not.toBeVisible();
  });

  test("volume bar reappears after navigating back to home from game", async ({ page }) => {
    await startGameViaPlayBall(page, { seed: "audiohome1" });
    await expect(page.getByTestId("app-volume-bar")).not.toBeVisible();

    await page.getByTestId("back-to-home-button").click();
    await expect(page.getByTestId("home-screen")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("app-volume-bar")).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Audio system initialization (desktop only — viewport-independent)
// ---------------------------------------------------------------------------

test.describe("Audio initialization", { tag: "@desktop-only" }, () => {
  test("AudioContext is constructed and resume() called on home screen load", async ({ page }) => {
    // Intercept AudioContext before the app's own scripts run so we can track calls.
    await page.addInitScript(() => {
      const Orig =
        window.AudioContext ??
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Orig) return;
      (window as Window & { __audioResumeCount?: number }).__audioResumeCount = 0;
      window.AudioContext = class extends Orig {
        resume() {
          (window as Window & { __audioResumeCount?: number }).__audioResumeCount =
            ((window as Window & { __audioResumeCount?: number }).__audioResumeCount ?? 0) + 1;
          return super.resume();
        }
      };
    });

    await resetAppState(page);

    // resume() must have been called — confirms the music system attempted to
    // start the audio context on mount (the onstatechange approach relies on this).
    const resumeCount = await page.evaluate(
      () => (window as Window & { __audioResumeCount?: number }).__audioResumeCount ?? 0,
    );
    expect(resumeCount).toBeGreaterThan(0);
  });

  test("muting then unmuting music does not throw errors", async ({ page }) => {
    // Collect console errors AND uncaught page exceptions before navigating.
    const consoleErrors: string[] = [];
    const pageErrors: Error[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => pageErrors.push(err));

    await resetAppState(page);

    // Mute music
    const muteBtn = page.getByRole("button", { name: "Mute music" });
    await expect(muteBtn).toBeVisible();
    await muteBtn.click();
    await expect(page.getByRole("button", { name: "Unmute music" })).toBeVisible();
    // Unmute — this re-creates the AudioContext; should not throw
    await page.getByRole("button", { name: "Unmute music" }).click();
    await expect(page.getByRole("button", { name: "Mute music" })).toBeVisible();

    // Neither console errors nor uncaught exceptions should occur during the cycle.
    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });
});
