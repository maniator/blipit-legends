/**
 * Simulation metrics baseline capture.
 *
 * Runs 200 full games via the browser using Instant speed mode (SPEED_INSTANT=0)
 * and collects aggregate statistics for before/after tuning comparisons.
 * 200 games is the minimum required for each meaningful tuning round per the
 * run-scoring calibration policy; 300 games for final validation.
 *
 * Intended to run on desktop Chromium only.  Excluded from the normal CI suite
 * because it is intentionally slow (~20–25 min); invoke manually or via the
 * `e2e-test-runner` agent when a before/after metrics capture is needed.
 *
 * How to run:
 *   yarn test:e2e --project=desktop --grep "metrics-baseline"
 *
 * Manager mode: disabled for all runs so games are fully unmanaged and Instant
 * mode never blocks on a human decision.
 *
 * Key design decisions:
 * - Seeds are injected by calling the React fiber's onChange prop directly so
 *   they are guaranteed to be committed to React state before Play Ball is
 *   clicked — no reliance on synthetic DOM events.
 * - Stats are read from the per-team batting-stats table (exact AB/H/BB/K),
 *   not from play-by-play log text (which requires regex parsing and
 *   approximate PA estimation).
 * - Score extraction locates the "R" header cell to find the correct column
 *   index; it does NOT assume the last/second-to-last cell is always runs.
 * - Matchups rotate across 4 combinations (2 teams × home/away swap) so
 *   results are not dominated by one roster pairing.
 */
import { expect, test } from "@playwright/test";

import { importTeamsFixture, resetAppState, waitForNewGameDialog } from "../utils/helpers";

/**
 * Number of games per matchup block.
 * 10 blocks × 20 = 200 games (minimum per tuning round policy).
 * Increase to 30 for 300-game final validation runs.
 */
const GAMES_PER_BLOCK = 20;

/**
 * Matchup definitions — 10 combos across the 5 canonical metrics teams.
 * These teams are imported from `e2e/fixtures/metrics-teams.json`, which is
 * the committed fixture that guarantees identical rosters across all tuning
 * passes.  10 combos × 20 seeds each = 200 games total.
 *
 * To regenerate the fixture teams: create 5 teams via Manage Teams → Generate
 * Random, export via "Export All Teams", save to `e2e/fixtures/metrics-teams.json`,
 * and commit.  All future passes must import from this file — never recreate.
 */
const MATCHUP_BLOCKS = [
  { away: "Charlotte Bears", home: "Denver Raiders", seedPrefix: "s1" },
  { away: "Denver Raiders", home: "Charlotte Bears", seedPrefix: "s2" },
  { away: "San Antonio Giants", home: "Portland Foxes", seedPrefix: "s3" },
  { away: "Portland Foxes", home: "Nashville Comets", seedPrefix: "s4" },
  { away: "Nashville Comets", home: "San Antonio Giants", seedPrefix: "s5" },
  { away: "Charlotte Bears", home: "San Antonio Giants", seedPrefix: "s6" },
  { away: "Denver Raiders", home: "Portland Foxes", seedPrefix: "s7" },
  { away: "San Antonio Giants", home: "Nashville Comets", seedPrefix: "s8" },
  { away: "Portland Foxes", home: "Charlotte Bears", seedPrefix: "s9" },
  { away: "Nashville Comets", home: "Denver Raiders", seedPrefix: "s10" },
] as const;

/**
 * Waits for the FINAL banner to appear.
 *
 * Polls the scoreboard text as a liveness probe (the play-by-play log is
 * collapsed in Instant mode and has no rendered entries to count).
 */
async function waitForFinal(
  page: import("@playwright/test").Page,
  timeoutMs = 90_000,
): Promise<void> {
  let lastScoreboardText = "";
  let lastChangeTime = Date.now();

  await expect(async () => {
    if (await page.getByText("FINAL").isVisible()) return;

    const currentText = await page
      .getByTestId("scoreboard")
      .textContent()
      .catch(() => "");
    if (currentText !== lastScoreboardText) {
      lastScoreboardText = currentText ?? "";
      lastChangeTime = Date.now();
    }

    const stalledMs = Date.now() - lastChangeTime;
    if (stalledMs > 15_000) {
      throw new Error(
        `game stalled: scoreboard unchanged for ${stalledMs}ms ` +
          `(scoreboard="${lastScoreboardText.slice(0, 60).trim()}")`,
      );
    }

    throw new Error("FINAL not yet visible");
  }).toPass({ timeout: timeoutMs, intervals: [50, 100, 200] });
}

interface GameStats {
  ab: number;
  bb: number;
  k: number;
  h: number;
  awayScore: number;
  homeScore: number;
}

