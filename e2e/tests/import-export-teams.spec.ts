/**
 * E2E tests for Custom Teams Import/Export feature.
 * Desktop-only: file download and file input are easiest to verify on desktop Chromium.
 */
import { expect, test } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

import { fnv1a } from "../../src/storage/hash";
import { computeTeamsSignature, resetAppState } from "../utils/helpers";

type TeamsExportBundle = {
  payload: {
    teams: Array<{ roster: { lineup: unknown[]; bench?: unknown[]; pitchers: unknown[] } }>;
  };
  sig?: string;
};

/**
 * Recomputes per-player signatures and bundle signature after tests mutate
 * exported JSON to emulate legacy/compat payloads before re-importing.
 */
function resignTeamsBundle(bundle: TeamsExportBundle) {
  for (const team of bundle.payload.teams) {
    for (const slot of [team.roster.lineup, team.roster.bench ?? [], team.roster.pitchers]) {
      for (const rawPlayer of slot as Array<Record<string, unknown>>) {
        const signatureInput = {
          name: rawPlayer.name,
          role: rawPlayer.role,
          batting: rawPlayer.batting,
          pitching: rawPlayer.pitching,
        };
        rawPlayer.sig = fnv1a(JSON.stringify(signatureInput));
      }
    }
  }

  bundle.sig = fnv1a(`ballgame:teams:v1${JSON.stringify(bundle.payload)}`);
  return bundle;
}

