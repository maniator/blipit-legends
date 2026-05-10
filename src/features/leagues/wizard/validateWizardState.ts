import type { WizardState } from "./wizardReducer";

/** Mini preset: 8 teams total. */
const MINI_TEAM_COUNT = 8;

/**
 * Validates the current wizard state and returns an array of error strings.
 * An empty array means the state is valid.
 */
export function validateWizardState(state: WizardState): string[] {
  const errors: string[] = [];

  // Step 1: preset and seasonLength are locked in v1 — always valid.

  // Step 2: team selection constraints.
  if (state.step >= 2) {
    if (state.teamMode === "handpick") {
      if (state.selectedTeamIds.length !== MINI_TEAM_COUNT) {
        errors.push(
          `Handpick mode requires exactly ${MINI_TEAM_COUNT} teams (${state.selectedTeamIds.length} selected).`,
        );
      }
    } else if (state.teamMode === "mixed") {
      if (
        state.selectedTeamIds.length === 0 ||
        state.selectedTeamIds.length > MINI_TEAM_COUNT - 1
      ) {
        errors.push(
          `Mixed mode requires 1–${MINI_TEAM_COUNT - 1} handpicked teams (${state.selectedTeamIds.length} selected).`,
        );
      }
    }
    // allAutogen: always valid
  }

  // Step 3: DH defaults exist — always valid.

  // Step 5: masterSeed must be non-empty.
  if (state.step >= 5) {
    if (!state.masterSeed || state.masterSeed.trim() === "") {
      errors.push("Master seed must not be empty.");
    }
  }

  // Step 6: for handpick/mixed, user must select which team they manage.
  if (state.step >= 6) {
    if (state.teamMode !== "allAutogen" && state.userCustomTeamId === null) {
      errors.push("Please select which team you will manage.");
    }
  }

  return errors;
}

/**
 * Validates all steps up to and including the given step.
 * Used by Step 6 to confirm all prior steps are valid before creating the season.
 */
export function validateAllSteps(state: WizardState): string[] {
  const errors: string[] = [];

  // Step 2
  if (state.teamMode === "handpick") {
    if (state.selectedTeamIds.length !== MINI_TEAM_COUNT) {
      errors.push(
        `Handpick mode requires exactly ${MINI_TEAM_COUNT} teams (${state.selectedTeamIds.length} selected).`,
      );
    }
  } else if (state.teamMode === "mixed") {
    if (state.selectedTeamIds.length === 0 || state.selectedTeamIds.length > MINI_TEAM_COUNT - 1) {
      errors.push(
        `Mixed mode requires 1–${MINI_TEAM_COUNT - 1} handpicked teams (${state.selectedTeamIds.length} selected).`,
      );
    }
  }

  // Step 5
  if (!state.masterSeed || state.masterSeed.trim() === "") {
    errors.push("Master seed must not be empty.");
  }

  // Step 6: for handpick/mixed, user must select which team they manage.
  if (state.teamMode !== "allAutogen" && state.userCustomTeamId === null) {
    errors.push("Please select which team you will manage.");
  }

  return errors;
}
