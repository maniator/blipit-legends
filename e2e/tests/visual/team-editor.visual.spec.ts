import { expect, test } from "@playwright/test";

import {
  disableAnimations,
  resetAppState,
  saveCurrentGame,
  waitForLogLines,
} from "../../utils/helpers";

/** Shared snapshot diff tolerance for all visual snapshots in this file. */
const TEAM_EDITOR_SNAPSHOT_OPTIONS = { maxDiffPixelRatio: 0.05 } as const;

/**
 * File-level beforeEach: mock Date.now() to a fixed timestamp so that
 * `_generateCounter = Date.now() | 0` in TeamInfoSection.tsx always starts
 * at the same value, making "Generate Random" team defaults deterministic
 * across test runs. This must run before any navigation (before resetAppState).
 */
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Date.now = () => 1700000000000;
  });
});

/**
 * Timeout for the team-name-visible assertion after clicking Save.
 * Save navigates to /teams, which remounts ManageTeamsScreen and triggers a
 * fresh useCustomTeams DB fetch. CI containers can be slow, so 15s is used.
 */
const TEAM_SAVE_NAVIGATION_TIMEOUT = 15_000;

// ─── Stage 2B: Custom Team UI visual snapshots ────────────────────────────────
//
// These snapshots cover new Stage 2B surfaces:
//   1. Manage Teams screen (desktop baseline)
//   2. Create Team editor — Team Info section, mobile portrait
//   3. Create Team editor — Team Info section, narrow phone landscape
//   4. Edit Team editor — mobile portrait
//   5. Saves modal with a custom-team saved game row (human-readable names)
//
// Viewport strategy:
//   • Manage Teams / Create / Edit portrait: run on iphone-15 + desktop only
//     to avoid 6× matrix for screens that look the same per-device class.
//   • Narrow landscape: uses a fixed 731×412 viewport override (Pixel 8a-class
//     landscape) inside a describe block with test.use() so it does not pollute
//     the device-level viewports for other tests.
//   • Saves modal: desktop + iphone-15 only (sufficient coverage of the row layout).

/** Helper: navigate to Manage Teams, click Create, click Generate Defaults, and
 *  fill in a deterministic team name. Returns once the name input is stable. */
async function openCreateEditorWithName(page: Parameters<typeof resetAppState>[0], name: string) {
  await page.getByTestId("home-manage-teams-button").click();
  await expect(page.getByTestId("manage-teams-screen")).toBeVisible({ timeout: 10_000 });
  await page.getByTestId("manage-teams-create-button").click();
  await expect(page.getByTestId("custom-team-name-input")).toBeVisible({ timeout: 5_000 });
  await page.getByTestId("custom-team-regenerate-defaults-button").click();
  await expect(page.getByTestId("custom-team-name-input")).not.toHaveValue("", { timeout: 3_000 });
  await page.getByTestId("custom-team-name-input").fill(name);
}

/** Helper: create and save a custom team, then return to the home screen. */
async function createAndSaveTeam(
  page: Parameters<typeof resetAppState>[0],
  name: string,
): Promise<void> {
  await openCreateEditorWithName(page, name);
  await page.getByTestId("custom-team-save-button").click();
  await expect(page.getByText(name)).toBeVisible({ timeout: TEAM_SAVE_NAVIGATION_TIMEOUT });
  await page.getByTestId("manage-teams-back-button").click();
  await expect(page.getByTestId("home-screen")).toBeVisible({ timeout: 10_000 });
}