/**
 * Reads exact batting stats (AB/H/BB/K) from the per-team batting-stats table
 * for both teams, then reads final scores from the scoreboard using the "R"
 * column header to locate the correct column.
 *
 * Must be called after waitForFinal so the game is complete and stats are stable.
 */
async function extractGameStats(page: import("@playwright/test").Page): Promise<GameStats> {
  // Ensure "This game" (not career) stats are shown.
  const thisGameBtn = page.getByRole("button", { name: "This game" });
  if (await thisGameBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await thisGameBtn.click();
    await page.waitForTimeout(100);
  }

  // Helper: sum batting-stats table for the currently-visible team tab.
  // Skips scoreboard rows by checking for a parent with data-testid="scoreboard".
  async function readVisibleBattingTable(): Promise<{
    ab: number;
    bb: number;
    k: number;
    h: number;
  }> {
    return page.evaluate(() => {
      let ab = 0,
        bb = 0,
        k = 0,
        h = 0;
      for (const row of document.querySelectorAll("table tbody tr")) {
        if (row.closest('[data-testid="scoreboard"]')) continue;
        const cells = Array.from(row.querySelectorAll("td"));
        if (cells.length < 6) continue;
        const n = (c: number): number => {
          const t = cells[c]?.textContent?.trim();
          return t && t !== "–" ? parseInt(t, 10) || 0 : 0;
        };
        // Column order: name(0) pos(1) AB(2) H(3) BB(4) K(5) RBI(6)
        ab += n(2);
        h += n(3);
        bb += n(4);
        k += n(5);
      }
      return { ab, bb, k, h };
    });
  }

  const tabs = page.locator('[role="tab"]');
  await tabs.nth(0).click();
  await page.waitForTimeout(150);
  const awayStats = await readVisibleBattingTable();

  await tabs.nth(1).click();
  await page.waitForTimeout(150);
  const homeStats = await readVisibleBattingTable();

  // Locate the "R" column in the scoreboard header, then read that cell per team row.
  const scores = await page.evaluate((): [number, number] => {
    const sb = document.querySelector('[data-testid="scoreboard"]');
    if (!sb) return [0, 0];
    const headerCells = Array.from(sb.querySelectorAll("thead tr th, thead tr td"));
    const rIdx = headerCells.findIndex((c) => c.textContent?.trim() === "R");
    const teamRows = Array.from(sb.querySelectorAll("tbody tr")).filter(
      (r) => r.querySelectorAll("td").length > 3,
    );
    return teamRows.slice(0, 2).map((row) => {
      const cells = Array.from(row.querySelectorAll("td"));
      if (rIdx >= 0 && cells[rIdx]) {
        const t = cells[rIdx].textContent?.trim() ?? "";
        return /^\d+$/.test(t) ? parseInt(t, 10) : 0;
      }
      // Fallback: second-to-last numeric cell
      const nums = cells
        .map((c) => c.textContent?.trim() ?? "")
        .filter((t) => /^\d+$/.test(t))
        .map(Number);
      return nums.length >= 2 ? nums[nums.length - 2] : (nums[0] ?? 0);
    }) as [number, number];
  });

  return {
    ab: awayStats.ab + homeStats.ab,
    bb: awayStats.bb + homeStats.bb,
    k: awayStats.k + homeStats.k,
    h: awayStats.h + homeStats.h,
    awayScore: scores[0],
    homeScore: scores[1],
  };
}

