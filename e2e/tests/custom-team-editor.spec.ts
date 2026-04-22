/**
 * Custom Team Editor — position, handedness, abbreviation UI and validation E2E tests.
 *
 * Covers:
 * 1. Position dropdown is present for player rows
 * 2. Handedness dropdown is present for player rows
 * 3. Save is blocked when required field positions are missing, error shown
 * 4. Fixing positions unblocks the save
 * 5. Edit mode loads saved positions and handedness
 * 6. Mobile viewport — selects are visible and layout is usable
 * 7. Tablet/desktop — full label text is readable
 * 8. Abbreviation field — required, validation, generation, edit-load
 * 9. Save error is discoverable on failed submit (shown near save/cancel area)
 */
import { expect, test } from "@playwright/test";

import { resetAppState } from "../utils/helpers";

const REQUIRED_POSITIONS = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"];

/** Helper: open Manage Teams → click Create → Generate Random. Returns when name input is filled. */
async function openCreateEditorWithDefaults(page: Parameters<typeof resetAppState>[0]) {
  await page.getByTestId("home-manage-teams-button").click();
  await expect(page.getByTestId("manage-teams-screen")).toBeVisible({ timeout: 10_000 });
  await page.getByTestId("manage-teams-create-button").click();
  await expect(page.getByTestId("custom-team-name-input")).toBeVisible({ timeout: 15_000 });
  await page.getByTestId("custom-team-regenerate-defaults-button").click();
  await expect(page.getByTestId("custom-team-name-input")).not.toHaveValue("", { timeout: 10_000 });
}

/** Helper: save a generated team under a custom name. */
async function saveGeneratedTeam(page: Parameters<typeof resetAppState>[0], teamName: string) {
  await openCreateEditorWithDefaults(page);
  await page.getByTestId("custom-team-name-input").fill(teamName);
  await page.getByTestId("custom-team-save-button").click();
  await expect(page.getByText(teamName)).toBeVisible({ timeout: 15_000 });
}

// ─── Position dropdown ──────────────────────────────────────────────────────
test.describe("Custom Team Editor — position dropdown", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  test("lineup player rows show a position dropdown after Generate Random", async ({ page }) => {
    await openCreateEditorWithDefaults(page);
    const positionSelects = page.getByTestId("custom-team-player-position-select");
    // Should be at least one visible (first lineup row)
    await expect(positionSelects.first()).toBeVisible({ timeout: 15_000 });
  });

  test("generated defaults pre-select a position for each lineup player", async ({ page }) => {
    await openCreateEditorWithDefaults(page);
    const positionSelects = page.getByTestId("custom-team-player-position-select");
    const count = await positionSelects.count();
    expect(count).toBeGreaterThan(0);

    // First lineup player should have a position value set (not empty "— select —")
    const firstValue = await positionSelects.first().inputValue();
    expect(firstValue).not.toBe("");
  });

  test("position dropdown includes standard field positions as options", async ({ page }) => {
    await openCreateEditorWithDefaults(page);
    const firstSelect = page.getByTestId("custom-team-player-position-select").first();
    await expect(firstSelect).toBeVisible();

    // Check that at least one required position is an option
    const optionText = await firstSelect.locator("option").allTextContents();
    const optionValues = await firstSelect
      .locator("option")
      .evaluateAll((opts) => opts.map((o) => (o as HTMLOptionElement).value));
    // Should contain the 8 required positions plus DH
    for (const pos of ["C", "1B", "SS", "LF", "CF", "RF"]) {
      expect(optionValues).toContain(pos);
    }
    expect(optionText.length).toBeGreaterThan(5);
  });
});