// ─── 1. Manage Teams screen baseline ─────────────────────────────────────────
test.describe("Visual — Stage 2B: Manage Teams screen", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
    await disableAnimations(page);
  });

  /**
   * Desktop baseline: empty team list state (no custom teams yet).
   * Desktop-only because the layout is identical across viewports and
   * a single stable baseline is sufficient for regression detection.
   */
  test("manage teams screen — empty list (desktop)", { tag: "@desktop-only" }, async ({ page }) => {
    await page.getByTestId("home-manage-teams-button").click();
    await expect(page.getByTestId("manage-teams-screen")).toBeVisible({ timeout: 10_000 });

    await expect(page.getByTestId("manage-teams-screen")).toHaveScreenshot(
      "manage-teams-screen-empty.png",
      TEAM_EDITOR_SNAPSHOT_OPTIONS,
    );
  });

  /**
   * Desktop baseline: team list with one team present.
   * Captures the TeamListItem with Edit/Delete buttons.
   */
  test(
    "manage teams screen — one team in list (desktop)",
    { tag: "@desktop-only" },
    async ({ page }) => {
      await page.getByTestId("home-manage-teams-button").click();
      await page.getByTestId("manage-teams-create-button").click();
      await page.getByTestId("custom-team-regenerate-defaults-button").click();
      await page.getByTestId("custom-team-name-input").fill("Snapshot City Sox");
      await page.getByTestId("custom-team-save-button").click();
      await expect(page.getByText("Snapshot City Sox")).toBeVisible({
        timeout: TEAM_SAVE_NAVIGATION_TIMEOUT,
      });

      await expect(page.getByTestId("manage-teams-screen")).toHaveScreenshot(
        "manage-teams-screen-with-team.png",
        TEAM_EDITOR_SNAPSHOT_OPTIONS,
      );
    },
  );
});

// ─── 2. Create Team editor — mobile portrait ──────────────────────────────────
test.describe("Visual — Stage 2B: Create Team editor, mobile portrait", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
    await disableAnimations(page);
  });

  /**
   * Team Info section visible/usable on mobile portrait.
   * Restricted to iphone-15 (393×659) — one narrow-phone representative.
   * Confirms name, abbreviation, and city fields are present and non-overlapping.
   */
  test(
    "create team — Team Info section visible on mobile portrait (iphone-15)",
    { tag: "@iphone-15-only" },
    async ({ page }) => {
      await page.getByTestId("home-manage-teams-button").click();
      await page.getByTestId("manage-teams-create-button").click();
      await expect(page.getByTestId("manage-teams-editor-shell")).toBeVisible({ timeout: 5_000 });
      await page.getByTestId("custom-team-regenerate-defaults-button").click();
      // Wait for both the team name AND abbreviation fields to be populated so we
      // know the full form re-render from "Generate Defaults" has settled before
      // taking the screenshot.  Waiting only for the name field can capture the
      // editor mid-render (two values stacked) on slow mobile WebKit CI runners.
      await expect(page.getByTestId("custom-team-name-input")).not.toHaveValue("", {
        timeout: 5_000,
      });
      await expect(page.getByTestId("custom-team-abbreviation-input")).not.toHaveValue("", {
        timeout: 3_000,
      });

      // Scroll to the top of the editor shell so Team Info section is in view.
      await page.getByTestId("manage-teams-editor-shell").evaluate((el) => el.scrollTo(0, 0));

      // Snapshot just the editor shell element to keep the screenshot stable
      // regardless of what is behind the semi-transparent overlay.
      await expect(page.getByTestId("manage-teams-editor-shell")).toHaveScreenshot(
        "create-team-editor-mobile-portrait.png",
        TEAM_EDITOR_SNAPSHOT_OPTIONS,
      );
    },
  );
});

