import type { PlayerCustomization, ResolvedPlayerMods } from "./playerTypes";

/**
 * ## Stat Wiring Inventory
 *
 * All stats listed here are editable in the CustomTeamEditor UI and persisted in the
 * `customTeams` RxDB collection (`TeamPlayer.batting` / `TeamPlayer.pitching`).
 * They are mapped into `playerOverrides` via `customTeamToPlayerOverrides` and cached
 * at game-start in `state.resolvedMods` (see `resolvePlayerMods` / `buildResolvedMods`).
 *
 * ### Batter stats
 * | Stat       | Stored | resolvedMods | Used in sim                                   |
 * |------------|--------|--------------|-----------------------------------------------|
 * | contact    | ✓      | contactMod   | hitBall: pop-out threshold (+/- hit chance)   |
 * | power      | ✓      | powerMod     | hitBall: HR bonus probability                 |
 * | speed      | ✓      | speedMod     | reducer: steal success % (via baseRunnerIds)  |
 * | stamina    | ✓      | staminaMod   | batter fatigue: contact/power penalties over PA |
 *
 * ### Pitcher stats
 * | Stat       | Stored | resolvedMods  | Used in sim                                   |
 * |------------|--------|---------------|-----------------------------------------------|
 * | velocity   | ✓      | velocityMod   | hitBall: pop-out threshold; playerWait: strike ↑ |
 * | control    | ✓      | controlMod    | playerWait: strike probability ↑              |
 * | movement   | ✓      | movementMod   | hitBall: pop-out threshold (hit difficulty ↑) |
 * | stamina    | ✓      | staminaMod    | pitcher fatigue: effectiveness decays with workload |
 *
 * ### Intentionally deferred stats (stored-only, not yet wired into sim)
 * - `handedness` (batter/pitcher): stored in TeamPlayer, not yet used to affect pitch outcomes.
 *   Planned for a future update when batter-vs-pitcher matchup splits are added.
 * - `pitchingRole` ("SP" | "RP" | "SP/RP"): stored in TeamWithRoster, drives AI substitution logic only;
 *   does not yet affect pitch-by-pitch simulation.
 * - Batter stamina currently feeds only in-game fatigue effects and is intentionally
 *   excluded from lineup/roster stat-cap enforcement in v1 to avoid broad rebalance.
 *
 * ### Invariant: resolvedMods is a derived cache
 * `resolvedMods` is computed from `playerOverrides` exactly once at `setTeams` time
 * and is recomputed from `playerOverrides` during `backfillRestoredState` for old saves.
 * It must never be mutated independently of `playerOverrides`.
 * If player overrides ever become mutable mid-game (e.g. stat upgrades), `resolvedMods`
 * must be recomputed alongside any `playerOverrides` update.
 */

export const ZERO_MODS: ResolvedPlayerMods = {
  contactMod: 0,
  powerMod: 0,
  speedMod: 0,
  velocityMod: 0,
  controlMod: 0,
  movementMod: 0,
  staminaMod: 0,
};

/**
 * Resolves a PlayerCustomization into a ResolvedPlayerMods with all fields defaulted to 0.
 * Used to pre-compute mods at setTeams time so simulation never needs ?? 0 lookups.
 */
export const resolvePlayerMods = (ov: PlayerCustomization | undefined): ResolvedPlayerMods => {
  if (!ov) return ZERO_MODS;
  return {
    contactMod: ov.contactMod ?? 0,
    powerMod: ov.powerMod ?? 0,
    speedMod: ov.speedMod ?? 0,
    velocityMod: ov.velocityMod ?? 0,
    controlMod: ov.controlMod ?? 0,
    movementMod: ov.movementMod ?? 0,
    staminaMod: ov.staminaMod ?? 0,
  };
};

/**
 * Builds the resolvedMods map for one team from its playerOverrides.
 */
export const buildResolvedMods = (
  overrides: Record<string, PlayerCustomization>,
): Record<string, ResolvedPlayerMods> => {
  const resolved: Record<string, ResolvedPlayerMods> = {};
  for (const [id, ov] of Object.entries(overrides)) {
    resolved[id] = resolvePlayerMods(ov);
  }
  return resolved;
};
