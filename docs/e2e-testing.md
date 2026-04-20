# E2E Testing

> Part of the Ballgame reference docs. See the [docs index](README.md) or [`.github/copilot-instructions.md`](../.github/copilot-instructions.md) (Copilot-specific).

## E2E Tests (`e2e/`)

Playwright E2E tests live in `e2e/` and are separate from the Vitest unit tests in `src/`.

### Projects

`playwright.config.ts` defines **7 projects**:

| Project             | Browser                    | Viewport | Runs                             |
| ------------------- | -------------------------- | -------- | -------------------------------- |
| `determinism`       | Desktop Chrome             | 1280×800 | `determinism.spec.ts` only       |
| `desktop`           | Desktop Chrome             | 1280×800 | all except `determinism.spec.ts` |
| `tablet`            | WebKit (iPad gen 7)        | 820×1180 | all except `determinism.spec.ts` |
| `iphone-15-pro-max` | WebKit (iPhone 15 Pro Max) | 430×739  | all except `determinism.spec.ts` |
| `iphone-15`         | WebKit (iPhone 15)         | 393×659  | all except `determinism.spec.ts` |
| `pixel-7`           | Chromium (Pixel 7)         | 412×839  | all except `determinism.spec.ts` |
| `pixel-5`           | Chromium (Pixel 5)         | 393×727  | all except `determinism.spec.ts` |

The `determinism` project is intentionally isolated to desktop because it spawns two sequential fresh browser contexts per test — running it on all 6 device projects would multiply CI time by 6× for no additional coverage value (PRNG determinism is not viewport-dependent).

### Static project routing tags (avoid runtime `test.skip`)

Project-specific tests should use tags plus `grepInvert` in `playwright.config.ts`, not runtime `test.skip(...)` calls inside test bodies. Current tags:

- `@desktop-only`
- `@chromium-only`
- `@iphone-15-only`
- `@mobile-only` (iphone-15-pro-max, iphone-15, pixel-7, pixel-5)

This keeps CI skip counts clean and ensures project scoping is resolved at collection time.

### Key design decisions

- **`vite preview` webServer** — E2E tests run against the production build (`dist/`), not `yarn dev`. This avoids the RxDB `RxDBDevModePlugin` dynamic import hanging the DB initialisation in headless Chromium.
- **Seeded games** — seeds are set via the seed input field in the New Game form, which calls `reinitSeed(seedStr)` on submit. The seed is not written to the URL. E2E tests use `configureNewGame(page, { seed: "..." })` to fill the input field.
- **`data-log-index` on log entries** — each play-by-play `<Log>` element has `data-log-index={log.length - 1 - arrayIndex}` (0 = oldest event). `captureGameSignature` reads indices 0–4 to get a stable deterministic signature regardless of how many new entries autoplay has prepended.
- **Fresh context per determinism run** — `browser.newContext()` gives each game run its own IndexedDB, preventing the auto-save from the first run from restoring mid-game state in the second run and breaking seed reproducibility.

### Helper functions (`e2e/utils/helpers.ts`)

| Helper                                               | Purpose                                                                                                                              |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `resetAppState(page)`                                | Navigate to `/` and wait for DB loading to finish                                                                                    |
| `startGameViaPlayBall(page, options?)`               | Navigate to `/exhibition/new`, fill seed-input field (if provided), configure teams, click Play Ball                                 |
| `configureNewGame(page, options?)`                   | Fill seed/team fields on `/exhibition/new` without submitting                                                                        |
| `loadFixture(page, fixtureName)`                     | Navigate to `/` → Load Saved Game → import file fixture → auto-load restores state — self-contained, no prior `resetAppState` needed |
| `waitForLogLines(page, count, timeout?)`             | Expand log if collapsed, poll until ≥ count entries (default 60 s timeout)                                                           |
| `captureGameSignature(page, minLines?, logTimeout?)` | Wait for entries, read `data-log-index` 0–4, return joined string                                                                    |
| `openSavesModal(page)`                               | Click saves button, wait for modal                                                                                                   |
| `saveCurrentGame(page)`                              | Open modal + click Save current game                                                                                                 |
| `loadFirstSave(page)`                                | Open modal + click first Load button, wait for modal to close                                                                        |
| `importSaveFromFixture(page, fixtureName)`           | Open modal + set file input to fixture path (requires active game)                                                                   |
| `assertFieldAndLogVisible(page)`                     | Assert field-view + scoreboard visible with non-zero bounding boxes                                                                  |
| `disableAnimations(page)`                            | Inject CSS to zero all animation/transition durations (use before visual snapshots)                                                  |
| `computeTeamsSignature(page, payload)`               | Evaluate `fnv1a(TEAMS_EXPORT_KEY + JSON.stringify(payload))` in the browser page context                                             |
| `importTeamsFixture(page, fixtureName)`              | Navigate to `/teams`, set `import-teams-file-input` to fixture path, wait for `import-teams-success`                                 |

### `data-testid` reference

All stable test selectors added to the app:

**Home screen:** `home-screen`, `home-new-game-button`, `home-resume-current-game-button`, `home-load-saves-button`, `home-manage-teams-button`, `home-help-button`

**Exhibition Setup page (`/exhibition/new`):** `exhibition-setup-page`, `new-game-back-home-button`, `new-game-custom-teams-tab`, `home-team-select`, `away-team-select`, `seed-input`, `play-ball-button`, `team-validation-error`, `starting-pitcher-select`

**Saves page (`/saves`):** `saves-page`, `saves-page-back-button`, `saves-list`, `saves-list-item`, `saves-page-empty`, `load-save-button`, `export-save-button`, `delete-save-button`, `import-save-file-input`, `import-error`

**Help page (`/help`):** `help-page`, `help-page-back-button`

