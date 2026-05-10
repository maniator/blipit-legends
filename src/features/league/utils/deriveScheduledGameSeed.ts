/**
 * Derives a deterministic per-game seed from deterministic schedule coordinates.
 *
 * Contract (binding — do not change without bumping _bmad-output/planning-artifacts/league-mode-distillate/02-data-model-routing-schedule.md):
 *   1. input  = `${seasonId}:r${seasonRoundIdx}:g${gameInSeriesIdx}:${homeSeasonTeamId}:${awaySeasonTeamId}`
 *   2. hash   = fnv1a(input)          // 8-char hex string
 *   3. uint32 = parseInt(hash, 16) >>> 0
 *   4. return uint32.toString(36)     // base-36 lowercase
 *
 * The result is stored on `seasonGames.derivedSeed` at schedule-generation time.
 * All sim code reads the cached value — never recomputes — so the seed is stable
 * even if this implementation changes in a later phase.
 *
 * NEVER pass the raw coordinate string into `reinitSeed`.
 * The colon separator is not base-36-safe and would silently break mulberry32
 * determinism.
 */
import { fnv1a } from "@storage/hash";

interface DeriveScheduledGameSeedInput {
  seasonId: string;
  seasonRoundIdx: number;
  gameInSeriesIdx: number;
  homeSeasonTeamId: string;
  awaySeasonTeamId: string;
}

export function deriveScheduledGameSeed(input: DeriveScheduledGameSeedInput): string {
  const seedInput =
    `${input.seasonId}:r${input.seasonRoundIdx}:g${input.gameInSeriesIdx}:` +
    `${input.homeSeasonTeamId}:${input.awaySeasonTeamId}`;
  const hash = fnv1a(seedInput);
  const uint32 = parseInt(hash, 16) >>> 0;
  return uint32.toString(36);
}