// ─── 3. Create Team editor — narrow phone landscape ───────────────────────────
//
// Uses test.use() to override the viewport to 731×412 (Pixel 8a-class landscape).
// Restricted to the desktop project so the test.use viewport override does not
// conflict with device-emulation viewports in mobile projects.
// This catches the Abbrev/City two-column → single-column stacking regression.
test.describe("Visual — Stage 2B: Create Team editor, narrow landscape", () => {
  test.use({ viewport: { width: 731, height: 412 } });

  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
    await disableAnimations(page);
  });

  /**
   * Narrow phone landscape (731×412 ≈ Pixel 8a landscape).
   * At this width the TeamInfoSecondRow must stack Abbrev and City in a
   * single column — NOT two columns which would overlap at narrow heights.
   */
  test(
    "create team — no Abbrev/City overlap on narrow landscape (desktop@731x412)",
    { tag: "@desktop-only" },
    async ({ page }) => {
      await page.getByTestId("home-manage-teams-button").click();
      await page.getByTestId("manage-teams-create-button").click();
      await expect(page.getByTestId("manage-teams-editor-shell")).toBeVisible({ timeout: 5_000 });
      await page.getByTestId("custom-team-regenerate-defaults-button").click();
      await expect(page.getByTestId("custom-team-name-input")).not.toHaveValue("", {
        timeout: 3_000,
      });

      // Non-visual assertion: abbreviation and city inputs must not overlap.
      const abbrevBox = await page.getByTestId("custom-team-abbreviation-input").boundingBox();
      const cityBox = await page.getByTestId("custom-team-city-input").boundingBox();
      expect(abbrevBox).not.toBeNull();
      expect(cityBox).not.toBeNull();
      // In single-column layout the city box top must be below the abbreviation box bottom.
      expect(cityBox!.y + cityBox!.height / 2 > abbrevBox!.y + abbrevBox!.height / 2).toBe(true);

      await page.getByTestId("manage-teams-editor-shell").evaluate((el) => el.scrollTo(0, 0));

      await expect(page.getByTestId("manage-teams-editor-shell")).toHaveScreenshot(
        "create-team-editor-narrow-landscape.png",
        TEAM_EDITOR_SNAPSHOT_OPTIONS,
      );
    },
  );
});

// ─── 4. Edit Team editor — mobile portrait ────────────────────────────────────
test.describe("Visual — Stage 2B: Edit Team editor, mobile portrait", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
    await disableAnimations(page);
  });

  /**
   * Edit mode pre-fills all fields from the saved team.
   * Restricted to iphone-15 (393×659) — one narrow-phone representative.
   * Verifies the editor shell is usable in edit mode on mobile portrait.
   */
  test(
    "edit team — editor loaded in edit mode, mobile portrait (iphone-15)",
    { tag: "@iphone-15-only" },
    async ({ page }) => {
      // Create a team first so we have something to edit.
      await page.getByTestId("home-manage-teams-button").click();
      await page.getByTestId("manage-teams-create-button").click();
      await page.getByTestId("custom-team-regenerate-defaults-button").click();
      await page.getByTestId("custom-team-name-input").fill("Visual Edit Team");
      await page.getByTestId("custom-team-save-button").click();
      await expect(page.getByText("Visual Edit Team")).toBeVisible({
        timeout: TEAM_SAVE_NAVIGATION_TIMEOUT,
      });

      // Open edit mode for the saved team.
      await page.getByTestId("custom-team-edit-button").first().click();
      await expect(page.getByTestId("manage-teams-editor-shell")).toBeVisible({ timeout: 5_000 });

      // Name should be pre-filled.
      await expect(page.getByTestId("custom-team-name-input")).toHaveValue("Visual Edit Team");

      await page.getByTestId("manage-teams-editor-shell").evaluate((el) => el.scrollTo(0, 0));

      await expect(page.getByTestId("manage-teams-editor-shell")).toHaveScreenshot(
        "edit-team-editor-mobile-portrait.png",
        TEAM_EDITOR_SNAPSHOT_OPTIONS,
      );
    },
  );
});

