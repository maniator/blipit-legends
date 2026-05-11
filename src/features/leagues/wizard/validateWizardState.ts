import type { WizardState } from "./wizardReducer";

/** Mini preset: 8 teams total. */
const MINI_TEAM_COUNT = 8;

// ---------------------------------------------------------------------------
// Error message prefixes used by both the validator and the step-level filter.
// Keeping them as constants prevents silent mismatch if copy is ever changed.
// ---------------------------------------------------------------------------

/** Prefix used for all handpick-count validation messages. */
export const ERR_PREFIX_HANDPICK = "Handpick mode requires";
/** Prefix used for all mixed-mode range validation messages. */
export const ERR_PREFIX_MIXED = "Mixed mode requires";
/** Prefix used for seed-empty validation messages. */
export const ERR_PREFIX_SEED = "Master seed";
/** Full error string for the managed-team selection gate. */
export const ERR_MANAGED_TEAM = "Please select which team you will manage.";

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
          `${ERR_PREFIX_HANDPICK} exactly ${MINI_TEAM_COUNT} teams (${state.selectedTeamIds.length} selected).`,
        );
      }
    } else if (state.teamMode === "mixed") {
      if (
        state.selectedTeamIds.length === 0 ||
        state.selectedTeamIds.length > MINI_TEAM_COUNT - 1
      ) {
        errors.push(
          `${ERR_PREFIX_MIXED} 1–${MINI_TEAM_COUNT - 1} handpicked teams (${state.selectedTeamIds.length} selected).`,
        );
      }
    }
    // allAutogen: always valid
  }

  // Step 3: DH defaults exist — always valid.

  // Step 5: masterSeed must be non-empty.
  if (state.step >= 5) {
    if (!state.masterSeed || state.masterSeed.trim() === "") {
      errors.push(`${ERR_PREFIX_SEED} must not be empty.`);
    }
  }

  // Step 6: for handpick/mixed, user must select which team they manage.
  if (state.step >= 6) {
    if (state.teamMode !== "allAutogen" && state.userCustomTeamId === null) {
      errors.push(ERR_MANAGED_TEAM);
    }
  }

  return errors;
}

/**
 * Validates only the active wizard step.
 * Used to gate step-level progression with inline errors.
 * Filters by the shared error-prefix constants so changes to copy
 * only need to happen in one place.
 */
export function validateWizardStep(state: WizardState): string[] {
  return validateWizardState(state).filter((error) => {
    if (state.step === 2) {
      return error.startsWith(ERR_PREFIX_HANDPICK) || error.startsWith(ERR_PREFIX_MIXED);
    }
    if (state.step === 5) {
      return error.startsWith(ERR_PREFIX_SEED);
    }
    if (state.step === 6) {
      return error === ERR_MANAGED_TEAM;
    }
    return false;
  });
}

/**
 * Validates all steps up to and including the given step.
 * Used by Step 6 to confirm all prior steps are valid before creating the season.
 * Delegates to validateWizardState with step=6 so the rules stay in one place.
 */
export function validateAllSteps(state: WizardState): string[] {
  return validateWizardState({ ...state, step: 6 });
}
