import { LAKEWOOD_LEGENDS } from "./demoTeamLakewood";
import { RIVERSIDE_ROCKETS } from "./demoTeamRiverside";
import type { DemoTeamDef } from "./demoTeamTypes";

export type { DemoPlayerDef, DemoTeamDef } from "./demoTeamTypes";

/**
 * Starter teams seeded into the DB when a brand-new user launches the app
 * with an empty custom-teams collection.
 *
 * Stat constraints:
 *   Hitters  — contact, power, speed each in [40, 70], sum ≤ 150 (HITTER_STAT_CAP)
 *   Pitchers — velocity, control, movement each in [40, 70], sum ≤ 160 (PITCHER_STAT_CAP)
 *
 * Each team's full roster is defined in its own module to keep file sizes
 * manageable:
 *   - Riverside Rockets → {@link ./demoTeamRiverside}
 *   - Lakewood Legends  → {@link ./demoTeamLakewood}
 */
export const DEMO_TEAMS: DemoTeamDef[] = [RIVERSIDE_ROCKETS, LAKEWOOD_LEGENDS];
