# D-01 Implementation Prompt — Autogen Team Deduplication

> Copy-paste this prompt verbatim into a new Copilot agent session.  
> All architectural constraints, amendments, and test requirements are embedded below.  
> Winston CR sign-off is required before the PR is created.

---

## Context

When the League Setup Wizard runs in `allAutogen` or `mixed` mode, it generates custom-team
docs and inserts them into RxDB's `customTeams` collection. If the user creates a **second
season** using the same autogen seed (or any seed that produces matching `baseSeed + theme +
parity + version` fingerprints), the wizard inserts new docs that collide with existing ones —
producing two teams with identical display names in the standings table. No crash or data loss
occurs, but the UX is broken.

The fix is a `resolveAutogenTeams` helper that deduplicates by fingerprint before inserting,
with a compound RxDB index to support fast lookups. This is a **RxDB schema version bump** —
mandatory migration strategy required. Winston CR is a hard gate before this PR merges.

---

## Canonical Spec References

- Primary spec (original deferral): `docs/league-v1-followup/08-deferred-to-v2.md` § D-01
- Six post-party-mode amendments are embedded in the sections below and in the spec file
- RxDB schema versioning rules: `docs/rxdb-persistence.md` § Schema versioning & migration

---

## Pre-Reading (read IN ORDER before writing any code)

1. `docs/rxdb-persistence.md` — **read the `### Schema versioning & migration` section fully.**
   Missing the migration strategy is a silent P0 breakage for all existing users (DB6 hash
   mismatch blocks app startup).
2. `src/features/customTeams/storage/customTeamStore.ts` — current schema version, properties,
   existing indexes, and the lock guard at lines 85–97.
3. `docs/repo-layout.md` — confirm alias paths before touching storage files.
4. `.github/copilot-instructions.md` — RxDB schema change checklist.

---

## Amendments (6 — party-mode roundtable, 2026-05-11)

### Amendment 1 — Lock guard interaction (Winston BLOCK)

The lock guard at `customTeamStore.ts:85-97` blocks edits to teams bound to an active season.
The dedup path in `handleCreate` must NOT silently bypass this guard.

Required behavior in `resolveAutogenTeams`:

- Before reusing a matched doc, check whether it is currently locked.
- If locked to a **different** active season (Season 1 still in progress) → fall through to a
  fresh insert. Two concurrently-running seasons may not share a team doc.
- If locked to **no** active season (Season 1 completed or abandoned) → reuse is safe.
- Document this rule explicitly in the `resolveAutogenTeams` function JSDoc.

### Amendment 2 — Add `autogen.version` to compound index (Winston)

The original spec proposed `["autogen.baseSeed", "autogen.theme", "autogen.parity"]`. This must
be extended to `["autogen.baseSeed", "autogen.theme", "autogen.parity", "autogen.version"]`.

Without `version`, a future algorithm revision would match old docs in the index scan and require
a post-filter — a performance trap and a footgun. Including `version` ensures each new algorithm
version naturally forces fresh inserts. Include this in the same single schema version bump that
covers the compound index addition.

### Amendment 3 — Cross-season stat attribution design decision (Winston + Amelia)

`gameHistory` records link to `customTeamId`. Reusing team docs across seasons means career-stats
pages aggregate records from both seasons automatically.

**Decision: this is intentional.** `customTeams` docs represent team identity, not season-scoped
snapshots. Multi-season stat aggregation via a shared `customTeamId` is the franchise model. This
is safe provided `gameHistory` records carry a `seasonId` field that season-scoped views filter by.

**Pre-implementation gate:** Before writing any code, audit `gameHistoryStore` query paths to
confirm every season-scoped stats view filters by `seasonId`. If a view is missing the filter,
fix it first (separate commit, no blocker to the rest of D-01).

Add a JSDoc comment to `resolveAutogenTeams` documenting this cross-season reuse intent.

### Amendment 4 — `resolveAutogenTeams` return type (Amelia)

```typescript
interface ResolveAutogenTeamsResult {
  /** Final ordered team-ID list — positional, matches input `generated` array order. */
  teamIds: string[];
  /** Count of net-new docs written to RxDB. */
  insertedCount: number;
  /** Count of existing docs reused (fingerprint match). */
  recycledCount: number;
  /** True when user selected allAutogen but a recycled team is a managed custom team,
   *  making the effective mode `mixed`. Drives the wizard review-step notification. */
  modeChanged: boolean;
}
```

`teamIds` order MUST be stable and match the input `generated` order — schedule generation relies
on positional assignment.

### Amendment 5 — Unit test cases (8 total — Amelia + John)

The original spec specified 3 test cases. Include all 8 below in
`resolveAutogenTeams.test.ts` (or equivalent):

```typescript
// Original 3
it("inserts all teams when none exist yet (all-new autogen)");
it("reuses existing IDs for partial fingerprint match — insertedCount === N−1");
it("sets modeChanged=true when a non-autogen team displaces a generated slot");

// Amendment 5 additions — second-season scenario
it("returns recycledCount === N and insertedCount === 0 when all N teams already exist");
// ^ Key regression gate for second-season same-seed reuse

it("teamIds order matches input `generated` order when all teams are recycled");
// ^ Protects schedule generation positional assignment

it("does not insert duplicate docs when called twice with same seed");
// ^ Integration-flavored: collection length unchanged after second call

it("recycledCount is 0 when a different seed produces non-matching fingerprints");
// ^ Sanity: different seed = zero reuse, no false positives

it("falls through to fresh insert when matched doc is locked to a different active season");
// ^ Covers Amendment 1 lock guard
```