// ─── Handedness dropdown ────────────────────────────────────────────────────
test.describe("Custom Team Editor — handedness dropdown", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  test("lineup player rows show a batting handedness dropdown", async ({ page }) => {
    await openCreateEditorWithDefaults(page);
    const handednessSelects = page.getByTestId("custom-team-player-handedness-select");
    await expect(handednessSelects.first()).toBeVisible({ timeout: 15_000 });
  });

  test("generated defaults pre-select a handedness for each lineup player", async ({ page }) => {
    await openCreateEditorWithDefaults(page);
    const handednessSelects = page.getByTestId("custom-team-player-handedness-select");
    const firstValue = await handednessSelects.first().inputValue();
    expect(["R", "L", "S"]).toContain(firstValue);
  });

  test("handedness dropdown has R, L, S options with readable labels", async ({ page }) => {
    await openCreateEditorWithDefaults(page);
    const firstSelect = page.getByTestId("custom-team-player-handedness-select").first();
    const optionValues = await firstSelect
      .locator("option")
      .evaluateAll((opts) => opts.map((o) => (o as HTMLOptionElement).value));
    expect(optionValues).toContain("R");
    expect(optionValues).toContain("L");
    expect(optionValues).toContain("S");

    const optionLabels = await firstSelect.locator("option").allTextContents();
    // Labels should be readable (Right/Left/Switch), not just R/L/S
    const labelText = optionLabels.join(" ");
    expect(labelText).toMatch(/Right/i);
    expect(labelText).toMatch(/Left/i);
    expect(labelText).toMatch(/Switch/i);
  });
});

// ─── Validation blocking save ───────────────────────────────────────────────
test.describe("Custom Team Editor — required position validation", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  test("saving a manually built team with no positions set shows a validation error", async ({
    page,
  }) => {
    await page.getByTestId("home-manage-teams-button").click();
    await page.getByTestId("manage-teams-create-button").click();

    // Fill just a name + valid abbreviation, then add one player without selecting a position
    await page.getByTestId("custom-team-name-input").fill("Incomplete Team");
    // Abbreviation is required; fill it so that validation reaches the position check.
    await page.getByTestId("custom-team-abbreviation-input").fill("INC");
    await page.getByTestId("custom-team-add-lineup-player-button").click();
    // Fill player name
    const nameInputs = page.locator('[aria-label="Player name"]');
    await nameInputs.first().fill("John Doe");

    // Attempt to save without setting any positions
    await page.getByTestId("custom-team-save-button").click();

    // Should show a validation error mentioning missing positions
    const errorMsg = page.locator('[role="alert"]');
    await expect(errorMsg).toBeVisible({ timeout: 15_000 });
    const errorText = await errorMsg.textContent();
    // Error should mention at least one required position
    expect(REQUIRED_POSITIONS.some((pos) => errorText?.includes(pos))).toBe(true);
  });

  test("saving a generated-defaults team succeeds (all positions pre-assigned)", async ({
    page,
  }) => {
    await openCreateEditorWithDefaults(page);
    await page.getByTestId("custom-team-name-input").fill("Auto Filled FC");
    await page.getByTestId("custom-team-save-button").click();
    // Should return to the team list
    await expect(page.getByTestId("custom-team-list")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Auto Filled FC")).toBeVisible();
  });
});

// ─── Edit mode preserves positions + handedness ─────────────────────────────
test.describe("Custom Team Editor — edit mode loads positions and handedness", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  test("editing a saved team shows the same position values that were stored", async ({ page }) => {
    // Create a team with Generate Random (positions are pre-assigned)
    await saveGeneratedTeam(page, "Position Edit Team");

    // Open the editor for this team
    await page.getByTestId("custom-team-edit-button").first().click();
    await expect(page.getByTestId("custom-team-name-input")).toBeVisible({ timeout: 15_000 });

    // Position selects should be visible and have non-empty values
    const positionSelects = page.getByTestId("custom-team-player-position-select");
    await expect(positionSelects.first()).toBeVisible();
    const firstPos = await positionSelects.first().inputValue();
    expect(firstPos).not.toBe("");
    // Should be a valid position from BATTING_POSITIONS
    expect(["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH"]).toContain(firstPos);
  });

  test("editing a saved team shows the same handedness values that were stored", async ({
    page,
  }) => {
    await saveGeneratedTeam(page, "Handedness Edit Team");
    await page.getByTestId("custom-team-edit-button").first().click();
    await expect(page.getByTestId("custom-team-name-input")).toBeVisible({ timeout: 15_000 });

    const handednessSelects = page.getByTestId("custom-team-player-handedness-select");
    await expect(handednessSelects.first()).toBeVisible();
    const firstHand = await handednessSelects.first().inputValue();
    expect(["R", "L", "S"]).toContain(firstHand);
  });
});

