import { expect, test } from "@playwright/test";

import {
  assertFieldAndLogVisible,
  loadFixture,
  resetAppState,
  startGameViaPlayBall,
  waitForLogLines,
  waitForNewGameDialog,
} from "../utils/helpers";

test.describe("Smoke", () => {
  test("app loads and shows the Home screen", async ({ page }) => {
    await resetAppState(page);
    await expect(page.getByTestId("home-screen")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("home-new-game-button")).toBeVisible();
    await expect(page.getByTestId("home-load-saves-button")).toBeVisible();
    await expect(page.getByTestId("home-manage-teams-button")).toBeVisible();
  });

  test("New Game button on Home screen shows the Exhibition Setup page", async ({ page }) => {
    await resetAppState(page);
    await waitForNewGameDialog(page);
    await expect(page.getByTestId("exhibition-setup-page")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("play-ball-button")).toBeVisible();
  });

  test("Play Ball! button starts the game", async ({ page }) => {
    await startGameViaPlayBall(page, { seed: "abc123" });
    await expect(page.getByTestId("scoreboard")).toBeVisible();
  });

  test("scoreboard and field visible after game starts", async ({ page }) => {
    await startGameViaPlayBall(page, { seed: "abc123" });
    await assertFieldAndLogVisible(page);
  });

  test("play-by-play log updates automatically (autoplay)", async ({ page }) => {
    await startGameViaPlayBall(page, { seed: "abc123" });
    // Expand the play-by-play log
    const logToggle = page.getByRole("button", { name: /expand play-by-play/i });
    if (await logToggle.isVisible()) {
      await logToggle.click();
    }
    // The log should populate without any user interaction (autoplay is always on)
    await expect(async () => {
      const entries = page.getByTestId("play-by-play-log").locator("[data-log-index]");
      expect(await entries.count()).toBeGreaterThanOrEqual(3);
    }).toPass({ timeout: 30_000, intervals: [500, 1000, 1000] });
  });

  // ---------------------------------------------------------------------------
  // Game-start gating: the simulation must not produce events until the user
  // submits the New Game dialog ("Play Ball!").
  // ---------------------------------------------------------------------------

  test("game does not start (no log entries) before Play Ball is clicked", async ({ page }) => {
    await resetAppState(page);
    await waitForNewGameDialog(page);

    // While the new-game dialog is open it intercepts all pointer events,
    // so we cannot click any controls behind it. Instead we simply pause
    // and then assert the play-by-play log has no entries — an indirect check
    // that the autoplay scheduler has NOT fired before Play Ball is clicked.
    await page.waitForTimeout(2_000);

    // The play-by-play log should have zero entries while the dialog is open.
    // We check via DOM query rather than clicking a toggle (which would be
    // blocked by the dialog overlay).
    const entryCount = await page.evaluate(() => {
      return document.querySelectorAll("[data-log-index]").length;
    });
    expect(entryCount).toBe(0);
  });

  test("autoplay begins immediately after Play Ball — no manual input required", async ({
    page,
  }) => {
    // Click Play Ball without pre-seeding localStorage for autoPlay.
    // The app default is autoPlay=true, so this exercises the "out of the box"
    // experience: game starts → pitches happen → log grows, all without any click.
    await startGameViaPlayBall(page, { seed: "abc123" });

    // Expand the play-by-play log if necessary, then wait for ≥3 entries.
    // This confirms the autoplay scheduler fired without user input.
    await waitForLogLines(page, 3, 30_000);
  });

  test(
    "game-over: finished-game fixture shows FINAL banner",
    { tag: "@desktop-only" },
    async ({ page }) => {
      // Loads a pre-built finished-game fixture and verifies the FINAL banner is displayed.
      // This is a fast smoke check for the game-over UI state, not a full autoplay regression.
      // Restrict to desktop Chromium to avoid multiplying CI time.
      test.setTimeout(60_000);

      await loadFixture(page, "finished-game.json");
      await expect(page.getByText("FINAL")).toBeVisible({ timeout: 15_000 });

      // After FINAL, the scoreboard should still be visible and no errors thrown.
      await expect(page.getByTestId("scoreboard")).toBeVisible();
    },
  );

  test(
    "autoplay runs a full game from seed to FINAL (freeze regression)",
    { tag: "@desktop-only" },
    async ({ page }) => {
      // Exercises the full autoplay path from a fresh game to FINAL so CI catches any
      // scheduler freeze regression. Desktop-only to keep CI time reasonable.
      test.setTimeout(180_000);

      // Set speed and the E2E inning-pause flag via evaluate so they are already in
      // localStorage when the app first mounts. addInitScript alone is unreliable here
      // because the scripts run before page scripts on each navigation but the exact
      // interaction with the React useLocalStorage hook can be racy. Using evaluate
      // after an explicit goto ensures the values are present before startGameViaPlayBall
      // navigates; localStorage persists across same-origin navigations so the settings
      // remain active throughout the game.
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await page.evaluate(() => {
        localStorage.setItem("speed", "150"); // SPEED_FAST
        localStorage.setItem("_e2eNoInningPause", "1"); // disable muted half-inning pause in CI
      });
      await startGameViaPlayBall(page, { seed: "smoke-final1" });

      // Expand the play-by-play log so [data-log-index] elements are in the DOM.
      // Without this the log is collapsed and the stall watchdog below always sees
      // count=0, causing a false-positive "stalled" error even when the game runs fine.
      await waitForLogLines(page, 1, 20_000);

      // Wait for FINAL with a progress watchdog that distinguishes a slow CI runner
      // from a frozen game. If no new log lines appear for 15 s, fail immediately with
      // actionable diagnostics so the failure is easy to triage.
      // timeout is 160_000 to handle seeds that go to extra innings (smoke-final1 ties
      // 3-3 after 9 innings); combined with the 20 s waitForLogLines above this stays
      // within the 180 s test.setTimeout budget.
      let lastLogCount = 0;
      let lastLogChangeTime = Date.now();
      await expect(async () => {
        if (await page.getByText("FINAL").isVisible()) return;

        const currentCount = await page.locator("[data-log-index]").count();
        if (currentCount > lastLogCount) {
          lastLogCount = currentCount;
          lastLogChangeTime = Date.now();
        }
        const stalledMs = Date.now() - lastLogChangeTime;
        if (stalledMs > 15_000) {
          const scoreboardText = await page
            .getByTestId("scoreboard")
            .textContent()
            .catch(() => "?");
          throw new Error(
            `autoplay stalled: no new log lines for ${stalledMs}ms ` +
              `(log count=${currentCount}; scoreboard="${scoreboardText?.trim()}")`,
          );
        }
        throw new Error("FINAL not yet visible");
      }).toPass({ timeout: 160_000, intervals: [500] });

      // Scoreboard must still be visible after game completes.
      await expect(page.getByTestId("scoreboard")).toBeVisible();
    },
  );

  // ---------------------------------------------------------------------------
  // Long-session performance stability: after 50+ log lines the app must still
  // respond to interactions within a reasonable time (no freeze / stall).
  // ---------------------------------------------------------------------------

  test(
    "app remains responsive after 50+ autoplay log entries (no stall)",
    { tag: "@desktop-only" },
    async ({ page }) => {
      // Long-running: generates 50+ autoplay entries before asserting responsiveness.
      // Restrict to desktop Chromium — viewport does not affect scheduling behavior.
      test.setTimeout(120_000);

      // Use fast speed so we hit 50 entries quickly. Set via evaluate so the value
      // is in localStorage before startGameViaPlayBall mounts the app.
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await page.evaluate(() => {
        localStorage.setItem("speed", "150"); // SPEED_FAST
      });
      await startGameViaPlayBall(page, { seed: "perf-smoke1" });
      await waitForLogLines(page, 50, 90_000);

      // The Saves button must still be clickable and the modal open quickly —
      // verifies the main thread is not frozen after a long autoplay burst.
      const savesBtn = page.getByTestId("saves-button");
      await expect(savesBtn).toBeVisible();

      await savesBtn.click();
      // If the main thread is frozen, this assertion will time out (generous 5 s bound).
      await expect(page.getByTestId("saves-modal")).toBeVisible({ timeout: 5_000 });

      // Close the modal to leave a clean state.
      await page.getByRole("button", { name: /close/i }).click();
    },
  );
});