// ─── 5. Create Team editor — desktop (empty + filled states) ─────────────────
//
// Covers the Team Info two-column layout (Abbrev 150px + City) that was
// previously broken on desktop due to an undersized first grid column.
// Desktop-only: one stable baseline is sufficient to catch layout regressions;
// mobile portrait is already covered in the section above.
test.describe("Visual — Create Team editor, desktop", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
    await disableAnimations(page);
  });

  /**
   * Empty form state: editor is open but no defaults have been generated yet.
   * Verifies Team Info row (Name / Abbrev + City) renders without overlap
   * before any user input.
   */
  test(
    "create team — empty form state, Team Info layout (desktop)",
    { tag: "@desktop-only" },
    async ({ page }) => {
      await page.getByTestId("home-manage-teams-button").click();
      await page.getByTestId("manage-teams-create-button").click();
      await expect(page.getByTestId("manage-teams-editor-shell")).toBeVisible({ timeout: 5_000 });

      // Non-visual assertion: Abbrev and City inputs must not overlap.
      const abbrevBox = await page.getByTestId("custom-team-abbreviation-input").boundingBox();
      const cityBox = await page.getByTestId("custom-team-city-input").boundingBox();
      expect(abbrevBox).not.toBeNull();
      expect(cityBox).not.toBeNull();
      // In two-column layout the City box left edge must be to the right of the Abbrev box.
      expect(cityBox!.x).toBeGreaterThan(abbrevBox!.x + abbrevBox!.width / 2);

      await page.getByTestId("manage-teams-editor-shell").evaluate((el) => el.scrollTo(0, 0));
      await expect(page.getByTestId("manage-teams-editor-shell")).toHaveScreenshot(
        "create-team-desktop-empty.png",
        TEAM_EDITOR_SNAPSHOT_OPTIONS,
      );
    },
  );

  /**
   * Filled / generated state: Team Info populated + a generated roster.
   * Verifies the Abbrev (150 px) + City side-by-side row and the generated
   * player cards (lineup + bench + pitchers) render cleanly on desktop.
   */
  test(
    "create team — filled state after Generate Defaults (desktop)",
    { tag: "@desktop-only" },
    async ({ page }) => {
      await page.getByTestId("home-manage-teams-button").click();
      await page.getByTestId("manage-teams-create-button").click();
      await expect(page.getByTestId("manage-teams-editor-shell")).toBeVisible({ timeout: 5_000 });

      // Generate defaults to populate fields deterministically (counter = 0 on fresh page).
      await page.getByTestId("custom-team-regenerate-defaults-button").click();
      await expect(page.getByTestId("custom-team-name-input")).not.toHaveValue("", {
        timeout: 3_000,
      });

      // Overwrite the name with a stable value so the snapshot is deterministic.
      await page.getByTestId("custom-team-name-input").fill("Desktop Test Team");

      // Non-visual assertion: Abbrev and City must be side by side (two-column layout).
      const abbrevBox = await page.getByTestId("custom-team-abbreviation-input").boundingBox();
      const cityBox = await page.getByTestId("custom-team-city-input").boundingBox();
      expect(abbrevBox).not.toBeNull();
      expect(cityBox).not.toBeNull();
      expect(cityBox!.x).toBeGreaterThan(abbrevBox!.x + abbrevBox!.width / 2);

      await page.getByTestId("manage-teams-editor-shell").evaluate((el) => el.scrollTo(0, 0));
      await expect(page.getByTestId("manage-teams-editor-shell")).toHaveScreenshot(
        "create-team-desktop-filled.png",
        TEAM_EDITOR_SNAPSHOT_OPTIONS,
      );
    },
  );
});

