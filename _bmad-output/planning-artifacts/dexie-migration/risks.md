---
author: John (bmad-agent-pm)
date: 2026-05-10
plan: Dexie Storage Migration — Risk Register
parent: README.md
---

# Dexie Migration — Risk Register

> 📋 **John:** Consolidated risks across phases v1–v5, each with a mitigation and the phase that owns it. Mitigations that require new tests are also reflected in the per-phase plans under [`phase-plans/`](phase-plans/).

| #   | Risk                                                                                | Likelihood | Impact   | Mitigation                                                                                                                                                           | Owner phase |
| --- | ----------------------------------------------------------------------------------- | ---------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| R1  | Data loss during RxDB → Dexie bridge migration                                      | Low        | Critical | Read-only source open, transactional bulk writes, post-write count + representative-ID verification, idempotent retry                                                | v4          |
| R2  | Save signature breakage for previously exported v1 bundles                          | Low        | High     | D4: keep `"ballgame:rxdb:v1"` signature key verbatim; legacy-bundle compatibility test                                                                               | v1, v3, v4  |
| R3  | Event-ordering drift between backends (replay/determinism regression)               | Medium     | High     | Per-save promise queue + nextIdxMap mirrored from `SaveStore`; concurrent-append parity test; determinism Playwright                                                 | v1, v3      |
| R4  | Reactive hook timing differences cause UI flicker or stale lists                    | Medium     | Medium   | Hook-shape parity tests; Playwright smoke in v4 covering create/update/delete observed in lists                                                                      | v4          |
| R5  | Schema-hash failure class re-emerges via accidental same-version change             | Medium     | High     | Lint/code-review rule + versioning rule in [`phase-plans/v3-dexie-repositories.md`](phase-plans/v3-dexie-repositories.md) + a test that asserts version monotonicity | every phase |
| R6  | Dexie transaction semantics surprise the team (e.g., async outside `tx`)            | Medium     | Medium   | Transaction contract documented per phase; contract tests for rollback                                                                                               | v3          |
| R7  | Service worker tries to read Dexie storage                                          | Low        | Critical | D8 reaffirmed in `docs/copilot-instructions.md`; SW lint guard in CI to forbid `dexie` import in `src/sw.ts`                                                         | v4          |
| R8  | Bridge migration completes but app errors before marker is written                  | Low        | High     | Marker write is the last step; idempotency test ensures re-run is safe; runner returns typed result                                                                  | v4          |
| R9  | Kill-switch toggled to false after Dexie writes accumulate; data appears lost       | Low        | Medium   | Kill switch initially dev-only (D-pending-2); user-facing copy explains rollback semantics if exposed broadly                                                        | v4          |
| R10 | Bundle size regresses because RxDB and Dexie ship side-by-side in v4                | High       | Low      | v4 ships them side-by-side intentionally; v5 removes RxDB; bundle-size delta recorded in PR descriptions                                                             | v4, v5      |
| R11 | Custom-team duplicate-name detection regresses on `nameLowercase` index             | Low        | Medium   | Contract test covers duplicate-name rejection; index documented in [`phase-plans/v3-dexie-repositories.md`](phase-plans/v3-dexie-repositories.md)                    | v3          |
| R12 | Career-stats query ordering changes between backends                                | Medium     | Medium   | Contract test asserts ordered results; compound indexes mirrored exactly in Dexie schema                                                                             | v3          |
| R13 | Bridge fixture rot — fixtures fall out of sync with current RxDB schema             | Medium     | Medium   | Fixture refresh runs in CI on every RxDB-schema-touching PR; failure forces fixture update                                                                           | v4 onward   |
| R14 | RxDB removal (v5) breaks an unmigrated edge case found late                         | Low        | High     | At least one stable release between v4 and v5 (D-pending-4); CR APPROVE gate; grep test for residual `rxdb`/`rxjs` imports                                           | v5          |
| R15 | `dexie-react-hooks`'s `useLiveQuery` semantics differ subtly from custom RxDB hooks | Medium     | Medium   | Hook-parity tests; document any intentional differences in [`phase-plans/v4-cutover.md`](phase-plans/v4-cutover.md)                                                  | v4          |
| R16 | Yarn lockfile drift between Vercel and CI for Dexie versions                        | Low        | Low      | Lockfile committed; CI uses immutable installs; Phase 1 PR records observed Vercel resolutions                                                                       | v1          |
| R17 | A second app tab open during the bridge migration corrupts destination DB           | Low        | High     | Migration aborts if destination Dexie tables are non-empty (`destination-not-empty` error); user-visible recovery copy                                               | v4          |
| R18 | RxDB removal in v5 breaks `docs/rxdb-persistence.md` cross-references               | High       | Low      | Doc-update task in v5 ships in the same PR; thin redirect note kept for one release                                                                                  | v5          |

## Risk acceptance

The plan accepts that the bridge migration carries the highest residual risk, mitigated by tests (R1, R8, R13, R17), the kill switch (R9), and architect CR APPROVE gating (D7). No combination of mitigations brings residual risk to zero; the kill switch is the last line of defence.

## Risks explicitly out of scope

- Accidental data loss caused by user actions (clearing site data, uninstalling PWA) is not in scope.
- Cross-device sync is out of scope (no backend).
- Storage-quota exhaustion is the same posture as today; no migration-specific mitigation.