**Manage Teams (`/teams`, `/teams/new`, `/teams/:id/edit`):** `manage-teams-screen`, `manage-teams-back-button`, `manage-teams-create-button`, `custom-team-list`, `custom-team-list-item`, `custom-team-edit-button`, `custom-team-delete-button`, `manage-teams-editor-shell`, `manage-teams-editor-back-button`, `export-all-teams-button`, `export-team-button`, `import-teams-file-input`, `import-teams-success`, `import-teams-error`, `teams-duplicate-banner`, `teams-duplicate-confirm-button`, `teams-duplicate-cancel-button`

**Custom Team Editor (inside `/teams/new` and `/teams/:id/edit`):** `custom-team-lineup-section`, `custom-team-bench-section`, `custom-team-pitchers-section`, `custom-team-name-input`, `custom-team-abbreviation-input`, `custom-team-city-input`, `custom-team-regenerate-defaults-button`, `custom-team-save-button`, `custom-team-cancel-button`, `custom-team-add-lineup-player-button`, `custom-team-add-bench-player-button`, `custom-team-add-pitcher-button`, `custom-team-player-position-select`, `custom-team-player-handedness-select`, `custom-team-editor-error-summary`, `custom-team-save-error-hint`, `export-player-button`, `import-lineup-player-input`, `import-bench-player-input`, `import-pitchers-player-input`, `player-import-lineup-duplicate-banner`, `player-import-lineup-confirm-button`, `player-import-bench-duplicate-banner`, `player-import-bench-confirm-button`, `player-import-pitchers-duplicate-banner`, `player-import-pitchers-confirm-button`, `lineup-bench-dnd-container`

**In-game controls (GameControls / SavesModal):** `saves-button`, `saves-modal`, `saves-modal-close-button`, `save-game-button`, `import-save-textarea`, `import-save-button`, `back-to-home-button`, `new-game-button` (visible only after FINAL)

**Game view:** `new-game-dialog`, `scoreboard`, `field-view`, `play-by-play-log`, `log-panel`, `hit-log`, `manager-mode-toggle`, `manager-decision-panel`, `db-reset-notice`

### Visual snapshots

Committed baseline PNGs live in `e2e/tests/visual.spec.ts-snapshots/` named `<screen>-<project>-linux.png`. These baselines are rendered inside the `mcr.microsoft.com/playwright:v1.58.2-noble` container (the same image used by `playwright-e2e.yml`), so they must **always** be regenerated inside that same container to guarantee pixel-identical rendering.

**Never run `yarn test:e2e:update-snapshots` locally and commit the result.** Local OS fonts and rendering differ from the CI container, causing false visual-diff failures on every subsequent CI run.

When an intentional UI change requires new baselines, you have two options:

**Option 1 — Use the `e2e-test-runner` agent (preferred for Copilot sessions):** The agent runs `--update-snapshots` inside the same Docker container and commits the updated PNGs directly to the branch in the same session. No workflow wait required. See `.github/agents/e2e-test-runner.md` for the exact `docker run` commands.

**Option 2 — Use the `update-visual-snapshots` GitHub Actions workflow:**

- It fires **automatically** on every push to any non-master branch.
- For manual control: **Actions → "Update Visual Snapshots" → Run workflow → select your branch → Run workflow**.
- The workflow runs inside the same Playwright container as CI, regenerates all snapshot PNGs, and commits them back to your branch (without `[skip ci]`), so `playwright-e2e.yml` runs against the updated baselines on that commit.

Do **not** regenerate snapshots unless you are intentionally changing a visual.

### Workflow sequencing for snapshot changes

When you push a commit that changes the app or its tests, **two things happen**:

1. `update-visual-snapshots` fires (auto-trigger), regenerates PNGs in the CI container, and commits them back to the branch.
2. `playwright-e2e` fires against the _original_ commit — this run may fail if the new test has no baseline yet.

Once `update-visual-snapshots` commits the new baselines, a _second_ `playwright-e2e` run is triggered against that commit. That run uses the fresh baselines and should pass. The initial failure on the original commit is expected and self-correcting.

### CI

`.github/workflows/playwright-e2e.yml` — pure test runner; does **not** regenerate or commit snapshots:

1. `yarn build` — produces `dist/` for `vite preview`
2. `npx playwright test` — runs all projects headlessly (browser binaries pre-installed in the container)
3. Uploads `playwright-report/` + `test-results/` as artifacts on failure

`.github/workflows/update-visual-snapshots.yml` — snapshot regeneration workflow (auto-triggers on every push to non-master branches):

- Runs inside the **same** `mcr.microsoft.com/playwright:v1.58.2-noble` container as `playwright-e2e.yml`.
- **Auto-trigger:** every push to any non-master branch.
- **Manual trigger:** Actions → "Update Visual Snapshots" → Run workflow → select branch.
- Commits updated PNGs back to the branch; the commit triggers `playwright-e2e` to validate them.
- Concurrency group: cancels stale queued runs when a newer push arrives.

---

## Save Fixtures for E2E Testing

Pre-crafted save files in `e2e/fixtures/` let E2E tests jump straight into a specific game situation without waiting for autoplay to reach it. This slashes test time from 90–150 s (waiting for decisions or scoring plays) to under 15 s.

### When to use a fixture instead of `startGameViaPlayBall`

| Situation                                                            | Use fixture?                            |
| -------------------------------------------------------------------- | --------------------------------------- |
| Need a manager decision panel visible immediately                    | ✅ `pending-decision.json`              |
| Need specific pending decision (pinch hitter, shift, etc.)           | ✅ craft a new fixture                  |
| Need RBI / stats already on the board                                | ✅ `mid-game-with-rbi.json`             |
| Testing visual snapshot of a mid-game UI element                     | ✅ craft a fixture for that state       |
| Testing correctness of the simulation (seed regression, determinism) | ❌ must use real `startGameViaPlayBall` |
| Testing the full game-completion flow (FINAL banner)                 | ❌ must use real autoplay               |

