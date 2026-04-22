/**
 * Sanctioned-write capability for custom teams enrolled in active seasons.
 *
 * The `SANCTIONED_WRITE_CTX` Symbol acts as a proof-of-intent token. Only
 * modules that explicitly import from THIS file can pass the context to
 * `customTeamStore.updateCustomTeam()` to bypass the roster-edit lock.
 *
 * **IMPORTANT**: Do NOT re-export `SANCTIONED_WRITE_CTX` from any barrel
 * index file. Callers must import directly from this path:
 *   `import { SANCTIONED_WRITE_CTX } from "@feat/league/storage/sanctionedWrite"`
 *
 * This design makes it easy to audit all write-lock bypass sites via a simple
 * `grep` for the import path.
 */

/** Unique capability token — only importers of this file can hold it. */
export const SANCTIONED_WRITE_CTX = Symbol("sanctionedWrite");
export type SanctionedWriteContext = typeof SANCTIONED_WRITE_CTX;

/**
 * Executes `fn` inside a sanctioned-write context.
 * Use this wrapper when a league system operation must update a custom team
 * that is currently enrolled in an active season (e.g. autogen team mutations,
 * end-of-season archival).
 *
 * @param context  Must be `SANCTIONED_WRITE_CTX` — enforced at the type level.
 * @param fn       Async function containing the sanctioned write(s).
 * @returns        The result of `fn`.
 */
export async function withSanctionedCustomTeamWrite<T>(
  context: SanctionedWriteContext,
  fn: () => Promise<T>,
): Promise<T> {
  // context is checked at compile time via the SanctionedWriteContext type;
  // the runtime check here ensures the symbol identity matches even across
  // module instances (e.g., in tests that re-import the module).
  if (context !== SANCTIONED_WRITE_CTX) {
    throw new TypeError("Invalid sanctioned write context");
  }
  return fn();
}
