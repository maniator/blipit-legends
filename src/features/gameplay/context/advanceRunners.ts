import { Hit } from "@shared/constants/hitTypes";

/**
 * Advance runners using explicit, correct baseball rules.
 * Returns a fresh baseLayout tuple, run count, and optional runner IDs.
 *
 * Rules:
 *   HR     – all runners score, batter scores (grand-slam logic included)
 *   Triple – all runners score, batter to 3rd
 *   Double – runners on 2nd/3rd score; runner on 1st to 3rd; batter to 2nd
 *   Single – runner on 3rd scores; runner on 2nd to 3rd; runner on 1st to 2nd; batter to 1st
 *   Walk   – force advancement only (batter to 1st, each runner advances only if forced)
 *
 * Grounder / double-play scenarios are handled in hitBall.ts (handleGrounder):
 * ground outs, double plays, and fielder's-choice plays are resolved there before
 * advanceRunners is called, so this function only needs to handle clean hit advancement.
 */
export const advanceRunners = (
  type: Hit,
  oldBase: [number, number, number],
  runnerIds?: [string | null, string | null, string | null],
): {
  newBase: [number, number, number];
  runsScored: number;
  newRunnerIds: [string | null, string | null, string | null];
} => {
  const newBase: [number, number, number] = [0, 0, 0];
  const ids = runnerIds ?? [null, null, null];
  const newRunnerIds: [string | null, string | null, string | null] = [null, null, null];
  let runsScored = 0;

  switch (type) {
    case Hit.Homerun:
      runsScored = oldBase.filter(Boolean).length + 1;
      // All runners score — IDs all drop (they scored)
      break;

    case Hit.Triple:
      runsScored = oldBase.filter(Boolean).length;
      // All runners score — IDs drop; batter will be placed on 3rd by caller
      newBase[2] = 1;
      break;

    case Hit.Double:
      if (oldBase[2]) runsScored++;
      if (oldBase[1]) runsScored++;
      if (oldBase[0]) {
        newBase[2] = 1;
        newRunnerIds[2] = ids[0]; // runner from 1st → 3rd
      }
      newBase[1] = 1;
      // batter goes to 2nd — placed by caller
      break;

    case Hit.Single:
      if (oldBase[2]) runsScored++;
      if (oldBase[1]) {
        newBase[2] = 1;
        newRunnerIds[2] = ids[1]; // runner from 2nd → 3rd
      }
      if (oldBase[0]) {
        newBase[1] = 1;
        newRunnerIds[1] = ids[0]; // runner from 1st → 2nd
      }
      newBase[0] = 1;
      // batter goes to 1st — placed by caller
      break;

    case Hit.HitByPitch:
    // falls through — force advancement is identical to a base-on-balls
    case Hit.Walk:
      if (oldBase[0]) {
        if (oldBase[1]) {
          if (oldBase[2]) {
            runsScored++;
            // 3rd runner scores — ID drops
            newRunnerIds[2] = ids[1]; // 2nd runner forced to 3rd
          } else {
            newRunnerIds[2] = ids[1]; // 2nd runner forced to 3rd
          }
          newRunnerIds[1] = ids[0]; // 1st runner forced to 2nd
          newBase[2] = 1;
          newBase[1] = 1;
        } else {
          newRunnerIds[1] = ids[0]; // 1st runner forced to 2nd
          newBase[1] = 1;
          if (oldBase[2]) {
            newBase[2] = 1;
            newRunnerIds[2] = ids[2]; // 3rd runner stays
          }
        }
        newBase[0] = 1;
        // batter to 1st — placed by caller
      } else {
        newBase[0] = 1;
        // no force advancement
        if (oldBase[1]) {
          newBase[1] = 1;
          newRunnerIds[1] = ids[1];
        }
        if (oldBase[2]) {
          newBase[2] = 1;
          newRunnerIds[2] = ids[2];
        }
      }
      break;

    default:
      throw new Error(`Not a possible hit type: ${type}`);
  }

  return { newBase, runsScored, newRunnerIds };
};
