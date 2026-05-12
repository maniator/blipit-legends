# Game Session Refactor — Pre-v2 Architecture Work

> Status: **PLANNED** — implement this epic immediately after League v1 merges and before any v2 scope begins.

## Problem

All games — exhibition, league, and saves-resume — flow through a single `/game` route. Game type is
currently encoded as ad-hoc fields inside `ExhibitionGameSetup` (`disableSave`, `seasonGameId`,
`managedTeam`), which are read by conditional `if` checks scattered throughout `GameInner` and
`GameControls`. Adding each new session capability (watch gating, auto-sim, future tournament mode)
requires threading more conditions deeper into the component tree.

## Goal

Achieve **"same inner game loop, different wrappers"**: the simulation engine (`GameContext`,
`useAutoPlayScheduler`, PRNG chain) stays untouched; session-level rules (save gating, manager access,
season sync) are encoded once in a typed `GameSessionContext` and resolved at the route level.

## Documents in This Folder

| File                                 | Contents                                                          |
| ------------------------------------ | ----------------------------------------------------------------- |
| `01-architecture-decision-record.md` | Winston's ADR: context placement, tree shape, BLOCK constraints   |
| `02-route-split-design.md`           | Route split spec: new routes, navigation contract, migration path |

## Related Planning Artifacts

Planning artifacts (PM board, dev slice, prompts) live in:

```
_bmad-output/planning-artifacts/game-session-refactor/
  01-pm-execution-board.md
  02-winston-arch-spec.md
  03-amelia-dev-slice.md
  04-implementation-prompts.md
  README.md
```

## Sequencing Gate

This epic must start only after:

1. `copilot/league-v1-qa-follow-up` is merged to `master` (League v1 P0 complete, 3/3 E2E passing).
2. No in-flight PRs touching `GameInner`, `GameControls`, `GamePage`, `router.tsx`, or `storage/types.ts`.

## Party-Mode Decision Record

A party-mode roundtable (Winston 🏗️, Amelia 💻, John 📋) on 2026-05-11 reached the following
consensus recorded here as authoritative:

- The architectural vision is **correct** and must be implemented before v2.
- Winston's verdict: **REQUEST_CHANGES** on the current prop-drilling pattern — `GameSessionContext`
  is the right abstraction.
- Amelia's verdict: current `managerModeAllowed` prop is acceptable temporarily; extract when a second
  consumer appears (route split creates that second consumer).
- John's verdict: merge League v1 now; open this epic immediately after; sequence stories 1→2→3 strictly.

See `01-architecture-decision-record.md` for Winston's full BLOCK constraints.
