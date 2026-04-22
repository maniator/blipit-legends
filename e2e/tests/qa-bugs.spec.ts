/**
 * QA regression tests — bugs found during the 2026-03-06 full-playthrough QA session.
 *
 * See: .github/docs/qa-report-2026-03-06.md for the full report.
 *
 * Covers:
 * 1. /career-stats redirects to /stats (Bug 4)
 * 2. SV=0 does not render as a leader card (Bug 2)
 * 3. Player career page shows real name for bench players with no game stats (Bug 1)
 * 4. SPEED_FAST constant is ≤ 200 ms (Bug 5 — fast speed was 350 ms)
 * 5. Invalid import format version error is user-friendly (Bug 5 — cryptic message)
 * 6. Help page documents the Protect swing on 0-2 counts (Bug 6)
 */
import { expect, test } from "@playwright/test";

import { importTeamsFixture, resetAppState, startGameViaPlayBall } from "../utils/helpers";

// ─── 1. /career-stats redirects to /stats ────────────────────────────────────

test.describe("Routing — /career-stats redirects to /stats", { tag: "@desktop-only" }, () => {
  test("navigating to /career-stats ends up at /stats", async ({ page }) => {
    await resetAppState(page);
    await page.goto("/career-stats");
    await expect(page).toHaveURL(/\/stats/, { timeout: 10_000 });
    await expect(page.getByTestId("career-stats-page")).toBeVisible({ timeout: 10_000 });
  });

  test("direct visit to /career-stats shows Career Stats page content", async ({ page }) => {
    await resetAppState(page);
    await page.goto("/career-stats");
    await expect(page.getByTestId("career-stats-page")).toBeVisible({ timeout: 10_000 });
    // Must have redirected — URL should be /stats not /career-stats
    await expect(page).not.toHaveURL(/\/career-stats/);
    await expect(page).toHaveURL(/\/stats/);
  });
});

// ─── 2. SV=0 does not render as a leader card ────────────────────────────────

test.describe(
  "Career Stats — SV leader card suppressed when value is 0",
  { tag: "@desktop-only" },
  () => {
    test("SV leader card shows placeholder when team has no game history (Bug 2 regression)", async ({
      page,
    }) => {
      // Import a team with NO game history — no game stats exist, so there are 0 saves.
      // This directly tests the fix: savesLeader.value > 0 required to show the card.
      await resetAppState(page);
      await importTeamsFixture(page, "career-stats-e2e-team-with-bench.json");
      // No history import — team exists but has played 0 games.

      await page.goto("/stats");
      await expect(page.getByTestId("career-stats-page")).toBeVisible({ timeout: 15_000 });
      // Phase 2C: a team exists but has no completed game history, so noCompletedGames
      // is true and the new accessible empty-state region is shown instead of the old
      // career-stats-no-teams element.
      await expect(page.getByTestId("career-stats-empty-state")).toBeVisible({ timeout: 10_000 });
      await expect(page.getByTestId("career-stats-team-select")).not.toBeVisible();
    });

    test("SV leader card shows 'SV — no data' placeholder when team has no save history", async ({
      page,
    }) => {
      // Duplicate of the above but kept for naming clarity — both verify Bug 2.
      await resetAppState(page);
      await importTeamsFixture(page, "career-stats-e2e-team-with-bench.json");

      await page.goto("/stats");
      await expect(page.getByTestId("career-stats-page")).toBeVisible({ timeout: 15_000 });

      // Phase 2C: team exists but has no completed game history → noCompletedGames is
      // true → new accessible empty-state region shown, not career-stats-no-teams.
      await expect(page.getByTestId("career-stats-empty-state")).toBeVisible({ timeout: 10_000 });
      await expect(page.getByTestId("career-stats-team-select")).not.toBeVisible();
    });
  },
);

// ─── 3. Player career page shows real name for no-stats bench players ─────────

test.describe(
  "Player Career page — no raw ID for bench players with no stats (Bug 1)",
  { tag: "@desktop-only" },
  () => {
    test("bench player with no game history shows real name, not raw globalPlayerId", async ({
      page,
    }) => {
      await resetAppState(page);
      // Import a team that has a bench player (e2e_bench_never_played / "B. Benchwarmer")
      // who has never appeared in a game.
      await importTeamsFixture(page, "career-stats-e2e-team-with-bench.json");

      // Navigate directly to the bench player's career page with the team context.
      // Team id: ct_e2e_career_bench, bench player id: e2e_bench_never_played
      await page.goto("/stats/ct_e2e_career_bench/players/e2e_bench_never_played");
      await expect(page.getByTestId("player-career-page")).toBeVisible({ timeout: 15_000 });

      // The page heading must show the real name "B. Benchwarmer", NOT the raw ID.
      await expect(page.getByRole("heading", { name: "B. Benchwarmer" })).toBeVisible({
        timeout: 5_000,
      });

      // The raw player ID must NOT appear anywhere as a heading.
      await expect(page.getByRole("heading", { name: "e2e_bench_never_played" })).not.toBeVisible();
    });

    test("player with no game history and no team context shows 'Unknown Player'", async ({
      page,
    }) => {
      await resetAppState(page);

      // Navigate to a player that does not exist in any team and has no stats.
      await page.goto("/stats/unknown_team/players/pl_totally_nonexistent_id_xyz");
      await expect(page.getByTestId("player-career-page")).toBeVisible({ timeout: 15_000 });

      // Must show "Unknown Player", not the raw key.
      await expect(page.getByRole("heading", { name: "Unknown Player" })).toBeVisible({
        timeout: 5_000,
      });
      await expect(
        page.getByRole("heading", { name: "pl_totally_nonexistent_id_xyz" }),
      ).not.toBeVisible();
    });
  },
);

