export type Strategy = "balanced" | "aggressive" | "patient" | "contact" | "power";

export type Handedness = "R" | "L" | "S";

export type ModPreset = -20 | -10 | -5 | 0 | 5 | 10 | 20;

export type PlayerCustomization = {
  nickname?: string;
  /** Defensive position string (e.g. "C", "LF") — populated for custom-team players. */
  position?: string;
  /** Batter/pitcher throwing side. "S" is allowed for switch hitters. */
  handedness?: Handedness;
  contactMod?: ModPreset;
  powerMod?: ModPreset;
  speedMod?: ModPreset;
  controlMod?: ModPreset;
  velocityMod?: ModPreset;
  movementMod?: ModPreset;
  /** Shared stamina modifier (from batting stamina for non-pitchers; pitching stamina when present). */
  staminaMod?: ModPreset;
};

export type TeamCustomPlayerOverrides = Record<string, PlayerCustomization>;

/** Pre-computed player mods with all fields defaulted to 0. Computed once at setTeams. */
export type ResolvedPlayerMods = {
  contactMod: number;
  powerMod: number;
  speedMod: number;
  velocityMod: number;
  controlMod: number;
  movementMod: number;
  /** Higher staminaMod delays fatigue onset for batters and pitchers. */
  staminaMod: number;
};

/** Bench player info surfaced in the pinch_hitter decision for concrete player selection. */
export type PinchHitterCandidate = {
  id: string;
  name: string;
  position?: string;
  handedness?: Handedness;
  /** Resolved contact mod from playerOverrides — used by AI for stat-based selection. */
  contactMod: number;
  /** Resolved power mod from playerOverrides — used by AI for stat-based selection. */
  powerMod: number;
  /** Batter-edge percent for this candidate vs active pitcher (positive = hitter edge). */
  matchupDeltaPct?: number;
  /** Completed plate appearances this game for the candidate. */
  plateAppearances?: number;
  /** Batter fatigue penalties used in decision scoring/display. */
  fatigueContactPenalty?: number;
  fatiguePowerPenalty?: number;
  /** Fatigue-adjusted offensive mods used for manager decisions. */
  effectiveContactMod?: number;
  effectivePowerMod?: number;
};

/**
 * Shared scoring weights for pinch-hitter candidate ranking.
 * Used by both the candidate-sort in the reducer and AI selection in aiManager
 * to ensure the order presented to the manager matches what the AI would choose.
 */
export const PINCH_HITTER_CONTACT_WEIGHT = 1.2;
export const PINCH_HITTER_POWER_WEIGHT = 0.35;
