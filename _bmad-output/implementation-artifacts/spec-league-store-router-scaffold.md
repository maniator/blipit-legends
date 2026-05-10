---
title: "League Mode v1 — League Store + Router Scaffold"
type: "feature"
created: "2026-05-10"
status: "ready-for-dev"
baseline_commit: "6d6b608"
context:
  - "_bmad-output/planning-artifacts/league-mode-distillate/02-data-model-routing-schedule.md"
  - "_bmad-output/planning-artifacts/league-mode-distillate/02-data-model-routing-schedule.md"
  - "_bmad-output/planning-artifacts/league-mode-distillate/02-data-model-routing-schedule.md"
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** League Mode v1 has storage schemas and sim logic (Phases 1–3) but no public store API and no routes — the UI cannot create or query seasons.

**Approach:** Implement `leagueStore.ts` with `createSeason`, `enrollTeams`, `advanceSeason`, `quickStart`, and `recordResult` APIs (RxDB-backed, fully unit-tested with in-memory DB); add `generateSeasonTeamId` (it already exists but confirm); register all five `/leagues/*` routes in `router.tsx` as lazy-loaded stub page components; add `@feat/leagues` alias to tsconfig/vite.

## Boundaries & Constraints

**Always:**

- All IDs via `generateSeasonId()`, `generateSeasonTeamId()`, `generateSeasonGameId()` from `@storage/generateId`
- All randomness via `src/shared/utils/rng.ts` — no `Math.random()` in league code
- RxDB Mango query syntax: `find({ selector: { ... } })` — never `find({ field: value })`
- `customTeams.activeLeagueIds` mutations only via `customTeamStore.updateCustomTeam()` with sanctioned write context from `@feat/league/storage/sanctionedWrite`
- Per-game seed derivation: `deriveScheduledGameSeed(seasonId, seasonGameId)` — never custom fnv1a calls
- `createSeason` is a single transactional write batch: generate schedule → persist `seasonGames` → persist `seasonTeams` → persist `seasons` doc — all or nothing (RxDB `bulkInsert` + `upsert`)
- All new page stubs use `React.lazy()` and `import * as React from "react"`
- `import { mq } from "@shared/utils/mediaQueries"` — never raw `@media` strings

**Ask First:**

- If `generateSeasonTeamId` is missing from `generateId.ts`, ask before adding it (it exists as of Phase 3 — confirm before proceeding)

**Never:**

- Write `Math.random()` or `Date.now()` as IDs anywhere in league code
- Add `reinitSeed` calls — `runHeadlessGame` owns that; `leagueStore` never calls `reinitSeed`
- Mutate `customTeams` docs directly from store without sanctioned write context
- Wire real UI into stub pages — stubs render `<div>placeholder</div>` only

## I/O & Edge-Case Matrix

| Scenario                                      | Input / State                                                                                               | Expected Output / Behavior                                                                            | Error Handling                                                                           |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Happy path: createSeason (quick start)        | `{ preset: "mini", seasonLength: "sprint", teamIds: [] (all autogen), masterSeed, leagues: [{dhEnabled}] }` | Season doc + 8 seasonTeam docs + 210 game docs written; season status = "active"                      | Rollback all on any write failure                                                        |
| Hand-pick teams: createSeason with 8 team IDs | `{ teamIds: ["ct_…"×8], ... }`                                                                              | Same as above; `customTeams.activeLeagueIds` updated for each team via sanctioned write               | Write guard rejects if any team already in active season (SANCTIONED_WRITE_CTX bypasses) |
| Advance: advanceSeason                        | `{ seasonId, userSeasonTeamId }`                                                                            | Calls `advanceToUserGame`; returns `nextGameId` or null (season complete)                             | Returns null + sets season.status = "complete" if no next game                           |
| Record result: recordResult                   | `{ seasonGameId, boxscore: { homeScore, awayScore } }`                                                      | Writes boxscore to `seasonGames`, updates `seasonGames.status = "completed"`, updates pitcher fatigue | Idempotent: if game already "completed", no-op                                           |
| quickStart                                    | `{ leagues: [{dhEnabled}], masterSeed, autogenOptions }`                                                    | Generates 8 teams via `generateLeagueTeams`, upserts to customTeams, then calls `createSeason`        | Propagates generate errors to caller                                                     |

</frozen-after-approval>

## Code Map

