/**
 * Derives a deterministic per-game seed from a season ID and season-game ID.
 *
 * Contract (binding — do not change without bumping _bmad-output/planning-artifacts/league-mode-distillate/02-data-model-routing-schedule.md):
 *   1. input  = `${seasonId}:${seasonGameId}`
 *   2. hash   = fnv1a(input)          // 8-char hex string
 *   3. uint32 = parseInt(hash, 16) >>> 0
 *   4. return uint32.toString(36)     // base-36 lowercase
 *
 * The result is stored on `seasonGames.derivedSeed` at schedule-generation time.
 * All sim code reads the cached value — never recomputes — so the seed is stable
 * even if this implementation changes in a later phase.
 *
 * NEVER pass the raw `${seasonId}:${seasonGameId}` string into `reinitSeed`.
 * The colon separator is not base-36-safe and would silently break mulberry32
 * determinism.
 */
import { fnv1a } from "@storage/hash";

export function deriveScheduledGameSeed(seasonId: string, seasonGameId: string): string {
  const input = `${seasonId}:${seasonGameId}`;
  const hash = fnv1a(input);
  const uint32 = parseInt(hash, 16) >>> 0;
  return uint32.toString(36);
}
