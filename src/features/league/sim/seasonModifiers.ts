/**
 * SeasonModifiers — typed modifier payload injected into the headless sim entry point.
 *
 * Shape is FROZEN in v1. v2/v3/v4 may only ADD fields — never rename or remove.
 * The injection contract is defined in docs/league-mode/schedule-and-sim.md.
 *
 * RC3 (Winston CR): pitcher.availability is a per-player map, not a scalar.
 * A single scalar cannot represent a bullpen where pitcher A is at 0.9 and B at 0.2.
 */
export interface SeasonModifiers {
  /**
   * Per-pitcher availability multipliers (0.0–1.0). v1 only.
   * Key: playerId (from the team roster).
   * Value: availability fraction; 1.0 = fully fresh, 0.0 = fully spent.
   * Applied as a multiplicative modifier on pitch-quality outcome distributions.
   * Maximum effect = 12% (per pitcherFatigueConstants.maxFatigueEffect).
   */
  pitcher?: {
    availabilityByPlayerId: Record<string, number>;
  };
  // hitter?: { wearPenalty: number };           // v2
  // injuryFilter?: (playerId: string) => boolean; // v2
}
