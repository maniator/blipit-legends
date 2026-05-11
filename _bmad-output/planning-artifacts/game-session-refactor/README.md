# Game Session Refactor — Planning Artifact Package

> **Epic:** Game Session Context + Route Split (Pre-v2)  
> **Date:** 2026-05-11  
> **Source decision:** Party-mode roundtable (Winston 🏗️, Amelia 💻, John 📋) — 2026-05-11  
> **Gate:** Must be completed before any League v2 scope begins.

## Files

| File                           | Owner               | Contents                                                      |
| ------------------------------ | ------------------- | ------------------------------------------------------------- |
| `01-pm-execution-board.md`     | John (PM)           | Sequenced story table with owners, dependencies, ACs          |
| `02-winston-arch-spec.md`      | Winston (Architect) | Detailed spec for `GameSessionContext` interface + tree shape |
| `03-amelia-dev-slice.md`       | Amelia (Dev)        | Per-story implementation checklist                            |
| `04-implementation-prompts.md` | —                   | Copy-paste BMAD prompts for each story                        |

## Architecture Documents

Full ADR and route split design live in:

```
docs/game-session-refactor/
  README.md
  01-architecture-decision-record.md
  02-route-split-design.md
```

## Sequencing Gate

Start only when:

1. `copilot/league-v1-qa-follow-up` is merged to `master`
2. No in-flight PRs touching `GameInner`, `GameControls`, `GamePage`, `router.tsx`, or `storage/types.ts`

## Story Sequence (strict — no parallelism)

| Story | PR   | Scope                                                                    |
| ----- | ---- | ------------------------------------------------------------------------ |
| 1     | PR A | Route split — new pages, navigation changes, E2E guards                  |
| 2     | PR B | `GameSessionContext` extraction — context, provider, hook, test wrappers |
| 3     | PR C | Cleanup — remove if-checks from `GameInner`, deprecate fields            |

Each PR requires Winston CR sign-off before merge.