### Amendment 6 — Mode-switch notification clarification (John)

The wizard review-step notification fires only when the **effective mode changes** from what the
user explicitly selected. Rules:

| Scenario                                                       | Notice                                                                                              |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| allAutogen — all teams brand-new                               | None                                                                                                |
| allAutogen — all/some teams recycled, no managed team involved | None (mode unchanged; recycling is transparent)                                                     |
| allAutogen — a recycled team is the user's managed custom team | "Your league will include one custom team alongside your generated teams."                          |
| allAutogen — ALL teams recycled from a prior season            | "Using your existing teams from a previous season." (informational, review step only, non-blocking) |

Add the "Using your existing teams from a previous season." string to the wizard copy constants in
`validateWizardState.ts`.

---

## Implementation Steps

1. **Audit `gameHistoryStore` query paths** — confirm all season-scoped views filter by `seasonId`
   (Amendment 3 pre-gate). Fix any missing filter in a separate commit before proceeding.

2. **Bump `customTeams` schema version** — add the compound index
   `["autogen.baseSeed", "autogen.theme", "autogen.parity", "autogen.version"]`, bump `version`
   by 1, add a trivial `(oldDoc) => oldDoc` migration strategy. Follow the procedure in
   `docs/rxdb-persistence.md § Schema versioning & migration` exactly.

3. **Implement `resolveAutogenTeams`** — extract to `src/features/leagues/wizard/utils/` or
   `src/features/leagues/autogen/`. Function signature:

   ```typescript
   async function resolveAutogenTeams(
     generated: GeneratedTeam[],
     allExisting: CustomTeam[],
   ): Promise<ResolveAutogenTeamsResult>;
   ```

   - Match by `baseSeed + theme + parity + version` fingerprint
   - Check lock status before reusing (Amendment 1)
   - Return typed `ResolveAutogenTeamsResult` (Amendment 4)
   - JSDoc: document cross-season reuse intent (Amendment 3) and lock guard rule (Amendment 1)

4. **Wire `resolveAutogenTeams` into `handleCreate`** — replace the bare insert loop with a call
   to the helper, then insert only the docs with fresh IDs.

5. **Add mode-switch notification** — wire `result.modeChanged` and the fully-recycled case to
   the wizard review step. Use the copy strings from Amendment 6. Non-blocking inline notice only
   (no modal). Route the visual treatment through Sally (`bmad-agent-ux-designer`) if a new UI
   pattern is needed.

6. **Write all 8 unit tests** for `resolveAutogenTeams` (Amendment 5). Tests must use a mock
   store — no real RxDB instance required.

7. **Write a migration upgrade-path test** — create a test that starts from schema version N−1 and
   confirms the migration to N succeeds without errors and all existing docs survive intact. See
   `docs/rxdb-persistence.md` for the test pattern.

8. **Validation before creating the PR:**

   ```bash
   yarn lint
   yarn format:check
   yarn typecheck
   yarn test src/features/leagues/wizard/
   yarn test src/features/leagues/autogen/   # if resolveAutogenTeams moved here
   yarn build
   ```

   Run `yarn test` for the full unit suite and confirm coverage thresholds pass.

---

## Acceptance Criteria

- Wizard creates a season with N autogenned teams and no duplicate team names in standings.
- Wizard creates a second season with the same seed — no new docs inserted, existing team IDs
  reused, no duplicate names.
- A team locked to an active Season 1 is NOT reused for Season 2 — a fresh doc is inserted.
- `resolveAutogenTeams` returns `ResolveAutogenTeamsResult` with correct `recycledCount`,
  `insertedCount`, `modeChanged` values for all 8 test scenarios.
- `teamIds` in the result matches input `generated` order exactly.
- Review step shows "Using your existing teams from a previous season." when all teams are recycled
  and no managed team is involved.
- Review step shows the managed-team notice when `modeChanged === true`.
- `customTeams` schema version incremented; migration strategy present; no DB6 hash mismatch on
  upgrade from the previous version.
- No new RxDB circular dependency; `yarn check:circular-deps` passes.
- All 8 unit tests pass; migration upgrade-path test passes.
- `gameHistoryStore` season-scoped views all filter by `seasonId` (pre-gate).

---

## Out of Scope (this story)

- v2 autogen scheduling or seed selection UI
- Bulk import deduplication
- Any UI for manual dedup resolution
- Removing `ExhibitionGameSetup.disableSave/seasonGameId` fields (Block A Story 3)

---

## Agent Routing

- **Implementation:** `bmad-agent-dev` (Amelia) → SR menu (safe refactor)
- **Schema review gate:** `bmad-agent-architect` (Winston) → CR menu → **must issue APPROVE before PR is created**
- **UX copy / notification visual:** `bmad-agent-ux-designer` (Sally) → if a new notice pattern is introduced
- **E2E regression:** `e2e-test-runner` — add a test that creates a season, navigates away, creates a second season with the same seed, confirms no duplicate team names in standings

---

## BLOCK Constraints

- Do NOT merge before Winston issues APPROVE in the CR menu.
- Do NOT skip the migration strategy — same-version schema change causes DB6 for all users.
- Do NOT reuse a team doc that is locked to an in-progress active season.
- Do NOT touch `GameInner`, `GameContext`, `router.tsx`, or PRNG modules in this story.
