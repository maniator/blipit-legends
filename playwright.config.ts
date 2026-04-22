import { defineConfig, devices } from "@playwright/test";

const isCI = !!process.env.CI;
const takeScreenshots = !!process.env.PLAYWRIGHT_SCREENSHOTS;

export default defineConfig({
  testDir: "./e2e/tests",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 4 : undefined,
  timeout: 90_000,
  // In CI: each shard writes a blob report; the merge-reports job combines them
  // into a single HTML report (playwright-report-merged artifact, 14-day retention).
  // "line" reporter prints each test result immediately as it finishes, so
  // failures surface during the run rather than only at the end.  This lets
  // you start fixing the first failing test while remaining shards are still
  // running, instead of waiting for the full shard to complete.
  reporter: isCI
    ? [["github"], ["blob"], ["line"]]
    : [["line"], ["json", { outputFile: "playwright-report/report.json" }]],
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    // ── Determinism tests ──────────────────────────────────────────────────
    // Run only on desktop Chromium: these tests verify PRNG reproducibility,
    // not viewport behaviour.  Each test spawns two sequential fresh browser
    // contexts, so running on all 6 device projects would be very slow and
    // add no additional value.
    {
      name: "determinism",
      testMatch: "**/determinism.spec.ts",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },

    // ── Screenshots (on-demand only) ──────────────────────────────────────
    // Run manually to regenerate docs/screenshots/:
    //   PLAYWRIGHT_SCREENSHOTS=1 npx playwright test --project=screenshots
    // Excluded from normal local runs and CI unless the env var is set.
    ...(takeScreenshots
      ? [
          {
            name: "screenshots",
            testMatch: "**/take-screenshots.spec.ts",
            use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
          },
        ]
      : []),

    // ── All other tests ────────────────────────────────────────────────────
    {
      name: "desktop",
      testIgnore: [
        "**/determinism.spec.ts",
        "**/metrics-baseline.spec.ts",
        "**/take-screenshots.spec.ts",
      ],
      // Static project routing for formerly runtime-skipped tests.
      grepInvert: /@mobile-only|@iphone-15-only|@flaky/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    {
      name: "tablet",
      testIgnore: [
        "**/determinism.spec.ts",
        "**/batting-stats.spec.ts",
        "**/metrics-baseline.spec.ts",
        "**/take-screenshots.spec.ts",
      ],
      // Tablet excludes desktop-, chromium-, iPhone-15-, and phone-only tests.
      grepInvert: /@desktop-only|@chromium-only|@iphone-15-only|@mobile-only|@flaky/,
      use: { ...devices["iPad (gen 7)"], viewport: { width: 820, height: 1180 } },
    },
    {
      name: "iphone-15-pro-max",
      testIgnore: [
        "**/determinism.spec.ts",
        "**/batting-stats.spec.ts",
        "**/metrics-baseline.spec.ts",
        "**/take-screenshots.spec.ts",
      ],
      // Pro Max runs mobile tests, but not desktop/chromium/iPhone-15-specific ones.
      grepInvert: /@desktop-only|@chromium-only|@iphone-15-only|@flaky/,
      use: { ...devices["iPhone 15 Pro Max"] },
    },
    {
      name: "iphone-15",
      testIgnore: [
        "**/determinism.spec.ts",
        "**/batting-stats.spec.ts",
        "**/metrics-baseline.spec.ts",
        "**/take-screenshots.spec.ts",
      ],
      // iPhone 15 is the only project that runs @iphone-15-only snapshots.
      grepInvert: /@desktop-only|@chromium-only|@flaky/,
      use: { ...devices["iPhone 15"] },
    },
    {
      name: "pixel-7",
      testIgnore: [
        "**/determinism.spec.ts",
        "**/batting-stats.spec.ts",
        "**/metrics-baseline.spec.ts",
        "**/take-screenshots.spec.ts",
      ],
      // Pixel runs mobile and chromium tests, but excludes desktop/iPhone-15-specific ones.
      grepInvert: /@desktop-only|@iphone-15-only|@flaky/,
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "pixel-5",
      testIgnore: [
        "**/determinism.spec.ts",
        "**/batting-stats.spec.ts",
        "**/metrics-baseline.spec.ts",
        "**/take-screenshots.spec.ts",
      ],
      // Pixel runs mobile and chromium tests, but excludes desktop/iPhone-15-specific ones.
      grepInvert: /@desktop-only|@iphone-15-only|@flaky/,
      use: { ...devices["Pixel 5"] },
    },
  ],
  // Serve the production build for stable, dev-mode-free E2E tests.
  // Run `yarn build` first locally if dist/ is stale.
  webServer: {
    command: "npx vite preview --port 5173",
    url: "http://localhost:5173",
    reuseExistingServer: !isCI,
    stdout: "ignore",
    stderr: "pipe",
    timeout: 120_000,
  },
});