### The `loadFixture` helper

```typescript
import { loadFixture } from "../utils/helpers";

await loadFixture(page, "pending-decision.json");
// Game is now active with the fixture's stateSnapshot applied.
// No startGameViaPlayBall, no waitForLogLines, no long timeouts needed.
```

`loadFixture` navigates to **Home → "Load Saved Game" → `/saves` page**, imports the file through the saves page file input, waits for the auto-load to restore state and navigate to `/game`, and confirms the scoreboard is visible — all in one call.

### Available fixtures

| File                                       | State summary                                                    | Covers                                              |
| ------------------------------------------ | ---------------------------------------------------------------- | --------------------------------------------------- |
| `sample-save.json`                         | Inning 2, Mets vs Yankees, no pending decision                   | Import smoke tests                                  |
| `pending-decision.json`                    | Inning 4 bottom, defensive_shift pending, managerMode on         | Manager decision panel UI, notification smoke       |
| `pending-decision-pinch-hitter.json`       | Inning 7 top, pinch_hitter pending + 2 candidates, default teams | Pinch-hitter dropdown visual snapshot               |
| `pending-decision-pinch-hitter-teams.json` | Same as above but with custom teams + player sigs in the bundle  | Signed custom-team fixture with player fingerprints |
| `mid-game-with-rbi.json`                   | Inning 5 top, 3-2 score, playLog has RBI entries                 | RBI stats display + save/reload persistence         |
| `finished-game.json`                       | Completed game, FINAL banner shown                               | Game-over state regression tests                    |
| `legacy-teams-no-fingerprints.json`        | Pre-v2 teams bundle (no player or team fingerprints)             | Legacy import migration regression                  |

### Authoring a new fixture

Fixtures are signed JSON bundles (`RxdbExportedSave` format). The signature is a FNV-1a 32-bit checksum. **Always use Node.js (not Python)** to compute signatures — Python's `json.dumps` escapes non-ASCII characters differently from JS `JSON.stringify` (e.g. `·` → `\u00b7`), which causes sig mismatches at import time.

```js
const RXDB_EXPORT_KEY = "ballgame:rxdb:v1";

function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

function makeSig(header, events) {
  const inner = JSON.stringify({ header, events });
  return fnv1a(RXDB_EXPORT_KEY + inner);
}

const events = []; // empty for most fixtures; populate if your fixture needs recorded events
const payload = { version: 1, header, events, sig: makeSig(header, events) };
```

**Key fields in `header.stateSnapshot.state`:**

| Field                      | Purpose                          | Notes                                                                                                                                                        |
| -------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pendingDecision`          | Decision panel state             | `null` = no panel; `{ kind: "defensive_shift" }` = shift panel; `{ kind: "pinch_hitter", candidates: [...], teamIdx: 0, lineupIdx: N }` = dropdown           |
| `managerMode` (in `setup`) | Shows the DecisionPanel          | Must be `true` for any pending-decision fixture                                                                                                              |
| `managedTeam` (in `setup`) | Which team is managed            | `0` = away, `1` = home                                                                                                                                       |
| `playLog`                  | RBI / hit stats                  | Each entry needs `{ inning, half, batterNum, team, event, runs, rbi }` where `event` is the Hit enum value (Single=0, Double=1, Triple=2, Homerun=3, Walk=4) |
| `inningRuns`               | Line-score display               | `inningRuns[team][inning-1]` = runs that team scored in that inning                                                                                          |
| `lineupOrder`              | Player IDs in batting order      | Always populated for custom-team games                                                                                                                       |
| `playerOverrides`          | Custom names/positions/stat mods | Use player IDs as keys                                                                                                                                       |
| `resolvedMods`             | Pre-computed stat mods           | Needed for `pinch_hitter` candidates' `contactMod`/`powerMod` to be accurate                                                                                 |
| `rosterBench`              | Bench player IDs                 | Required for `pinch_hitter` decisions to show candidates                                                                                                     |

**Minimal fixture checklist:**

1. Build `header` object with `id`, `name`, `seed`, `homeTeamId`, `awayTeamId`, `schemaVersion: 1`, `setup`, and `stateSnapshot`
2. Start from `BASE_STATE` (all array/object fields present with safe defaults) and override only what you need
3. Compute `sig = makeSig(header, events)` using the Node.js snippet above (run via `node` in a scratch script)
4. Place file in `e2e/fixtures/<name>.json`
5. Use `await loadFixture(page, "<name>.json")` in the test

### State restoration mechanics

When `loadFixture` imports a save, `useSavesModal.ts` calls `handleLoad` which:

1. `dispatch({ type: "restore_game", payload: snap.state })` — applies `stateSnapshot.state` via `backfillRestoredState` (safe-defaults for any missing fields)
2. `onSetupRestore({ strategy, managedTeam, managerMode })` — writes to localStorage
3. `onLoadActivate(slot.id)` — sets `gameActive = true` so the DecisionPanel renders
4. Closes the modal

Because `pendingDecision` is part of `State` and `backfillRestoredState` merges `restored` over `fresh` defaults, a fixture that carries `pendingDecision: { kind: "defensive_shift" }` will render the manager decision panel instantly on load — no pitch needs to be thrown.

---

## Simulation Metrics Baseline

There are **three complementary ways** to collect aggregate simulation metrics. The right choice depends on the context:

| Method                         | Speed      | Sample size    | Environment            | Authoritative?      | Best for                                |
| ------------------------------ | ---------- | -------------- | ---------------------- | ------------------- | --------------------------------------- |
| Vitest in-process harness      | ~30 s      | 100 games      | Node.js only           | ❌ Directional      | Rapid iteration inside an agent session |
| **MCP browser (agent method)** | **~2 min** | **200+ games** | **Full Chrome + RxDB** | **✅ Ground truth** | **Agent-driven tuning rounds**          |
| Playwright spec runner         | ~20–25 min | 200 games      | Full Chrome + RxDB     | ✅ Ground truth     | CI / human-driven full runs             |

> **For agents (Copilot sessions): use the MCP browser batch-loop method.**
> The Playwright spec (`e2e/tests/metrics-baseline.spec.ts`) is a **reference implementation** that documents the full automated flow. For agent-driven tuning it is far faster to run games directly through the MCP browser using the single-tab batch-loop evaluate — you get results in real time, can interleave with code changes, and can collect 200 games in **under 2 minutes** of wall-clock time (vs ~20–25 minutes for the sequential spec runner).

### Canonical team fixture

All browser metric runs use the **5 teams committed to `e2e/fixtures/metrics-teams.json`**:

- Charlotte Bears (CHB)
- Denver Raiders (DRD)
- San Antonio Giants (SAG)
- Portland Foxes (PTF)
- Nashville Comets (NSC)

**This fixture is the single source of truth for all tuning passes.** Never recreate teams by clicking "Generate Random" — each run produces different random rosters, making cross-pass comparisons meaningless. The 10 canonical matchup combos are:

```
s1:  Charlotte Bears  @ Denver Raiders
s2:  Denver Raiders   @ Charlotte Bears
s3:  San Antonio Giants @ Portland Foxes
s4:  Portland Foxes   @ Nashville Comets
s5:  Nashville Comets @ San Antonio Giants
s6:  Charlotte Bears  @ San Antonio Giants
s7:  Denver Raiders   @ Portland Foxes
s8:  San Antonio Giants @ Nashville Comets
s9:  Portland Foxes   @ Charlotte Bears
s10: Nashville Comets @ Denver Raiders
```

Seeds are strings: `s1g1`, `s1g2`, … `s1g20` for matchup block s1 with 20 seeds (200 games total = 10 matchups × 20 seeds).

### Starting the preview server for MCP browser automation

The MCP browser (Chrome controlled by the `mcp-server-playwright` process) can **only** reach `localhost:5173` when the vite preview server is started by the **Playwright CLI's `webServer` config**, not when started manually from bash.

**What works — let Playwright own the server:**

```bash
# Build first (required — preview serves dist/)
yarn build

