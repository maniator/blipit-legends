/**
 * @deprecated Import from `@storage/sanctionedWrite` instead.
 * This shim exists only for backward-compat during migration; it will be removed once all
 * tests and callers have been updated to import from the canonical `@storage/sanctionedWrite` path.
 *
 * TODO(League Mode v2 cleanup): remove after
 * `rg "@feat/league/storage/sanctionedWrite"` returns no callers outside this file.
 * New bypass call sites must import from `@storage/sanctionedWrite` for auditability.
 */
export {
  SANCTIONED_WRITE_CTX,
  type SanctionedWriteContext,
  withSanctionedCustomTeamWrite,
} from "@storage/sanctionedWrite";