- `src/storage/generateId.ts` -- confirm `generateSeasonId`, `generateSeasonTeamId`, `generateSeasonGameId` exist (Phase 3)
- `src/features/league/storage/types.ts` -- `SeasonRecord`, `SeasonTeamRecord`, `SeasonGameRecord`, `SeasonPlayerStateRecord`
- `src/features/league/storage/sanctionedWrite.ts` -- `SANCTIONED_WRITE_CTX`, `withSanctionedCustomTeamWrite`
- `src/features/league/schedule/generateSchedule.ts` -- `GenerateScheduleInput`, `GenerateScheduleResult`
- `src/features/league/sim/advanceToUserGame.ts` -- `AdvanceToUserGameInput`, `AdvanceToUserGameResult`
- `src/features/league/sim/runHeadlessGame.ts` -- `RunHeadlessGameInput`, `HeadlessGameOutcome`
- `src/features/league/sim/updatePitcherFatigue.ts` -- fatigue update after each game
- `src/features/league/utils/deriveStandings.ts` -- `deriveStandings(games, teamIds): TeamStandingRow[]`
- `src/features/league/utils/deriveScheduledGameSeed.ts` -- `deriveScheduledGameSeed(seasonId, seasonGameId): string`
- `src/features/customTeams/storage/customTeamStore.ts` -- `updateCustomTeam` (accepts sanctioned write)
- `src/features/league/storage/leagueStore.ts` -- **NEW** — public store API
- `src/features/league/storage/leagueStore.test.ts` -- **NEW** — unit tests with in-memory RxDB
- `src/features/leagues/pages/LeaguesHubPage/index.tsx` -- **NEW** stub
- `src/features/leagues/pages/LeagueSetupWizard/index.tsx` -- **NEW** stub
- `src/features/leagues/pages/SeasonHomePage/index.tsx` -- **NEW** stub
- `src/features/leagues/pages/SeasonSchedulePage/index.tsx` -- **NEW** stub
- `src/features/leagues/pages/SeasonTeamPage/index.tsx` -- **NEW** stub
- `src/router.tsx` -- add `/leagues/*` routes (lazy-loaded)
- `vite.config.ts` -- add `@feat/leagues` alias pointing to `src/features/leagues`
- `tsconfig.json` -- add `@feat/leagues/*` path mapping

## Tasks & Acceptance

**Execution:**

- [ ] `src/features/league/storage/leagueStore.ts` -- CREATE — implement `createSeason`, `enrollTeams`, `advanceSeason`, `quickStart`, `recordResult` public API; import `fake-indexeddb/auto` guard pattern; use only `@storage/*` and `@feat/league/*` imports
- [ ] `src/features/league/storage/leagueStore.test.ts` -- CREATE — unit tests using `_createTestDb(getRxStorageMemory())` + `fake-indexeddb/auto`; test: full lifecycle (create → advance → record → complete), idempotent recordResult, quickStart generates + persists teams, activeLeagueIds updated on enroll, sanctioned write guard rejects direct customTeams mutation
- [ ] `src/features/leagues/pages/LeaguesHubPage/index.tsx` -- CREATE — stub `export default function LeaguesHubPage() { return <div data-testid="leagues-hub">Leagues Hub</div>; }`
- [ ] `src/features/leagues/pages/LeagueSetupWizard/index.tsx` -- CREATE — stub with `data-testid="league-setup-wizard"`
- [ ] `src/features/leagues/pages/SeasonHomePage/index.tsx` -- CREATE — stub with `data-testid="season-home"`
- [ ] `src/features/leagues/pages/SeasonSchedulePage/index.tsx` -- CREATE — stub with `data-testid="season-schedule"`
- [ ] `src/features/leagues/pages/SeasonTeamPage/index.tsx` -- CREATE — stub with `data-testid="season-team"`
- [ ] `vite.config.ts` -- EDIT — add `"@feat/leagues": path.resolve(__dirname, "src/features/leagues")` to aliases
- [ ] `tsconfig.json` -- EDIT — add `"@feat/leagues/*": ["src/features/leagues/*"]` to `paths`
- [ ] `src/router.tsx` -- EDIT — add lazy imports for all 5 page stubs; register routes: `/leagues`, `/leagues/new`, `/leagues/:seasonId`, `/leagues/:seasonId/schedule`, `/leagues/:seasonId/teams/:seasonTeamId`

**Acceptance Criteria:**

- Given a Mini-preset season created with 8 team IDs, when `createSeason` is called, then the `seasons` collection has 1 doc with `status="active"`, `seasonTeams` has 8 docs, and `seasonGames` has the expected game count (≥ 30)
- Given `recordResult` is called twice with the same `seasonGameId`, then the second call is a no-op (idempotent) and standings remain correct
- Given `quickStart` is called with autogen options, then 8 new `customTeams` docs exist after the call with `autogen.version` set
- Given all routes are registered, when navigating to `/leagues`, `/leagues/new`, `/leagues/some-id`, `/leagues/some-id/schedule`, `/leagues/some-id/teams/some-team-id`, then each renders without crashing (stub placeholders visible)
- Given the TypeScript compiler runs, when `yarn typecheck` is executed, then zero new errors are introduced
- Given tests run, when `yarn test src/features/league/storage/leagueStore.test.ts` is executed, then all pass

## Design Notes

**`createSeason` write order:** Persist in this order to minimize partial-write recovery risk:

1. `customTeams.activeLeagueIds` update (via sanctioned write) for each enrolled team
2. `seasonTeams` bulk insert
3. `seasonGames` bulk insert (schedule already generated in memory)
4. `seasons` upsert (status = "active") — last, so querying `seasons.status = "active"` is a reliable "season is fully initialized" signal

**`advanceSeason` delegates to `advanceToUserGame`:** No PRNG manipulation in the store — the store only orchestrates the call chain. `runHeadlessGame` owns `reinitSeed`.

**Stub pages:** All in `src/features/leagues/` (plural) to distinguish from `src/features/league/` (the backend logic). The alias `@feat/leagues` maps to this new directory.

## Verification

**Commands:**

- `yarn typecheck` -- expected: zero errors
- `yarn test src/features/league/storage/leagueStore.test.ts` -- expected: all tests pass
- `yarn lint` -- expected: zero new warnings or errors
- `yarn build` -- expected: successful build with no type errors

## Suggested Review Order

_To be populated by step-05._