test.describe("Metrics baseline — 200 games via Instant mode (desktop only)", () => {
  test.setTimeout(60 * 60 * 1000); // 60 minutes for 200 games

  test(
    "collect aggregate metrics across 200 seeded Instant-mode games",
    { tag: "@desktop-only" },
    async ({ page }) => {
      // Desktop Chromium only — other projects would multiply CI time.
      // ── One-time setup ─────────────────────────────────────────────────────
      // Configure localStorage before the app mounts so Instant mode and
      // muted announcements are active from the very first navigation.
      await page.addInitScript(() => {
        localStorage.setItem("speed", "0"); // SPEED_INSTANT = 0
        localStorage.setItem("announcementVolume", "0"); // mute TTS
        localStorage.setItem("alertVolume", "0"); // mute alert sounds
        localStorage.setItem("_e2eNoInningPause", "1"); // skip half-inning pause
        localStorage.setItem("managerMode", "false"); // fully unmanaged
      });

      // ── Console error/warning capture ──────────────────────────────────────
      // Register before resetAppState/importTeamsFixture so initial app load,
      // DB init, and fixture import errors are included in the final summary.
      const consoleErrors: string[] = [];
      const consoleWarnings: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(`[E] ${msg.text()}`);
        else if (msg.type() === "warning") consoleWarnings.push(`[W] ${msg.text()}`);
      });
      // Also capture uncaught JS exceptions — these are emitted via 'pageerror',
      // not 'console', so they would otherwise be missed.
      page.on("pageerror", (err) => {
        consoleErrors.push(`[PAGEERROR] ${err.message}`);
      });

      await resetAppState(page);
      await importTeamsFixture(page, "metrics-teams.json");

      // ── Build game list ─────────────────────────────────────────────────────
      // 10 matchup combos × GAMES_PER_BLOCK seeds each = 200 games total.
      const games: Array<{ away: string; home: string; seed: string }> = [];
      for (const block of MATCHUP_BLOCKS) {
        for (let g = 1; g <= GAMES_PER_BLOCK; g++) {
          games.push({
            away: block.away,
            home: block.home,
            seed: `${block.seedPrefix}g${g}`,
          });
        }
      }

      // ── Per-game loop ───────────────────────────────────────────────────────
      let totalAB = 0;
      let totalBB = 0;
      let totalK = 0;
      let totalH = 0;
      let totalRuns = 0;
      let gamesCompleted = 0;
      const perGameRuns: number[] = [];

      for (let i = 0; i < games.length; i++) {
        const { away, home, seed } = games[i];

        await page.goto("/exhibition/new");
        await waitForNewGameDialog(page);

        // Set matchup teams.
        await page.getByTestId("new-game-custom-away-team-select").selectOption({ label: away });
        await page.getByTestId("new-game-custom-home-team-select").selectOption({ label: home });

        // Inject seed directly into React state via the fiber's onChange prop.
        // This is more reliable than synthetic DOM events in fast-paced test loops.
        const seedField = page.getByTestId("seed-input");
        await seedField.evaluate((el: HTMLInputElement, value: string) => {
          const nativeSetter = Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            "value",
          )!.set!;
          nativeSetter.call(el, value);
          const fk = Object.keys(el).find((k) => k.startsWith("__reactFiber"));
          if (fk) {
            const onChange = (
              el as unknown as Record<
                string,
                { memoizedProps?: { onChange?: (e: { target: HTMLInputElement }) => void } }
              >
            )[fk]?.memoizedProps?.onChange;
            if (onChange) {
              onChange({ target: el });
              return;
            }
          }
          el.dispatchEvent(new Event("input", { bubbles: true }));
        }, seed);
        await page.waitForTimeout(100);

        // Start the game.
        await page.getByTestId("play-ball-button").click();
        await expect(page.getByTestId("scoreboard")).toBeVisible({ timeout: 15_000 });

        // Wait for FINAL.
        await waitForFinal(page, 90_000);

        // Collect stats from batting-stats table and scoreboard.
        const stats = await extractGameStats(page);
        totalAB += stats.ab;
        totalBB += stats.bb;
        totalK += stats.k;
        totalH += stats.h;
        const runs = stats.awayScore + stats.homeScore;
        totalRuns += runs;
        perGameRuns.push(runs);
        gamesCompleted++;

        // Progress update every 10 games.
        if ((i + 1) % 10 === 0) {
          const pa = totalAB + totalBB;
          const bbPctNow = pa > 0 ? ((totalBB / pa) * 100).toFixed(1) : "?";
          console.log(
            `  [${i + 1}/${games.length}] ${away}@${home} seed=${seed} ` +
              `R=${stats.awayScore}-${stats.homeScore} runs=${runs} BB%=${bbPctNow}%`,
          );
        }
      }

      // ── Aggregate reporting ─────────────────────────────────────────────────
      const totalPA = totalAB + totalBB;
      const bbPct = totalPA > 0 ? ((totalBB / totalPA) * 100).toFixed(1) : "N/A";
      const kPct = totalPA > 0 ? ((totalK / totalPA) * 100).toFixed(1) : "N/A";
      const hPerPA = totalPA > 0 ? (totalH / totalPA).toFixed(3) : "N/A";
      const runsPerGame = (totalRuns / gamesCompleted).toFixed(1);
      const bbPerGame = (totalBB / gamesCompleted).toFixed(1);

      const sortedRuns = [...perGameRuns].sort((a, b) => a - b);
      const medianRuns = sortedRuns[Math.floor(sortedRuns.length / 2)];

      console.log("\n");
      console.log("╔══════════════════════════════════════════════════════╗");
      console.log("║  BROWSER-DRIVEN METRICS BASELINE                     ║");
      console.log("╠══════════════════════════════════════════════════════╣");
      console.log(`║  Games completed:   ${String(gamesCompleted).padEnd(33)}║`);
      console.log(`║  Matchups:          10 combos × 5 teams (metrics-teams.json) ║`);
      console.log(`║  Speed mode:        Instant (SPEED_INSTANT = 0)      ║`);
      console.log(`║  Manager mode:      Off (fully unmanaged)             ║`);
      console.log("╠══════════════════════════════════════════════════════╣");
      console.log(`║  Total PA (exact):  ${String(totalPA).padEnd(33)}║`);
      console.log(
        `║  BB%:               ${bbPct}%${" ".repeat(Math.max(0, 35 - String(bbPct).length - 1))}║`,
      );
      console.log(
        `║  K%:                ${kPct}%${" ".repeat(Math.max(0, 35 - String(kPct).length - 1))}║`,
      );
      console.log(
        `║  H/PA:              ${hPerPA}${" ".repeat(Math.max(0, 35 - String(hPerPA).length))}║`,
      );
      console.log(
        `║  BB/game:           ${bbPerGame}${" ".repeat(Math.max(0, 35 - String(bbPerGame).length))}║`,
      );
      console.log(
        `║  Runs/game (mean):  ${runsPerGame}${" ".repeat(Math.max(0, 35 - String(runsPerGame).length))}║`,
      );
      console.log(`║  Runs/game (median):${String(medianRuns).padEnd(35)}║`);
      console.log(`║  Total BB:          ${String(totalBB).padEnd(33)}║`);
      console.log(`║  Total K:           ${String(totalK).padEnd(33)}║`);
      console.log(`║  Total H:           ${String(totalH).padEnd(33)}║`);
      console.log("╚══════════════════════════════════════════════════════╝");
      console.log("\n");

      // ── Console errors/warnings summary ─────────────────────────────────────
      const knownNoise = [
        "ERR_BLOCKED_BY_CLIENT", // GTM blocked by adblock — always present, harmless
        "RxDB Open Core RxStorage", // RxDB premium upsell banner — expected noise
        "useRxdbGameSync: failed to update progress", // expected local-only sync noise during Instant-mode runs
      ];
      const filteredErrors = consoleErrors.filter((m) => !knownNoise.some((n) => m.includes(n)));
      const filteredWarnings = consoleWarnings.filter(
        (m) => !knownNoise.some((n) => m.includes(n)),
      );
      const COL = 52; // inner content width (after 2-space prefix, before trailing ║)
      if (filteredErrors.length > 0) {
        console.log("╔══════════════════════════════════════════════════════╗");
        console.log("║  CONSOLE ERRORS (filtered) — WILL FAIL TEST          ║");
        console.log("╠══════════════════════════════════════════════════════╣");
        for (const msg of filteredErrors.slice(0, 20)) {
          const truncated = msg.length > COL ? msg.slice(0, COL - 3) + "..." : msg;
          console.log(`║  ${truncated.padEnd(COL)}║`);
        }
        if (filteredErrors.length > 20) {
          const errorsSummary = `... and ${filteredErrors.length - 20} more errors`;
          console.log(`║  ${errorsSummary.padEnd(COL)}║`);
        }
        console.log("╚══════════════════════════════════════════════════════╝");
        console.log("\n");
      }
      if (filteredWarnings.length > 0) {
        console.log("╔══════════════════════════════════════════════════════╗");
        console.log("║  CONSOLE WARNINGS (filtered) — informational only    ║");
        console.log("╠══════════════════════════════════════════════════════╣");
        for (const msg of filteredWarnings.slice(0, 10)) {
          const truncated = msg.length > COL ? msg.slice(0, COL - 3) + "..." : msg;
          console.log(`║  ${truncated.padEnd(COL)}║`);
        }
        if (filteredWarnings.length > 10) {
          const warningsSummary = `... and ${filteredWarnings.length - 10} more warnings`;
          console.log(`║  ${warningsSummary.padEnd(COL)}║`);
        }
        console.log("╚══════════════════════════════════════════════════════╝");
        console.log("\n");
      }
      if (filteredErrors.length === 0 && filteredWarnings.length === 0) {
        console.log("ℹ️  No unexpected console errors or warnings.\n");
      }

      // Wide sanity bounds — passes in both pre- and post-tuning states.
      // Tighten after post-tuning baseline is captured.
      expect(gamesCompleted, "should have completed all games").toBe(games.length);
      expect(totalBB, "should have recorded some walks").toBeGreaterThan(0);
      expect(totalK, "should have recorded some strikeouts").toBeGreaterThan(0);
      expect(Number(runsPerGame), "runs/game sanity").toBeGreaterThan(0);
      expect(Number(bbPct), "BB% sanity — below 40%").toBeLessThan(40);

      // Fail the run if there were actionable (non-noise) console errors or
      // uncaught page exceptions — so metrics numbers are never accepted from a
      // broken app state.
      expect(
        filteredErrors,
        "unexpected console errors / pageerrors during metrics run (see box above)",
      ).toHaveLength(0);
    },
  );
});
