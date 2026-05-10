/**
 * @deprecated Import from `@storage/sanctionedWrite` instead.
 * This shim exists only for backward-compat during migration; it will be removed once all
 * tests and callers have been updated to import from the canonical `@storage/sanctionedWrite` path.
 */
export {
  SANCTIONED_WRITE_CTX,
  type SanctionedWriteContext,
  withSanctionedCustomTeamWrite,
} from "@storage/sanctionedWrite";
