import { expect, test } from "@playwright/test";

import { disableAnimations, resetAppState } from "../../utils/helpers";

// Visual snapshots for the Teams Import/Export section UI states.
// Separated from team-editor.visual.spec.ts to keep both files under the
// 500-line warning threshold enforced by scripts/check-spec-sizes.mjs.

/** Snapshot diff tolerance shared across all import/export state snapshots. */
const IMPORT_EXPORT_SNAPSHOT_OPTIONS = { maxDiffPixelRatio: 0.05 } as const;

test.describe("Visual — Teams Import/Export UI states", { tag: "@desktop-only" }, () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
    await disableAnimations(page);
  });

  test("import/export section empty state (no teams)", async ({ page }) => {
    await page.getByTestId("home-manage-teams-button").click();
    await expect(page.getByTestId("manage-teams-screen")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("teams-import-export-section")).toBeVisible();

    await expect(page.getByTestId("teams-import-export-section")).toHaveScreenshot(
      "teams-import-export-empty.png",
      IMPORT_EXPORT_SNAPSHOT_OPTIONS,
    );
  });

  test("import error state after invalid file", async ({ page }, testInfo) => {
    await page.getByTestId("home-manage-teams-button").click();
    await expect(page.getByTestId("manage-teams-screen")).toBeVisible({ timeout: 10_000 });

    // Upload a file with wrong type to trigger an error
    const { writeFileSync, mkdirSync } = await import("fs");
    const { join, dirname } = await import("path");
    const tmpFile = join(testInfo.outputDir, "bad-import.json");
    // Playwright creates outputDir lazily; mkdirSync ensures it exists before writeFileSync.
    mkdirSync(dirname(tmpFile), { recursive: true });
    writeFileSync(tmpFile, '{"type":"saves","formatVersion":1,"payload":{}}');

    await page.getByTestId("import-teams-file-input").setInputFiles(tmpFile);
    await expect(page.getByTestId("import-teams-error")).toBeVisible({ timeout: 5_000 });

    await expect(page.getByTestId("teams-import-export-section")).toHaveScreenshot(
      "teams-import-export-error.png",
      IMPORT_EXPORT_SNAPSHOT_OPTIONS,
    );
  });

  test("import success summary after importing a team", async ({ page }, testInfo) => {
    // Create a team, export it, delete it, then re-import to reach success state
    await page.getByTestId("home-manage-teams-button").click();
    await expect(page.getByTestId("manage-teams-screen")).toBeVisible({ timeout: 10_000 });

    await page.getByTestId("manage-teams-create-button").click();
    await page.getByTestId("custom-team-regenerate-defaults-button").click();
    await page.getByTestId("custom-team-name-input").fill("Snapshot Success Team");
    await page.getByTestId("custom-team-save-button").click();
    await expect(page.getByTestId("manage-teams-screen")).toBeVisible({ timeout: 10_000 });

    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("export-all-teams-button").click();
    const download = await downloadPromise;

    const { join } = await import("path");
    const tmpFile = join(testInfo.outputDir, "snapshot-success-team.json");
    await download.saveAs(tmpFile);

    page.once("dialog", (d) => d.accept());
    await page.getByTestId("custom-team-delete-button").click();
    await expect(page.getByText(/no custom teams yet/i)).toBeVisible({ timeout: 5_000 });

    await page.getByTestId("import-teams-file-input").setInputFiles(tmpFile);
    await expect(page.getByTestId("import-teams-success")).toBeVisible({ timeout: 10_000 });

    await expect(page.getByTestId("teams-import-export-section")).toHaveScreenshot(
      "teams-import-export-success.png",
      IMPORT_EXPORT_SNAPSHOT_OPTIONS,
    );
  });

  test("export-all button visible when teams exist", async ({ page }) => {
    await page.getByTestId("home-manage-teams-button").click();
    await expect(page.getByTestId("manage-teams-screen")).toBeVisible({ timeout: 10_000 });

    await page.getByTestId("manage-teams-create-button").click();
    await page.getByTestId("custom-team-regenerate-defaults-button").click();
    await page.getByTestId("custom-team-name-input").fill("Export Button Team");
    await page.getByTestId("custom-team-save-button").click();
    await expect(page.getByTestId("manage-teams-screen")).toBeVisible({ timeout: 10_000 });

    await expect(page.getByTestId("export-all-teams-button")).toBeVisible();

    await expect(page.getByTestId("teams-import-export-section")).toHaveScreenshot(
      "teams-import-export-with-export-button.png",
      IMPORT_EXPORT_SNAPSHOT_OPTIONS,
    );
  });
});