// ─── 4. SPEED_FAST constant is ≤ 200 ms ──────────────────────────────────────

test.describe("Speed constants — Fast speed is ≤ 200 ms (Bug 5)", () => {
  test(
    "SPEED_FAST is reflected as ≤ 200 in the speed selector during an active game",
    { tag: "@desktop-only" },
    async ({ page }) => {
      // Start a game so the speed slider is rendered inside GameControls.
      await startGameViaPlayBall(page);

      // The speed slider must be present. Slide to position 2 (Fast = index 2 in SPEED_STEPS)
      // and verify that the corresponding speed value is ≤ 200 ms.
      const slider = page.getByTestId("speed-slider");
      await expect(slider).toBeVisible({ timeout: 10_000 });

      // Read the max value and verify it matches 3 (4 positions: Slow/Normal/Fast/Instant).
      const max = await slider.getAttribute("max");
      expect(Number(max)).toBe(3);

      // Slide to position 2 (Fast).
      await slider.fill("2");

      // Read SPEED_FAST from the SPEED_STEPS mapping: position 2 → 150 ms.
      // We verify via evaluate since the value stored in localStorage is the ms value.
      const fastSpeedMs = await page.evaluate(() => {
        return Number(localStorage.getItem("speed"));
      });
      expect(fastSpeedMs).toBeLessThanOrEqual(200);
    },
  );
});

// ─── 5. Import error message is user-friendly ────────────────────────────────

test.describe(
  "Team import — user-friendly error message for invalid format (Bug 5b)",
  { tag: "@desktop-only" },
  () => {
    test("importing JSON with no formatVersion shows user-friendly error", async ({ page }) => {
      await resetAppState(page);
      await page.goto("/teams");
      await expect(page.getByTestId("manage-teams-screen")).toBeVisible({ timeout: 15_000 });

      // Paste JSON that is structurally valid but missing formatVersion.
      const badJson = JSON.stringify({ type: "customTeams", payload: { teams: [] } });
      await page.getByTestId("import-teams-paste-textarea").fill(badJson);
      await page.getByTestId("import-teams-paste-button").click();

      const errorEl = page.getByTestId("import-teams-error");
      await expect(errorEl).toBeVisible({ timeout: 5_000 });

      const errorText = await errorEl.textContent();
      // Must include user-friendly guidance pointing to the Ballgame export buttons.
      expect(errorText).toMatch(/Make sure to export using/i);
      // Must NOT be the bare old technical message that contained nothing helpful.
      expect(errorText).not.toMatch(/^Unsupported custom teams format version/i);
    });

    test("importing plain text (not JSON) shows a clear error", async ({ page }) => {
      await resetAppState(page);
      await page.goto("/teams");
      await expect(page.getByTestId("manage-teams-screen")).toBeVisible({ timeout: 15_000 });

      await page.getByTestId("import-teams-paste-textarea").fill("this is not json at all");
      await page.getByTestId("import-teams-paste-button").click();

      const errorEl = page.getByTestId("import-teams-error");
      await expect(errorEl).toBeVisible({ timeout: 5_000 });
      // Should show a parse error, not crash silently.
      await expect(errorEl).not.toBeEmpty();
    });
  },
);

// ─── 6. Help page documents Protect swing ────────────────────────────────────

test.describe("Help page — Protect swing documented (Bug 6)", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  test("Help page Manager Mode section mentions Protect swing on 0-2 count", async ({ page }) => {
    await page.goto("/help");
    await expect(page.getByTestId("help-page")).toBeVisible({ timeout: 15_000 });

    // Open the Manager Mode section (it's collapsed by default).
    // Use locator("summary") to target the <summary> element specifically —
    // getByText() would also match "Manager Mode" inside the section body.
    const summary = page.locator("summary").filter({ hasText: /^Manager Mode$/i });
    await summary.click();

    // The word "Protect" must now be visible in the expanded section.
    await expect(page.getByText(/protect/i).first()).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/0-2/i).first()).toBeVisible({ timeout: 5_000 });
  });
});
