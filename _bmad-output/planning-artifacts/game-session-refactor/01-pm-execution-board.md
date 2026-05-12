# 01 — PM Execution Board: Game Session Context + Route Split

## Objective

Refactor game session handling so that: (a) the simulation engine stays pure, (b) game-type rules
(save gating, manager access, season sync) are encoded in a typed `GameSessionContext` resolved at
the route level, and (c) exhibition vs league games have dedicated routes with no internal if-checks
in `GameInner` or `GameControls`.

## Epic Status

> **✅ COMPLETE** — All three stories shipped in PR #264 (2026-05-12). CI green. All acceptance criteria met.

## Sequenced Story Table

| Story                  | Priority | Owner        | Dependency       | PR Scope                                                                                                                                                     | Acceptance Criteria                                                                                                          | Required Tests                                              | Status  |
| ---------------------- | -------- | ------------ | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------- |
| S1: Route Split        | P0       | Amelia (Dev) | League v1 merged | `/game/exhibition` + `/game/league/:id` routes; navigation updates in `ExhibitionSetupPage`, `SeasonSchedulePage`, `SeasonHomePage`; `/game` unchanged       | New routes load correctly; save resume unaffected; E2E smoke for all 3 paths                                                 | E2E: 3 smoke tests (exhibition, league, save resume)        | ✅ done |
| S2: GameSessionContext | P0       | Amelia (Dev) | S1 merged        | New `GameSessionContext.tsx`; `GameSessionProvider` in `ExhibitionGamePage` + `LeagueGamePage`; `GameControls` removes prop; `GameControls.test.tsx` updated | `useGameSessionContext()` throws outside provider; `GameControls` renders without `managerModeAllowed` prop; unit tests pass | Unit: context hook + `GameControls` (with provider wrapper) | ✅ done |
| S3: GameInner Cleanup  | P0       | Amelia (Dev) | S2 merged        | `GameInner` reads from `useGameSessionContext()`; `useRxdbGameSync` + `useSeasonGameSync` read from context; `ExhibitionGameSetup` fields deprecated         | `GameInner` has zero direct reads of `setup.disableSave/seasonGameId/managedTeam`; full regression E2E passes                | E2E: all projects; unit: regression on `GameInner`          | ✅ done |

## Winston CR Sign-Off Gate

All three stories require a Winston (bmad-agent-architect) CR-menu review and APPROVE verdict before
the PR is created. This is a hard gate — not optional.

Winston's BLOCK constraints (from ADR `docs/game-session-refactor/01-architecture-decision-record.md`):

1. `GameSessionContext` must NOT live inside `GameContext`.
2. `GameSessionProvider` must wrap `GameProviderWrapper`, not be inside it.
3. No imports from `GameSessionContext` inside the cycle-free sim chain.
4. Do NOT split routes and introduce `GameSessionContext` in the same PR.
5. Do NOT deprecate `/game` route in this epic.

## Ready-for-v2 Gate

> ✅ **ALL GATES PASSED — PR #264**

1. ✅ All three stories shipped in PR #264 with green CI (unit, lint, E2E across 7 device projects).
2. ✅ `yarn test:e2e` passes on all 7 device projects (validated in Docker + CI).
3. ✅ `GameInner` has zero direct reads of `ExhibitionGameSetup.disableSave/seasonGameId/managedTeam`.
4. ✅ `GameControls` has no `managerModeAllowed` prop — reads from `useGameSessionContext()`.
5. ✅ Winston 🏗️ (bmad-agent-architect) conducted party-mode CR review and issued formal APPROVE verdict. All ADR constraints verified and satisfied.

## Operational Constraints

- One story per PR — no bundling.
- Rebase each story branch against `master` before opening its PR.
- No concurrent edits to `GameInner`, `GameControls`, `GamePage`, `router.tsx`, or `storage/types.ts`
  across stories.
- Keep `data-testid` selectors stable throughout.