test.describe("Custom Teams — Import/Export", { tag: "@desktop-only" }, () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  test("export-all button downloads a signed teams JSON file with player sigs", async ({
    page,
  }, testInfo) => {
    await page.getByTestId("home-manage-teams-button").click();
    await expect(page.getByTestId("manage-teams-screen")).toBeVisible({ timeout: 10_000 });

    // Create a team
    await page.getByTestId("manage-teams-create-button").click();
    await page.getByTestId("custom-team-regenerate-defaults-button").click();
    await page.getByTestId("custom-team-name-input").fill("Export Test Team");
    await page.getByTestId("custom-team-save-button").click();
    await expect(page.getByTestId("manage-teams-screen")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("custom-team-list")).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("export-all-teams-button").click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^ballgame-teams-.*\.json$/);

    const tmpPath = path.join(testInfo.outputDir, "exported-teams.json");
    await download.saveAs(tmpPath);
    const parsed = JSON.parse(fs.readFileSync(tmpPath, "utf-8"));

    // Top-level shape
    expect(parsed.type).toBe("customTeams");
    expect(parsed.formatVersion).toBe(1);
    expect(typeof parsed.exportedAt).toBe("string");
    expect(Array.isArray(parsed.payload.teams)).toBe(true);
    expect(parsed.payload.teams.length).toBeGreaterThan(0);
    expect(parsed.payload.teams[0].name).toBe("Export Test Team");

    // Bundle-level signature is present and correct
    expect(typeof parsed.sig).toBe("string");
    expect(parsed.sig).toMatch(/^[0-9a-f]{8}$/);
    const expectedSig = await computeTeamsSignature(page, parsed.payload);
    expect(parsed.sig).toBe(expectedSig);

    // Team fingerprint is embedded
    expect(typeof parsed.payload.teams[0].fingerprint).toBe("string");

    // Every lineup player has a sig
    const lineup = parsed.payload.teams[0].roster.lineup as { sig?: string }[];
    expect(lineup.length).toBeGreaterThan(0);
    for (const player of lineup) {
      expect(typeof player.sig).toBe("string");
      expect(player.sig).toMatch(/^[0-9a-f]{8}$/);
    }
  });

  test("per-team export button downloads a JSON file for that team only", async ({
    page,
  }, testInfo) => {
    await page.getByTestId("home-manage-teams-button").click();
    await expect(page.getByTestId("manage-teams-screen")).toBeVisible({ timeout: 10_000 });

    for (const name of ["Alpha Team", "Beta Team"]) {
      await page.getByTestId("manage-teams-create-button").click();
      await page.getByTestId("custom-team-regenerate-defaults-button").click();
      await page.getByTestId("custom-team-name-input").fill(name);
      await page.getByTestId("custom-team-save-button").click();
      await expect(page.getByTestId("manage-teams-screen")).toBeVisible({ timeout: 10_000 });
    }

    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("export-team-button").first().click();
    const download = await downloadPromise;

    const tmpPath = path.join(testInfo.outputDir, "per-team-export.json");
    await download.saveAs(tmpPath);
    const parsed = JSON.parse(fs.readFileSync(tmpPath, "utf-8"));
    expect(parsed.payload.teams).toHaveLength(1);
    // Bundle signature must be present
    expect(typeof parsed.sig).toBe("string");
  });

  test("import teams from exported file — success message and new team visible in list", async ({
    page,
  }, testInfo) => {
    await page.getByTestId("home-manage-teams-button").click();
    await expect(page.getByTestId("manage-teams-screen")).toBeVisible({ timeout: 10_000 });

    await page.getByTestId("manage-teams-create-button").click();
    await page.getByTestId("custom-team-regenerate-defaults-button").click();
    await page.getByTestId("custom-team-name-input").fill("Import Round Trip");
    await page.getByTestId("custom-team-save-button").click();
    await expect(page.getByTestId("manage-teams-screen")).toBeVisible({ timeout: 10_000 });

    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("export-all-teams-button").click();
    const download = await downloadPromise;
    const tmpPath = path.join(testInfo.outputDir, "round-trip.json");
    await download.saveAs(tmpPath);

    // Delete the team so we can import it back cleanly
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByTestId("custom-team-delete-button").click();
    await expect(page.getByText(/no custom teams yet/i)).toBeVisible({ timeout: 5_000 });

    await page.getByTestId("import-teams-file-input").setInputFiles(tmpPath);
    await expect(page.getByTestId("import-teams-success")).toBeVisible({ timeout: 10_000 });

    await expect(page.getByTestId("custom-team-list")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("Import Round Trip")).toBeVisible();
  });

  test("re-importing the same team is silently skipped (no duplicate created)", async ({
    page,
  }, testInfo) => {
    await page.getByTestId("home-manage-teams-button").click();
    await expect(page.getByTestId("manage-teams-screen")).toBeVisible({ timeout: 10_000 });

    await page.getByTestId("manage-teams-create-button").click();
    await page.getByTestId("custom-team-regenerate-defaults-button").click();
    await page.getByTestId("custom-team-name-input").fill("Exact Copy Team");
    await page.getByTestId("custom-team-save-button").click();
    await expect(page.getByTestId("manage-teams-screen")).toBeVisible({ timeout: 10_000 });

    // Verify only 1 team before re-import
    const listBefore = page.getByTestId("custom-team-list-item");
    await expect(listBefore).toHaveCount(1);

    // Export the team
    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("export-all-teams-button").click();
    const download = await downloadPromise;
    const tmpPath = path.join(testInfo.outputDir, "dup-team.json");
    await download.saveAs(tmpPath);

    // Re-import without deleting — exact duplicate should be skipped, not create a second entry
    await page.getByTestId("import-teams-file-input").setInputFiles(tmpPath);
    await expect(page.getByTestId("import-teams-success")).toBeVisible({ timeout: 10_000 });
    const successText = await page.getByTestId("import-teams-success").textContent();
    expect(successText).toMatch(/already exist/i);

    // Still only 1 team — no duplicate created
    const listAfter = page.getByTestId("custom-team-list-item");
    await expect(listAfter).toHaveCount(1);
  });

  test("import shows error for a file with wrong type", async ({ page }, testInfo) => {
    await page.getByTestId("home-manage-teams-button").click();
    await expect(page.getByTestId("manage-teams-screen")).toBeVisible({ timeout: 10_000 });

    const badPath = path.join(testInfo.outputDir, "bad-teams.json");
    fs.mkdirSync(path.dirname(badPath), { recursive: true });
    fs.writeFileSync(badPath, '{"type":"saves","formatVersion":1,"payload":{}}');

    await page.getByTestId("import-teams-file-input").setInputFiles(badPath);
    await expect(page.getByTestId("import-teams-error")).toBeVisible({ timeout: 10_000 });
  });

  test("import rejects a file with a tampered bundle signature", async ({ page }, testInfo) => {
    await page.getByTestId("home-manage-teams-button").click();
    await expect(page.getByTestId("manage-teams-screen")).toBeVisible({ timeout: 10_000 });

    await page.getByTestId("manage-teams-create-button").click();
    await page.getByTestId("custom-team-regenerate-defaults-button").click();
    await page.getByTestId("custom-team-name-input").fill("Tamper Target");
    await page.getByTestId("custom-team-save-button").click();
    await expect(page.getByTestId("manage-teams-screen")).toBeVisible({ timeout: 10_000 });

    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("export-all-teams-button").click();
    const download = await downloadPromise;
    const tmpPath = path.join(testInfo.outputDir, "export.json");
    await download.saveAs(tmpPath);

    // Tamper: flip the bundle sig
    const obj = JSON.parse(fs.readFileSync(tmpPath, "utf-8"));
    obj.sig = "00000000";
    const tamperedPath = path.join(testInfo.outputDir, "tampered-teams.json");
    fs.writeFileSync(tamperedPath, JSON.stringify(obj));

    await page.getByTestId("import-teams-file-input").setInputFiles(tamperedPath);
    await expect(page.getByTestId("import-teams-error")).toBeVisible({ timeout: 10_000 });
    const errText = await page.getByTestId("import-teams-error").textContent();
    expect(errText).toMatch(/signature mismatch/i);
  });

  test("import backfills missing position/handedness and missing batting/pitching stamina defaults", async ({
    page,
  }, testInfo) => {
    await page.getByTestId("home-manage-teams-button").click();
    await expect(page.getByTestId("manage-teams-screen")).toBeVisible({ timeout: 10_000 });

    await page.getByTestId("manage-teams-create-button").click();
    await page.getByTestId("custom-team-regenerate-defaults-button").click();
    await page.getByTestId("custom-team-name-input").fill("Compat Backfill Team");
    await page.getByTestId("custom-team-save-button").click();
    await expect(page.getByText("Compat Backfill Team")).toBeVisible({ timeout: 10_000 });

    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("export-all-teams-button").click();
    const download = await downloadPromise;
    const exportedPath = path.join(testInfo.outputDir, "compat-export.json");
    await download.saveAs(exportedPath);

    const compatObj = JSON.parse(fs.readFileSync(exportedPath, "utf-8"));
    const team = compatObj.payload.teams[0];
    delete team.roster.lineup[0].position;
    delete team.roster.lineup[0].handedness;
    delete team.roster.lineup[0].batting.stamina;
    delete team.roster.pitchers[0].position;
    delete team.roster.pitchers[0].handedness;
    delete team.roster.pitchers[0].pitching.stamina;
    resignTeamsBundle(compatObj);
    const compatPath = path.join(testInfo.outputDir, "compat-missing-fields.json");
    fs.writeFileSync(compatPath, JSON.stringify(compatObj));

    page.once("dialog", (d) => d.accept());
    await page.getByTestId("custom-team-delete-button").first().click();
    await expect(page.getByText(/no custom teams yet/i)).toBeVisible({ timeout: 5_000 });

    await page.getByTestId("import-teams-file-input").setInputFiles(compatPath);
    await expect(page.getByTestId("import-teams-success")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("custom-team-list-item")).toHaveCount(1);

    const roundTripDownloadPromise = page.waitForEvent("download");
    await page.getByTestId("export-all-teams-button").click();
    const roundTripDownload = await roundTripDownloadPromise;
    const roundTripPath = path.join(testInfo.outputDir, "compat-round-trip.json");
    await roundTripDownload.saveAs(roundTripPath);
    const roundTrip = JSON.parse(fs.readFileSync(roundTripPath, "utf-8"));
    expect(roundTrip.payload.teams[0].roster.lineup[0].position).toBeTruthy();
    expect(["R", "L", "S"]).toContain(roundTrip.payload.teams[0].roster.lineup[0].handedness);
    expect(roundTrip.payload.teams[0].roster.lineup[0].batting.stamina).toBe(50);
    expect(roundTrip.payload.teams[0].roster.pitchers[0].position).toBeTruthy();
    expect(["R", "L", "S"]).toContain(roundTrip.payload.teams[0].roster.pitchers[0].handedness);
    expect(roundTrip.payload.teams[0].roster.pitchers[0].pitching.stamina).toBe(60);
  });

  test("re-importing a compat-normalized team is skipped (no duplicate created)", async ({
    page,
  }, testInfo) => {
    // This test covers the no-migration path: in a fresh E2E DB the legacy bundle is
    // imported directly (no teamSeed), so the stored fingerprint is also seed-free.
    // On re-import, the seed-free incoming fingerprint matches the seed-free stored
    // fingerprint, so the skip is detected correctly.
    // Note: after a v3 DB migration on a real install the stored fingerprint would
    // be seed-based and re-import would NOT be detected as a duplicate — this is a
    // known limitation documented in the importCustomTeams JSDoc.

    await page.getByTestId("home-manage-teams-button").click();
    await expect(page.getByTestId("manage-teams-screen")).toBeVisible({ timeout: 10_000 });

    await page.getByTestId("manage-teams-create-button").click();
    await page.getByTestId("custom-team-regenerate-defaults-button").click();
    await page.getByTestId("custom-team-name-input").fill("Compat Duplicate Team");
    await page.getByTestId("custom-team-save-button").click();
    await expect(page.getByText("Compat Duplicate Team")).toBeVisible({ timeout: 10_000 });

    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("export-all-teams-button").click();
    const download = await downloadPromise;
    const exportedPath = path.join(testInfo.outputDir, "compat-dup-export.json");
    await download.saveAs(exportedPath);

    const compatObj = JSON.parse(fs.readFileSync(exportedPath, "utf-8"));
    const team = compatObj.payload.teams[0];
    delete team.roster.lineup[0].position;
    delete team.roster.lineup[0].handedness;
    delete team.roster.lineup[0].batting.stamina;
    delete team.roster.pitchers[0].position;
    delete team.roster.pitchers[0].handedness;
    delete team.roster.pitchers[0].pitching.stamina;
    resignTeamsBundle(compatObj);
    const compatPath = path.join(testInfo.outputDir, "compat-dup.json");
    fs.writeFileSync(compatPath, JSON.stringify(compatObj));

    page.once("dialog", (d) => d.accept());
    await page.getByTestId("custom-team-delete-button").first().click();
    await expect(page.getByText(/no custom teams yet/i)).toBeVisible({ timeout: 5_000 });

    await page.getByTestId("import-teams-file-input").setInputFiles(compatPath);
    await expect(page.getByTestId("import-teams-success")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("custom-team-list-item")).toHaveCount(1);

    await page.getByTestId("import-teams-file-input").setInputFiles(compatPath);
    await expect(page.getByTestId("import-teams-success")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("import-teams-success")).toContainText(/already exist/i);
    await expect(page.getByTestId("custom-team-list-item")).toHaveCount(1);
  });
});