# Start the Playwright metrics test in the background.
# Its webServer config starts `npx vite preview --port 5173` as a child process,
# which is the only method that makes localhost:5173 reachable in the MCP browser.
cd /home/runner/work/blipit-legends/blipit-legends
npx playwright test --config=playwright-metrics.config.ts --project=desktop > /tmp/pltest.txt 2>&1 &

# Wait ~12 seconds for vite preview to boot, then verify
sleep 12 && ss -tlnp | grep 5173
curl -s -o /dev/null -w "HTTP %{http_code}" http://localhost:5173/
```

Once the server is up, navigate the MCP browser to `http://localhost:5173`.

**What does NOT work (manually started servers are unreachable from MCP Chrome):**

```bash
# ❌ All of these fail in the MCP browser with ERR_CONNECTION_REFUSED or ERR_FAILED:
npx vite preview --port 5173                    # binds [::1]:5173
npx vite preview --port 5173 --host 0.0.0.0    # binds 0.0.0.0:5173
npx vite preview --port 5173 --host 127.0.0.1  # binds 127.0.0.1:5173
npx vite preview --port 5173 --host ::1         # binds [::1]:5173
```

**Root cause:** The MCP browser (`mcp-server-playwright`) controls the Chrome process (PID visible via `pgrep -f "chrome.*playwright"`). When `npx playwright test` runs it connects to the same Chrome process and registers `localhost:5173` with Chrome's networking stack via the webServer handshake. A manually-started server never goes through that handshake, so Chrome's network service rejects connections to it regardless of bind address.

**Important:** The background Playwright test will eventually time out (60-minute timeout) and kill its vite preview server. If the server goes away mid-session, restart it with the same command above.

### Agent method: MCP browser with batch-loop evaluate (preferred for tuning rounds)

This is the **fastest way for an agent to collect 200+ browser game metrics**. In Instant mode, game simulation completes in essentially **zero wall-clock time** — a 9-inning game renders in <100ms on the active tab. The only real timing cost is MCP tool-call overhead (~2–3 seconds per `playwright-browser_*` call).

> **Key insight: use a single `evaluate` call that loops over many games.** A single `playwright-browser_evaluate` call can start a game, `await waitForFinal()`, collect stats, and immediately start the next game — all inside the JS context, with zero MCP round-trips between games. 10 games per tab = 1 evaluate call ≈ 2–3 seconds of wall-clock time. For a 200-game run, change the loop to `g<=20` (20 games per tab, one evaluate call per tab across 10 tabs) = ~10 evaluate calls + ~10 tab-switch calls ≈ **under 2 minutes of total wall-clock time**.

> **Background tabs DO NOT advance.** Browsers throttle background-tab JS timers to a minimum of ~1000ms. In Instant mode, a game that completes in <100ms on the active tab takes several minutes frozen in a background tab. **Do not rely on background tabs finishing games while you are on another tab.** The batch-loop approach below handles this correctly by running all games for a tab sequentially within a single active-tab evaluate call.

#### One-time setup per session