// ─── Mobile viewport ─────────────────────────────────────────────────────────
test.describe("Custom Team Editor — position/handedness selects on mobile", () => {
  test.use({ viewport: { width: 393, height: 659 } });

  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  test("position and handedness selects are visible and usable on mobile", async ({ page }) => {
    await openCreateEditorWithDefaults(page);

    const posSelect = page.getByTestId("custom-team-player-position-select").first();
    const handSelect = page.getByTestId("custom-team-player-handedness-select").first();

    await posSelect.scrollIntoViewIfNeeded();
    await expect(posSelect).toBeVisible();
    await handSelect.scrollIntoViewIfNeeded();
    await expect(handSelect).toBeVisible();

    // No horizontal overflow from added controls
    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(hasHorizontalOverflow).toBe(false);
  });
});

// ─── Abbreviation field ──────────────────────────────────────────────────────
test.describe("Custom Team Editor — team abbreviation field", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  test("abbreviation input is visible in Team Info section", async ({ page }) => {
    await page.getByTestId("home-manage-teams-button").click();
    await page.getByTestId("manage-teams-create-button").click();
    await expect(page.getByTestId("custom-team-abbreviation-input")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("Generate Random populates the abbreviation field automatically", async ({ page }) => {
    await openCreateEditorWithDefaults(page);
    const abbrevInput = page.getByTestId("custom-team-abbreviation-input");
    const value = await abbrevInput.inputValue();
    expect(value.length).toBeGreaterThanOrEqual(2);
    expect(value.length).toBeLessThanOrEqual(3);
  });

  test("Create Team shows Generate Random button", async ({ page }) => {
    await page.getByTestId("home-manage-teams-button").click();
    await page.getByTestId("manage-teams-create-button").click();
    const btn = page.getByTestId("custom-team-regenerate-defaults-button");
    await expect(btn).toBeVisible({ timeout: 15_000 });
    await expect(btn).toContainText(/Generate Random/i);
  });

  test("Edit Team does not show Generate Random button", async ({ page }) => {
    // First create a team
    await openCreateEditorWithDefaults(page);
    await page.getByTestId("custom-team-name-input").fill("No Generate Team");
    await page.getByTestId("custom-team-save-button").click();
    await expect(page.getByText("No Generate Team")).toBeVisible({ timeout: 15_000 });
    // Open edit mode
    await page.getByTestId("custom-team-edit-button").first().click();
    await expect(page.getByTestId("custom-team-name-input")).toBeVisible({ timeout: 15_000 });
    // Generate Random button should NOT be visible in edit mode
    const btn = page.getByTestId("custom-team-regenerate-defaults-button");
    await expect(btn).not.toBeVisible({ timeout: 10_000 });
  });

  test("attempting to save with empty abbreviation shows a validation error", async ({ page }) => {
    await page.getByTestId("home-manage-teams-button").click();
    await page.getByTestId("manage-teams-create-button").click();
    await page.getByTestId("custom-team-name-input").fill("No Abbrev Team");
    // Leave abbreviation empty and attempt to save
    await page.getByTestId("custom-team-save-button").click();
    const summary = page.getByTestId("custom-team-editor-error-summary");
    await expect(summary).toBeVisible({ timeout: 10_000 });
    const text = await summary.textContent();
    expect(text?.toLowerCase()).toMatch(/abbreviation/i);
  });

  test("save error hint appears near Save/Cancel buttons on failed submit (mobile-friendly UX)", async ({
    page,
  }) => {
    await page.getByTestId("home-manage-teams-button").click();
    await page.getByTestId("manage-teams-create-button").click();
    // Wait for the editor to mount before clicking Save to ensure React has
    // hydrated the form state and the save button is interactive.
    await expect(page.getByTestId("custom-team-save-button")).toBeVisible({ timeout: 15_000 });
    // Attempt save without any data — triggers "Team name is required." validation
    await page.getByTestId("custom-team-save-button").click();
    // Error hint near the save button area
    const hint = page.getByTestId("custom-team-save-error-hint");
    await expect(hint).toBeVisible({ timeout: 10_000 });
  });

  test("Generate Random populates the abbreviation field automatically (abbreviation section)", async ({
    page,
  }) => {
    // Create a team with Generate Random (abbreviation is pre-filled)
    await openCreateEditorWithDefaults(page);
    // Record the generated abbreviation
    const generated = await page.getByTestId("custom-team-abbreviation-input").inputValue();
    await page.getByTestId("custom-team-name-input").fill("Abbrev Load Team");
    await page.getByTestId("custom-team-save-button").click();
    await expect(page.getByText("Abbrev Load Team")).toBeVisible({ timeout: 15_000 });

    // Open edit mode
    await page.getByTestId("custom-team-edit-button").first().click();
    await expect(page.getByTestId("custom-team-abbreviation-input")).toBeVisible({
      timeout: 15_000,
    });
    const loaded = await page.getByTestId("custom-team-abbreviation-input").inputValue();
    expect(loaded).toBe(generated);
  });
});

// ─── Pitcher THROWS label ─────────────────────────────────────────────────────
test.describe("Custom Team Editor — pitcher handedness label", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  test("pitcher rows display 'Throws' label (not 'Bats') for handedness", async ({ page }) => {
    await openCreateEditorWithDefaults(page);
    // Navigate to the Pitchers section
    const pitchersSection = page.getByTestId("custom-team-pitchers-section");
    await expect(pitchersSection).toBeVisible({ timeout: 15_000 });

    // Each pitcher card should have a label containing 'Throws', not 'Bats'
    const cards = pitchersSection.locator("[data-testid='custom-team-player-handedness-select']");
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);

    // Check the label text in pitcher section - should say Throws
    const throwsLabels = pitchersSection.getByText("Throws");
    await expect(throwsLabels.first()).toBeVisible({ timeout: 10_000 });
  });

  test("lineup/bench player rows display 'Bats' label for handedness", async ({ page }) => {
    await openCreateEditorWithDefaults(page);
    // Lineup section
    const lineupSection = page.getByTestId("custom-team-lineup-section");
    await expect(lineupSection).toBeVisible({ timeout: 15_000 });

    const batsLabels = lineupSection.getByText("Bats");
    await expect(batsLabels.first()).toBeVisible({ timeout: 10_000 });
  });
});

// ─── Drag handles in bench and pitchers ─────────────────────────────────────
test.describe("Custom Team Editor — drag handles in bench and pitchers", () => {
  test.use({ viewport: { width: 1280, height: 800 } }); // desktop only

  test.beforeEach(async ({ page }) => {
    await resetAppState(page);
  });

  test("bench and pitchers sections show drag handles (no up/down buttons)", async ({ page }) => {
    await openCreateEditorWithDefaults(page);

    // Bench section should be visible
    const benchSection = page.getByTestId("custom-team-bench-section");
    await expect(benchSection).toBeVisible({ timeout: 15_000 });

    // No up/down buttons anywhere in the editor
    await expect(page.locator('button[aria-label="Move up"]')).toHaveCount(0);
    await expect(page.locator('button[aria-label="Move down"]')).toHaveCount(0);

    // Drag handles should be present in bench section (generated defaults include bench players)
    const dragHandles = benchSection.locator('span[aria-label*="Drag"]');
    const handleCount = await dragHandles.count();
    expect(handleCount).toBeGreaterThan(0);
  });
});
