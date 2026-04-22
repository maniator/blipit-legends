/**
 * Ruleset version registry for League Mode.
 *
 * Bump CURRENT_RULESET_VERSION whenever the core rules (pitcher fatigue curves,
 * eligibility thresholds, sim parameters) change in a way that would affect
 * season outcomes. Old seasons continue using the ruleset version they were
 * created with; new seasons start at CURRENT_RULESET_VERSION.
 */

/** The ruleset version that will be used for all newly created seasons. */
export const CURRENT_RULESET_VERSION = 1;