1. Build the app and start the Playwright webServer (see above).
2. Navigate the MCP browser to `http://localhost:5173`.
3. Set localStorage for Instant mode + no-manager — **this applies to all tabs on the same origin**:
   ```js
   localStorage.setItem("speed", "0"); // SPEED_INSTANT
   localStorage.setItem("announcementVolume", "0"); // mute TTS
   localStorage.setItem("alertVolume", "0"); // mute alerts
   localStorage.setItem("_e2eNoInningPause", "1"); // skip half-inning pause
   localStorage.setItem("managerMode", "false"); // fully unmanaged
   ```
   > **Speed note:** There is no speed selector on the `/exhibition/new` form. Speed is read from `localStorage.speed` by the game when it starts. The `"speed": "0"` set here (SPEED_INSTANT) is shared across all same-origin tabs in Chromium — you only need to set it once. Do **not** try to inject a speed `<select>` on the new-game form; no such element exists. If you are unsure whether Instant mode is active, confirm via the game controls dropdown on any running game tab — it will show "Instant" selected.
4. Navigate to `/teams` and import `e2e/fixtures/metrics-teams.json` via the **Import from File** button. Teams persist in RxDB for the entire Chrome session — this only needs to be done once.
5. Clear any previous results and console error log:
   ```js
   localStorage.removeItem("metricsResults");
   localStorage.removeItem("metricsConsoleErrors");
   // Install a persistent console-error capture shim on the current page.
   // Re-run this after each navigation (it survives within a page context only).
   // Restore any previous shim first to avoid double-wrapping on re-run.
   if (window.__metricsOrig) {
     console.error = window.__metricsOrig.error;
     console.warn = window.__metricsOrig.warn;
   }
   const _orig = (window.__metricsOrig = { error: console.error, warn: console.warn });
   console.error = (...a) => {
     _orig.error(...a);
     const msgs = JSON.parse(localStorage.getItem("metricsConsoleErrors") || "[]");
     msgs.push("[E] " + a.join(" "));
     localStorage.setItem("metricsConsoleErrors", JSON.stringify(msgs));
   };
   console.warn = (...a) => {
     _orig.warn(...a);
     const msgs = JSON.parse(localStorage.getItem("metricsConsoleErrors") || "[]");
     msgs.push("[W] " + a.join(" "));
     localStorage.setItem("metricsConsoleErrors", JSON.stringify(msgs));
   };
   ```
   > **Note:** The shim captures errors from the current page context only. When you navigate between pages the shim is reset — reinstall it after each page load, or use `playwright-browser_console_messages` at the end to see all accumulated messages for the session.

#### Running a single game and collecting stats

```js
// ── 1. Navigate to the new game form ──────────────────────────────────────
// (use playwright-browser_navigate to go to http://localhost:5173/exhibition/new)
// (use playwright-browser_wait_for to wait for "Play Ball" to appear)

// ── 2. Set teams + seed via JS injection ──────────────────────────────────
// Speed does NOT need to be set here — it is already Instant via localStorage.
// (use playwright-browser_evaluate with the snippet below)
(async function (away, home, seed) {
  await new Promise((r) => {
    const c = () =>
      document.querySelector('[data-testid="new-game-custom-away-team-select"]')
        ? r()
        : setTimeout(c, 100);
    c();
  });
  function setSelect(testId, label) {
    const el = document.querySelector(`[data-testid="${testId}"]`);
    const opt = [...el.options].find((o) => o.text.includes(label));
    const ns = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set;
    ns.call(el, opt.value);
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }
  function setSeed(val) {
    const el = document.querySelector('[data-testid="seed-input"]');
    const ns = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    ns.call(el, val);
    const fk = Object.keys(el).find((k) => k.startsWith("__reactFiber"));
    if (fk) el[fk]?.memoizedProps?.onChange?.({ target: el });
    else el.dispatchEvent(new Event("input", { bubbles: true }));
  }
  setSelect("new-game-custom-away-team-select", away);
  setSelect("new-game-custom-home-team-select", home);
  setSeed(seed);
  await new Promise((r) => setTimeout(r, 300));
  document.querySelector('[data-testid="play-ball-button"]').click();
  return `${away} @ ${home} seed=${seed} started`;
})("Charlotte Bears", "Denver Raiders", "s1g1");

// ── 3. Wait for FINAL ─────────────────────────────────────────────────────
// (use playwright-browser_wait_for with text="FINAL", timeout ~30s)

// ── 4. Collect stats and accumulate in localStorage ───────────────────────
// (use playwright-browser_evaluate with the snippet below)
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // Ensure "This game" tab is active
  const thisGame = document.querySelector('[data-testid="stats-tab-this-game"]');
  if (thisGame) {
    thisGame.click();
    await sleep(150);
  }
  function readTable() {
    let ab = 0,
      h = 0,
      bb = 0,
      k = 0;
    for (const row of document.querySelectorAll("table tbody tr")) {
      if (row.closest('[data-testid="scoreboard"]')) continue;
      const cells = [...row.querySelectorAll("td")];
      if (cells.length < 6) continue;
      const n = (i) => {
        const t = cells[i]?.textContent?.trim();
        return t && t !== "–" ? parseInt(t, 10) || 0 : 0;
      };
      ab += n(2);
      h += n(3);
      bb += n(4);
      k += n(5);
    }
    return { ab, h, bb, k };
  }
  const tabs = document.querySelectorAll('[role="tab"]');
  tabs[0].click();
  await sleep(200);
  const away = readTable();
  tabs[1].click();
  await sleep(200);
  const home = readTable();
  const sb = document.querySelector('[data-testid="scoreboard"]');
  const hdrs = [...(sb?.querySelectorAll("thead tr th,thead tr td") || [])];
  const rIdx = hdrs.findIndex((c) => c.textContent?.trim() === "R");
  const scores = [...(sb?.querySelectorAll("tbody tr") || [])]
    .filter((r) => r.querySelectorAll("td").length > 3)
    .slice(0, 2)
    .map((row) => {
      const cells = [...row.querySelectorAll("td")];
      return rIdx >= 0 ? parseInt(cells[rIdx]?.textContent?.trim() || "0") || 0 : 0;
    });
  const result = {
    ab: away.ab + home.ab,
    h: away.h + home.h,
    bb: away.bb + home.bb,
    k: away.k + home.k,
    awayScore: scores[0] ?? 0,
    homeScore: scores[1] ?? 0,
  };
  const results = JSON.parse(localStorage.getItem("metricsResults") || "[]");
  results.push(result);
  localStorage.setItem("metricsResults", JSON.stringify(results));
  return { count: results.length, lastResult: result };
})();
```