// ── Cross-team player import blocked with owning-team message ─────────────────

test.describe(
  "Custom Team Editor — cross-team player import conflict",
  { tag: "@desktop-only" },
  () => {
    test.beforeEach(async ({ page }) => {
      await resetAppState(page);
    });

    test("blocks cross-team player import with owning-team error message", async ({
      page,
    }, testInfo) => {
      // ── Step 1: Create Team A and export one of its players ──────────────────
      await page.getByTestId("home-manage-teams-button").click();
      await expect(page.getByTestId("manage-teams-screen")).toBeVisible({ timeout: 10_000 });

      await page.getByTestId("manage-teams-create-button").click();
      await page.getByTestId("custom-team-regenerate-defaults-button").click();
      await page.getByTestId("custom-team-name-input").fill("Team A");
      await page.getByTestId("custom-team-save-button").click();
      await expect(page.getByText("Team A")).toBeVisible({ timeout: 15_000 });

      // Open Team A editor and export the first lineup player
      await page.getByTestId("custom-team-edit-button").first().click();
      await expect(page.getByTestId("custom-team-lineup-section")).toBeVisible({ timeout: 10_000 });
      // Wait explicitly for the export button — this guarantees that Team A's
      // players have been fully loaded from the DB into the editor state before
      // we attempt to export.  On slow CI runners there is a brief window where
      // the lineup section element is visible but the player rows (and their
      // export buttons) have not yet rendered from the async DB hydration.
      await expect(page.getByTestId("export-player-button").first()).toBeVisible({
        timeout: 15_000,
      });

      const downloadPromise = page.waitForEvent("download");
      await page.getByTestId("export-player-button").first().click();
      const download = await downloadPromise;

      const playerPath = path.join(testInfo.outputDir, "team-a-player.json");
      await download.saveAs(playerPath);

      // ── Step 2: Navigate back and create Team B ──────────────────────────────
      await page.getByTestId("manage-teams-editor-back-button").click();
      await expect(page.getByTestId("manage-teams-screen")).toBeVisible({ timeout: 10_000 });

      await page.getByTestId("manage-teams-create-button").click();
      await page.getByTestId("custom-team-regenerate-defaults-button").click();
      await page.getByTestId("custom-team-name-input").fill("Team B");
      await page.getByTestId("custom-team-save-button").click();
      await expect(page.getByText("Team B")).toBeVisible({ timeout: 15_000 });

      // Open Team B editor
      // Find Team B's list item by text and click its edit button to avoid any
      // sort-order ambiguity between Team A and Team B on slow CI runners
      // (sorting by updatedAt desc can be non-deterministic when both timestamps
      // are nearly equal).
      await page
        .getByTestId("custom-team-list-item")
        .filter({ hasText: "Team B" })
        .getByTestId("custom-team-edit-button")
        .click();
      await expect(page.getByTestId("custom-team-lineup-section")).toBeVisible({ timeout: 10_000 });

      // ── Step 3: Attempt to import Team A's player into Team B ─────────────────
      await page.getByTestId("import-lineup-player-input").setInputFiles(playerPath);

      // Current UX uses a lineup-scoped duplicate confirmation banner naming Team A.
      await expect(page.getByTestId("player-import-lineup-duplicate-banner")).toBeVisible({
        timeout: 10_000,
      });
      const errText = await page.getByTestId("player-import-lineup-duplicate-banner").textContent();
      expect(errText).toMatch(/may already exist on team "Team A"/i);
    });
  },
);