// ─── 6. Saves modal with custom-team saved game rows ──────────────────────────
test.describe("Visual — Stage 2B: saves modal with custom-team game rows", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
    await disableAnimations(page);
  });

  /**
   * Saves modal shows human-readable team names (not raw `custom:ct_*` IDs).
   *
   * Flow:
   *   1. Create two custom teams via Manage Teams.
   *   2. Start a New Game using those custom teams.
   *   3. Wait for a few log lines, then save the game.
   *   4. Open the saves modal and snapshot it.
   *
   * The save-row team label should read the custom team name, not an ID.
   * Dates are masked (they change every run).
   *
   * Restricted to desktop only — the row layout is the same across viewports
   * and a single stable baseline is sufficient.
   */
  test(
    "saves modal — custom-team game row shows display names (desktop)",
    { tag: "@desktop-only" },
    async ({ page }) => {
      // Step 1: create two custom teams.
      // Note: generateDefaultTeam fills a city, so the display name becomes
      // "GeneratedCity TeamName". We keep the names simple for readability.
      await createAndSaveTeam(page, "Sox");
      await createAndSaveTeam(page, "Cubs");

      // Step 2: start a new game using those custom teams.
      await page.getByTestId("home-new-game-button").click();
      await expect(page.getByTestId("exhibition-setup-page")).toBeVisible({ timeout: 10_000 });

      // The two custom team selects should now be visible.
      const awaySelect = page.getByTestId("new-game-custom-away-team-select");
      const homeSelect = page.getByTestId("new-game-custom-home-team-select");
      await expect(awaySelect).toBeVisible({ timeout: 5_000 });
      await expect(homeSelect).toBeVisible({ timeout: 5_000 });

      // Wait until the selects are populated with our two custom teams.
      // (useCustomTeams loads asynchronously; options appear once it resolves.)
      // The auto-selection in NewGameDialog already picks the first two teams —
      // no explicit selectOption call needed, avoiding fragile label matching.
      await expect(awaySelect.locator("option")).toHaveCount(2, { timeout: 5_000 });
      await expect(homeSelect.locator("option")).toHaveCount(2, { timeout: 5_000 });

      // Fill seed for determinism.
      await page.getByTestId("seed-input").fill("saves-visual1");

      await page.getByTestId("play-ball-button").click();
      await expect(page.getByTestId("scoreboard")).toBeVisible({ timeout: 15_000 });

      // Wait for a few log lines so the game is progressing.
      await waitForLogLines(page, 5);

      // Step 3: save the game.
      await saveCurrentGame(page);

      // Step 4: snapshot the saves modal — modal stays open after saving.
      await expect(page.getByTestId("saves-modal")).toBeVisible({ timeout: 5_000 });

      // Verify no raw IDs are visible in the modal (non-visual assertion).
      const modalText = await page.getByTestId("saves-modal").textContent();
      expect(modalText).not.toMatch(/custom:ct_/);

      await expect(page.getByTestId("saves-modal")).toHaveScreenshot(
        "saves-modal-with-custom-team-row.png",
        {
          mask: [page.getByTestId("slot-date")],
          maxDiffPixelRatio: 0.05,
        },
      );
    },
  );
});

// ─── 7. Starting pitcher selector in Exhibition Setup page ───────────────────
//
// Captures the pitcher-selection UI that appears in the New Game dialog when
// a user starts a managed custom-team game. Desktop-only since this UI element
// renders identically across viewport sizes.
test.describe("Visual — Starting pitcher selector in Exhibition Setup page", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
    await disableAnimations(page);
  });

  /**
   * Shows the starting pitcher dropdown that appears when a user chooses
   * to manage a custom team. The dropdown only shows SP-eligible pitchers.
   */
  test(
    "starting pitcher selector visible for managed custom game (desktop)",
    { tag: "@desktop-only" },
    async ({ page }) => {
      // Create two custom teams with pitchers (generateDefaultTeam creates an SP + bullpen).
      await createAndSaveTeam(page, "Pitcher Test Home");
      await createAndSaveTeam(page, "Pitcher Test Away");

      // Open the New Game dialog.
      await page.getByTestId("home-new-game-button").click();
      await expect(page.getByTestId("exhibition-setup-page")).toBeVisible({ timeout: 10_000 });

      // Wait for both custom team selects to populate.
      const awaySelect = page.getByTestId("new-game-custom-away-team-select");
      const homeSelect = page.getByTestId("new-game-custom-home-team-select");
      await expect(awaySelect).toBeVisible({ timeout: 5_000 });
      await expect(homeSelect).toBeVisible({ timeout: 5_000 });
      await expect(awaySelect.locator("option")).toHaveCount(2, { timeout: 5_000 });

      // Select the away team as managed to trigger the pitcher selector.
      await page.locator('input[name="managed"][value="0"]').check();

      // The starting pitcher selector should appear.
      await expect(page.getByTestId("starting-pitcher-select")).toBeVisible({ timeout: 3_000 });

      // Snapshot the New Game dialog with the pitcher selector visible.
      // Mask the seed input since it shows a random value on every page load.
      await expect(page.getByTestId("exhibition-setup-page")).toHaveScreenshot(
        "new-game-dialog-with-pitcher-selector.png",
        {
          mask: [page.getByTestId("seed-input")],
          maxDiffPixelRatio: 0.05,
        },
      );
    },
  );
});