#### Combined collect + start next game (preferred — halves MCP tool-call count)

Instead of 4 tool calls per game (switch tab → collect evaluate → navigate → inject+start evaluate), use a single `playwright-browser_evaluate` that collects stats **and** clicks "New Game" then injects the next matchup — reducing to 2 calls per game (switch tab → combined evaluate):

```js
// After a game reaches FINAL, use this single evaluate to collect AND start the next game.
// This halves MCP tool-call overhead vs the separate collect → navigate → inject flow.
(async function (nextAway, nextHome, nextSeed) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ── Collect stats from completed game ─────────────────────────────────────
  const thisGame = document.querySelector('[data-testid="stats-tab-this-game"]');
  if (thisGame) {
    thisGame.click();
    await sleep(150);
  }
  function readTable() {
    let ab = 0,
      h = 0,
      bb = 0,
      k = 0;
    for (const row of document.querySelectorAll("table tbody tr")) {
      if (row.closest('[data-testid="scoreboard"]')) continue;
      const cells = [...row.querySelectorAll("td")];
      if (cells.length < 6) continue;
      const n = (i) => {
        const t = cells[i]?.textContent?.trim();
        return t && t !== "–" ? parseInt(t, 10) || 0 : 0;
      };
      ab += n(2);
      h += n(3);
      bb += n(4);
      k += n(5);
    }
    return { ab, h, bb, k };
  }
  const tabs = document.querySelectorAll('[role="tab"]');
  tabs[0].click();
  await sleep(200);
  const awayStats = readTable();
  tabs[1].click();
  await sleep(200);
  const homeStats = readTable();
  const sb = document.querySelector('[data-testid="scoreboard"]');
  const hdrs = [...(sb?.querySelectorAll("thead tr th,thead tr td") || [])];
  const rIdx = hdrs.findIndex((c) => c.textContent?.trim() === "R");
  const scores = [...(sb?.querySelectorAll("tbody tr") || [])]
    .filter((r) => r.querySelectorAll("td").length > 3)
    .slice(0, 2)
    .map((row) => {
      const cells = [...row.querySelectorAll("td")];
      return rIdx >= 0 ? parseInt(cells[rIdx]?.textContent?.trim() || "0") || 0 : 0;
    });
  const result = {
    ab: awayStats.ab + homeStats.ab,
    h: awayStats.h + homeStats.h,
    bb: awayStats.bb + homeStats.bb,
    k: awayStats.k + homeStats.k,
    awayScore: scores[0] ?? 0,
    homeScore: scores[1] ?? 0,
  };
  const results = JSON.parse(localStorage.getItem("metricsResults") || "[]");
  results.push(result);
  localStorage.setItem("metricsResults", JSON.stringify(results));

  // ── Navigate to new game form and start next game ─────────────────────────
  // "New Game" button appears after FINAL — click it to navigate (SPA push-state).
  const newGameBtn = document.querySelector('[data-testid="new-game-button"]');
  if (newGameBtn) {
    newGameBtn.click();
  } else {
    // Fallback: push state directly into React Router
    window.history.pushState({}, "", "/exhibition/new");
    window.dispatchEvent(new PopStateEvent("popstate"));
  }
  await sleep(500);
  // Wait for the form to be ready
  await new Promise((r) => {
    const c = () =>
      document.querySelector('[data-testid="new-game-custom-away-team-select"]')
        ? r()
        : setTimeout(c, 100);
    c();
  });
  function setSelect(testId, label) {
    const el = document.querySelector(`[data-testid="${testId}"]`);
    const opt = [...el.options].find((o) => o.text.includes(label));
    const ns = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set;
    ns.call(el, opt.value);
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }
  function setSeed(val) {
    const el = document.querySelector('[data-testid="seed-input"]');
    const ns = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    ns.call(el, val);
    const fk = Object.keys(el).find((k) => k.startsWith("__reactFiber"));
    if (fk) el[fk]?.memoizedProps?.onChange?.({ target: el });
    else el.dispatchEvent(new Event("input", { bubbles: true }));
  }
  setSelect("new-game-custom-away-team-select", nextAway);
  setSelect("new-game-custom-home-team-select", nextHome);
  setSeed(nextSeed);
  await sleep(300);
  document.querySelector('[data-testid="play-ball-button"]').click();
  return {
    collected: result.awayScore + "-" + result.homeScore,
    started: `${nextAway} @ ${nextHome} ${nextSeed}`,
    total: results.length,
  };
})("Charlotte Bears", "Denver Raiders", "s1g2");
```

> **Why this works:** After FINAL the app shows a "New Game" button that navigates to `/exhibition/new` via React Router's SPA push-state (no full page reload). The evaluate continues executing in the same JavaScript context, so you can collect stats and start the next game within a single tool call. If the "New Game" button's `data-testid` is not found, the snippet falls back to `history.pushState`.

#### Reading aggregate results

