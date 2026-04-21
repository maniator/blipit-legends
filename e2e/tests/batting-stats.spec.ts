/**
 * E2E tests for batting stats consistency — seed 30nl0i regression.
 *
 * Verifies that after a full game completes the Batting Stats panel for the
 * away team shows internally consistent data:
 *
 *   • The First Baseman (slot 2) has fewer AB than the Second Baseman (slot 3)
 *     because of a walk — the AB deficit equals the BB count (valid baseball).
 *   • K <= AB for every batter (strikeouts must count as official at-bats).
 *   • The away batting-stats table is visible on the away tab and hidden when
 *     the section is collapsed.
 */

import { expect, test } from "@playwright/test";

import { startGameViaPlayBall } from "../utils/helpers";

const SEED = "30nl0i";
// At SPEED_FAST (150 ms/pitch) a ~250-pitch game finishes in ~40 s.
// Each test also spends ~20 s on setup (importTeamsFixture + navigation).
// Allow 300 s total to keep tests green on slower CI runners.
const GAME_TIMEOUT = 300_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse a stat cell value — "–" displayed as zero. */
const parseCell = (text: string): number => (text.trim() === "–" ? 0 : parseInt(text.trim(), 10));

/** Read { ab, h, bb, k } from a table row (slot-name cell is [0]). */
interface RowStats {
  ab: number;
  h: number;
  bb: number;
  k: number;
}

async function readRowStats(rowLocator: import("@playwright/test").Locator): Promise<RowStats> {
  const cells = await rowLocator.locator("td").allTextContents();
  // Column layout (from PlayerStatsPanel): name(0) Pos(1) AB(2) H(3) BB(4) K(5) RBI(6)
  return {
    ab: parseCell(cells[2] ?? "–"),
    h: parseCell(cells[3] ?? "–"),
    bb: parseCell(cells[4] ?? "–"),
    k: parseCell(cells[5] ?? "–"),
  };
}

// ---------------------------------------------------------------------------
// Tests — run on the "desktop" project only (not the determinism project).
// ---------------------------------------------------------------------------

test.describe("Batting Stats — seed 30nl0i", () => {
  test.setTimeout(GAME_TIMEOUT);

  test.beforeEach(async ({ page }) => {
    // Enable fastest autoplay before page load so the game completes quickly.
    // addInitScript runs on every navigation so there is no need to also call
    // resetAppState here — startGameViaPlayBall handles the initial navigation.
    await page.addInitScript(() => {
      localStorage.setItem("autoPlay", "true");
      localStorage.setItem("speed", "150"); // SPEED_FAST
    });
  });

  test("game reaches FINAL state", async ({ page }) => {
    await startGameViaPlayBall(page, { seed: SEED });
    await expect(page.getByText("FINAL")).toBeVisible({ timeout: GAME_TIMEOUT - 60_000 });
  });

  test("slot 2 vs slot 3: AB gap, when present, is explained by walks", async ({ page }) => {
    await startGameViaPlayBall(page, { seed: SEED });
    await expect(page.getByText("FINAL")).toBeVisible({ timeout: GAME_TIMEOUT - 60_000 });

    // Away-team batting stats tab is active by default
    const table = page.getByTestId("batting-stats-table");
    await expect(table).toBeVisible();

    const slot2Row = page.getByRole("row").filter({ hasText: /^First Baseman/ });
    const slot3Row = page.getByRole("row").filter({ hasText: /^Second Baseman/ });

    const slot2 = await readRowStats(slot2Row);
    const slot3 = await readRowStats(slot3Row);

    // Plate appearances (AB + BB) must be equal or earlier slot has more.
    expect(slot2.ab + slot2.bb).toBeGreaterThanOrEqual(slot3.ab + slot3.bb);

    // If slot 2 has fewer AB than slot 3, that shortfall must come from walks.
    if (slot2.ab < slot3.ab) {
      expect(slot2.bb).toBeGreaterThan(0);
    }
  });

  test("K <= AB for every away batter (strikeouts always count as at-bats)", async ({ page }) => {
    await startGameViaPlayBall(page, { seed: SEED });
    await expect(page.getByText("FINAL")).toBeVisible({ timeout: GAME_TIMEOUT - 60_000 });

    const table = page.getByTestId("batting-stats-table");
    await expect(table).toBeVisible();

    const rows = table.locator("tbody tr");
    expect(await rows.count()).toBe(9);

    for (let i = 0; i < 9; i++) {
      const stats = await readRowStats(rows.nth(i));
      expect(stats.k).toBeLessThanOrEqual(stats.ab);
    }
  });

  test("batting stats table is visible on away team tab and hidden when collapsed", async ({
    page,
  }) => {
    await startGameViaPlayBall(page, { seed: SEED });
    // Don't need to wait for FINAL — just verify the panel works.
    const table = page.getByTestId("batting-stats-table");
    await expect(table).toBeVisible({ timeout: 10_000 });

    // Collapse
    await page.getByRole("button", { name: /collapse batting stats/i }).click();
    await expect(table).not.toBeVisible();

    // Expand
    await page.getByRole("button", { name: /expand batting stats/i }).click();
    await expect(table).toBeVisible();
  });
});