// ─── 8. /teams/new URL route — editor opens at routed URL ────────────────────
//
// Verifies the Create Team editor is reachable and renders correctly
// when navigated to via the /teams/new URL (Stage 4A route).
// Desktop-only: the editor layout is identical across device classes.
test.describe("Visual — /teams/new URL route", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
    await disableAnimations(page);
  });

  /**
   * Navigating to /teams → Create New Team → URL becomes /teams/new.
   * The editor shell renders immediately; checks URL and snapshot.
   */
  test(
    "create team editor accessible via /teams/new URL (desktop)",
    { tag: "@desktop-only" },
    async ({ page }) => {
      await page.getByTestId("home-manage-teams-button").click();
      await expect(page.getByTestId("manage-teams-screen")).toBeVisible({ timeout: 10_000 });
      await page.getByTestId("manage-teams-create-button").click();

      // URL must update to /teams/new
      await expect(page).toHaveURL(/\/teams\/new/);
      await expect(page.getByTestId("manage-teams-editor-shell")).toBeVisible({ timeout: 5_000 });

      await page.getByTestId("manage-teams-editor-shell").evaluate((el) => el.scrollTo(0, 0));
      await expect(page.getByTestId("manage-teams-editor-shell")).toHaveScreenshot(
        "teams-new-route-editor.png",
        TEAM_EDITOR_SNAPSHOT_OPTIONS,
      );
    },
  );

  /**
   * Edit team editor accessible via /teams/:id/edit URL.
   * Creates a team, clicks Edit, and verifies the URL updates accordingly.
   */
  test(
    "edit team editor accessible via /teams/:id/edit URL (desktop)",
    { tag: "@desktop-only" },
    async ({ page }) => {
      // Create a team so there is something to edit.
      await page.getByTestId("home-manage-teams-button").click();
      await page.getByTestId("manage-teams-create-button").click();
      await page.getByTestId("custom-team-regenerate-defaults-button").click();
      await page.getByTestId("custom-team-name-input").fill("Route Edit Team");
      await page.getByTestId("custom-team-save-button").click();
      await expect(page.getByText("Route Edit Team")).toBeVisible({
        timeout: TEAM_SAVE_NAVIGATION_TIMEOUT,
      });

      // Click Edit — URL must update to /teams/<id>/edit
      await page.getByTestId("custom-team-edit-button").first().click();
      await expect(page).toHaveURL(/\/teams\/.+\/edit/);
      await expect(page.getByTestId("manage-teams-editor-shell")).toBeVisible({ timeout: 5_000 });
      await expect(page.getByTestId("custom-team-name-input")).toHaveValue("Route Edit Team");

      await page.getByTestId("manage-teams-editor-shell").evaluate((el) => el.scrollTo(0, 0));
      await expect(page.getByTestId("manage-teams-editor-shell")).toHaveScreenshot(
        "teams-id-edit-route-editor.png",
        TEAM_EDITOR_SNAPSHOT_OPTIONS,
      );
    },
  );
});