After any number of games, evaluate this snippet to see running totals:

```js
const r = JSON.parse(localStorage.getItem("metricsResults") || "[]");
const PA = r.reduce((s, g) => s + g.ab + g.bb, 0);
const BB = r.reduce((s, g) => s + g.bb, 0);
const K = r.reduce((s, g) => s + g.k, 0);
const H = r.reduce((s, g) => s + g.h, 0);
const runs = r.reduce((s, g) => s + g.awayScore + g.homeScore, 0);
`${r.length} games | BB%=${((BB / PA) * 100).toFixed(1)}% | K%=${((K / PA) * 100).toFixed(1)}% | H/PA=${(H / PA).toFixed(3)} | R/game=${(runs / r.length).toFixed(1)} | BB/game=${(BB / r.length).toFixed(1)}`;
```

#### Reading console errors and warnings

After a batch of games, use the **`playwright-browser_console_messages`** tool to retrieve all console messages accumulated since the browser session started. This is the most reliable way to see errors across page navigations.

For a quick summary filtered to actionable errors only (excludes known noise like the RxDB premium banner and blocked GTM):

```js
// Evaluate this on any page after the batch to see filtered errors
const KNOWN_NOISE = [
  "ERR_BLOCKED_BY_CLIENT",
  "RxDB Open Core RxStorage",
  "AudioContext",
  "useRxdbGameSync: failed to update progress",
];
const msgs = JSON.parse(localStorage.getItem("metricsConsoleErrors") || "[]");
const filtered = msgs.filter((m) => !KNOWN_NOISE.some((n) => m.includes(n)));
filtered.length ? filtered.slice(0, 20).join("\n") : "No unexpected errors";
```

Common expected errors during Instant-mode batch runs:

| Error                                                      | Cause                                   | Impact               |
| ---------------------------------------------------------- | --------------------------------------- | -------------------- |
| `useRxdbGameSync: failed to update progress (game over)`   | Rapid navigation races RxDB write chain | None — cosmetic only |
| `useRxdbGameSync: failed to update progress (half-inning)` | Same as above                           | None — cosmetic only |
| `ERR_BLOCKED_BY_CLIENT` (GTM)                              | Ad-blocker in browser                   | None                 |
| RxDB premium upsell banner                                 | Expected on every RxDB init             | None                 |

If you see errors outside this table — especially React render errors, unhandled rejections, or `TypeError` — investigate before accepting the metrics.

#### Efficiency: single-tab batch loop (recommended approach)

**⚠️ Background tabs do NOT advance.** Browsers throttle background-tab JavaScript timers to a minimum of ~1000ms. In Instant mode, a game that completes in <100ms on the active tab would take several minutes frozen in a background tab. Do not rely on pipelining across tabs.

The recommended approach is the **single-tab batch-loop evaluate**: a single `playwright-browser_evaluate` call that loops over multiple games sequentially on the active tab. Simulation in Instant mode takes <100ms per game; the only overhead is the polling sleep calls inside the evaluate. 10 games complete inside a single evaluate call in ~2–3 seconds of wall-clock time.

```js
// Single batch-loop evaluate: runs N games on the current tab in one MCP call.
// ⬇ Edit these three values before calling:
const away = "Charlotte Bears"; // away team name — must exactly match an imported team name
const home = "Denver Raiders"; // home team name — valid names: Charlotte Bears, Denver Raiders, San Antonio Giants, Portland Foxes, Nashville Comets
const prefix = "s1"; // seed prefix, e.g. 's1' → s1g1, s1g2, …
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function collectGame() {
    let ab = 0,
      h = 0,
      bb = 0,
      k = 0;
    const tabs = document.querySelectorAll('[role="tab"]');
    [0, 1].forEach((i) => {
      if (tabs[i]) {
        tabs[i].click();
        for (const row of document.querySelectorAll("table tbody tr")) {
          const cells = [...row.querySelectorAll("td")];
          if (cells.length < 6) continue;
          const n = (j) => {
            const t = cells[j]?.textContent?.trim();
            return t && t !== "–" ? parseInt(t) || 0 : 0;
          };
          ab += n(2);
          h += n(3);
          bb += n(4);
          k += n(5);
        }
      }
    });
    const sb = document.querySelector('[data-testid="scoreboard"]');
    const hdrs = sb
      ? [...sb.querySelectorAll("thead tr th,thead tr td")].map((c) => c.textContent.trim())
      : [];
    const rIdx = hdrs.indexOf("R");
    const scores = [...(sb?.querySelectorAll("tbody tr") || [])].slice(0, 2).map((r) => {
      const cells = [...r.querySelectorAll("td")];
      return rIdx >= 0 ? parseInt(cells[rIdx]?.textContent?.trim() || "0") || 0 : 0;
    });
    return { ab, h, bb, k, awayScore: scores[0] ?? 0, homeScore: scores[1] ?? 0 };
  }
  function setSelect(testid, val) {
    const el = document.querySelector('[data-testid="' + testid + '"]');
    if (!el) return false;
    const opt = [...el.options].find((o) => o.text.includes(val) || o.value === val);
    if (!opt) return false;
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(el, opt.value);
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }
  function setInput(testid, val) {
    const el = document.querySelector('[data-testid="' + testid + '"]');
    if (!el) return false;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, val);
    const fk = Object.keys(el).find((k) => k.startsWith("__reactFiber"));
    if (fk) el[fk]?.memoizedProps?.onChange?.({ target: el });
    else el.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  }
  async function waitFor(sel, t = 5000) {
    const e = Date.now() + t;
    while (Date.now() < e) {
      if (document.querySelector(sel)) return true;
      await sleep(50);
    }
    return false;
  }
  async function waitForFinal(t = 30000) {
    const e = Date.now() + t;
    while (Date.now() < e) {
      if (document.body.textContent.includes("FINAL")) return true;
      await sleep(100);
    }
    return false;
  }

  const arr = JSON.parse(localStorage.getItem("metricsResults") || "[]");
  const results = [];
  // ⬇ away, home, prefix are defined above — change them before calling

  // Optionally collect an already-FINAL game first
  if (document.body.textContent.includes("FINAL")) {
    const r = collectGame();
    arr.push(r);
    results.push({
      seed: "existing",
      score: `${r.awayScore}-${r.homeScore}`,
      runs: r.awayScore + r.homeScore,
    });
    document.querySelector('[data-testid="new-game-button"]')?.click();
    await sleep(400);
  }

  for (let g = 1; g <= 10; g++) {
    await waitFor('[data-testid="new-game-custom-away-team-select"]');
    setSelect("new-game-custom-away-team-select", away);
    setSelect("new-game-custom-home-team-select", home);
    setInput("seed-input", `${prefix}g${g}`);
    await sleep(200);
    document.querySelector('[data-testid="play-ball-button"]')?.click();
    await waitForFinal(30000);
    const r = collectGame();
    arr.push(r);
    results.push({
      seed: `${prefix}g${g}`,
      score: `${r.awayScore}-${r.homeScore}`,
      runs: r.awayScore + r.homeScore,
    });
    document.querySelector('[data-testid="new-game-button"]')?.click();
    await sleep(400);
  }
  localStorage.setItem("metricsResults", JSON.stringify(arr));
  return { total: arr.length, thisRun: results };
})();
```

**Quick smoke check (100 games, ~50–60 s):** Open 10 tabs, run the snippet above on each (10 games/tab × 10 tabs = 100 games). Useful for direction-checking, not for policy-compliant tuning rounds.

**Minimum tuning round (200 games, ~90–120 s):** Change `g<=10` to `g<=20` in the loop above to collect 20 games per tab. Run across 10 tabs for 200 games total. **200 games is the minimum required before drawing any tuning conclusions.**

**Workflow (applies to both):**

1. Open 10 browser tabs (one per matchup block) — they only need to be on any valid app page.
2. On each tab, run the batch-loop evaluate with the appropriate `away`, `home`, and `prefix` for that matchup block.
3. After all tabs complete, collect aggregate results with the summary snippet below.

**Timing breakdown (verified from actual 108-game run on 2026-03-09):**

- Simulation time per game: **<100ms** (essentially zero in Instant mode on active tab)
- Time per batch-loop evaluate (10 games): **~2–3 seconds** (MCP tool-call overhead only)
- Tab-switch calls: **~2 seconds each**
- Total for 100 games (10 tabs × 10 games, loop `g<=10`): **~10 evaluate calls + 10 tab-switch calls ≈ 50–60 seconds**
- Total for 200 games (10 tabs × 20 games, loop `g<=20`): **~10 evaluate calls + 10 tab-switch calls ≈ 90–120 seconds**

The game simulation in Instant mode is never the bottleneck. The only overhead is MCP tool-call round-trips.

### Playwright spec runner: reference implementation for automated runs

`e2e/tests/metrics-baseline.spec.ts` is the **canonical automated implementation** of the above MCP workflow. It is:

- A faithful, self-contained reference showing exactly what a correct 200-game metrics run looks like
- Useful for running metrics in CI or in a human terminal session without MCP
- Configured via `playwright-metrics.config.ts` (60-minute timeout, desktop Chromium)
- **Captures all console errors and warnings** via a `page.on('console', ...)` listener and prints a filtered summary (excluding known noise) after the metrics box
- **Not the fastest option for agent sessions** — it runs games sequentially (one at a time), taking ~20–25 minutes for 200 games. The single-tab batch-loop approach above can collect 200 games in under 2 minutes of wall-clock time via MCP.

```bash
# Build first, then run the spec
yarn build
npx playwright test --config=playwright-metrics.config.ts --project=desktop
```

The spec runs `GAMES_PER_BLOCK` games per matchup block. `GAMES_PER_BLOCK = 20` gives 200 games (the minimum per tuning-round policy). Change it to `30` for a 300-game final validation run.

### Vitest in-process harness vs browser run

The project has three ways to measure simulation metrics at scale:

|                    | Stock-team harness                        | Custom-team harness                              | Browser run (MCP or spec)                           |
| ------------------ | ----------------------------------------- | ------------------------------------------------ | --------------------------------------------------- |
| **File**           | `src/test/calibration/simHarness.test.ts` | `src/test/calibration/customTeamMetrics.test.ts` | MCP browser / `metrics-baseline.spec.ts`            |
| **Speed**          | ~5 s                                      | ~30 s                                            | ~2 min (MCP batch-loop) / ~20–25 min (spec)         |
| **Teams**          | All-balanced stock players                | `metrics-teams.json` fixture                     | `metrics-teams.json` fixture                        |
| **Environment**    | Node.js only                              | Node.js only                                     | Full Chrome + RxDB + React                          |
| **RNG sequence**   | Pure game logic                           | Pure game logic                                  | Extra `random()` calls from React, RxDB, audio, TTS |
| **Authoritative?** | ❌ Directional only                       | ❌ Directional only                              | ✅ Ground truth                                     |
| **Use for**        | Fastest iteration signal                  | Better fixture match                             | Required final validation                           |

**Key rule:** Never claim a tuning success based solely on the in-process harness. The harness provides a fast directional signal (seconds), but the browser run is the only valid apple-to-apple comparison against prior browser baselines. The harness BB% is typically **~1–2 pp lower** than browser BB% due to PRNG sequence differences.

If the harness and browser results move in opposite directions, the browser result is correct.
