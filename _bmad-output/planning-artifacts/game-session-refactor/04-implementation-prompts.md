# 04 — Implementation Prompts: Game Session Context + Route Split

> Copy-paste these prompts verbatim into a new Copilot agent session to execute each story.  
> All routing rules, guardrails, and architectural constraints are embedded.  
> Do NOT start Story 2 until Story 1 is merged. Do NOT start Story 3 until Story 2 is merged.

---

## Story 1 Prompt: Route Split

```
You are implementing Story 1 of the game-session-refactor epic in the `maniator/blipit-legends`
repository. Read these files IN ORDER before writing a single line of code:

  docs/game-session-refactor/README.md
  docs/game-session-refactor/01-architecture-decision-record.md
  docs/game-session-refactor/02-route-split-design.md
  _bmad-output/planning-artifacts/game-session-refactor/01-pm-execution-board.md
  _bmad-output/planning-artifacts/game-session-refactor/03-amelia-dev-slice.md

## What to implement (Story 1 ONLY — do not start Story 2)

1. Create `src/features/exhibition/pages/ExhibitionGamePage/index.tsx`
   - Reads `location.state.pendingGameSetup` (same shape as current `GamePage`)
   - Renders the same `<Game>` component as `GamePage`
   - No `GameSessionProvider` yet — that is Story 2
   - Handles missing setup: redirect to `/exhibition/new`
   - Back-navigation: "New Game" goes to `/exhibition/new`

2. Create `src/features/leagues/pages/LeagueGamePage/index.tsx`
   - Reads `:seasonGameId` from `useParams()`
   - Fetches the `SeasonGameRecord` from RxDB to get team IDs, seeds, managedTeam
   - Builds `ExhibitionGameSetup` for the simulation (same fields as today)
   - No `GameSessionProvider` yet — that is Story 2
   - Loading state while DB fetch is in flight
   - Not-found guard: redirect to `/leagues` if seasonGameId is invalid

3. Update `src/router.tsx`
   - Add route: `game/exhibition` → `<ExhibitionGamePage />`
   - Add route: `game/league/:seasonGameId` → `<LeagueGamePage />`
   - Do NOT modify the existing `game` route

4. Update navigation callers — IMPORTANT: ExhibitionSetupPage calls `onStartGame()` from
   AppShellOutletContext, which routes through AppShell.handleStartFromExhibition. Update
   `src/features/gameplay/components/AppShell/index.tsx` — change `handleStartFromExhibition`
   to navigate to `/game/exhibition`. ExhibitionSetupPage itself does NOT need to change.
   - `src/features/gameplay/components/AppShell/index.tsx`:
     navigate("/game/exhibition", { state: { pendingGameSetup: setup, pendingLoadSave: null } })
   - `src/features/leagues/pages/SeasonSchedulePage/index.tsx`:
     navigate(`/game/league/${game.id}`, { state: { managedTeam: managedTeamIdx } })
     where managedTeamIdx is 0 | 1 | null (null = watch mode, no managed team)
   - `src/features/leagues/pages/SeasonHomePage/index.tsx`:
     same pattern as SeasonSchedulePage
   - `src/features/saves/pages/SavesPage/index.tsx`:
     LEAVE UNCHANGED — save resume stays on /game

5. Unit tests for both new page components (thin — assert they render without crashing)

6. E2E smoke tests in `e2e/tests/game-routes.spec.ts`:
   - Test 1: ExhibitionSetupPage → Play Ball → URL is /game/exhibition → game starts
   - Test 2: Season schedule → Watch → URL is /game/league/:id → game starts
   - Test 3: Saves page → resume → URL is /game → game resumes (regression guard)

## Agent routing

- Implementation: bmad-agent-dev (Amelia) → SR menu (safe refactor)
- Before creating the PR: bmad-agent-architect (Winston) → CR menu → must issue APPROVE
- E2E validation: e2e-test-runner operational specialist (runs inside Docker container)
- Visual snapshots (if changed): e2e-test-runner only, inside mcr.microsoft.com/playwright:v1.58.2-noble

## BLOCK constraints — stop if any of these would be violated

- Do NOT add GameSessionContext, GameSessionProvider, or session if-checks in this story
- Do NOT modify GameInner, GameControls, or storage/types.ts in this story
- Do NOT remove or deprecate the /game route
- Do NOT bundle Story 1 and Story 2 in the same PR

## Validation before creating the PR

Run ALL of these and confirm green:
  yarn lint
  yarn format:check
  yarn typecheck
  yarn typecheck:e2e
  yarn test src/features/exhibition/pages/ExhibitionGamePage/
  yarn test src/features/leagues/pages/LeagueGamePage/
  yarn build

E2E: route to e2e-test-runner to run game-routes.spec.ts in Docker.

Do not stop to ask clarifying questions — all decisions are locked in the plan files.
```

---

## Story 2 Prompt: GameSessionContext Extraction

```
You are implementing Story 2 of the game-session-refactor epic in the `maniator/blipit-legends`
repository. Story 1 (route split) is already merged. Read these files IN ORDER before writing code:

  docs/game-session-refactor/01-architecture-decision-record.md
  _bmad-output/planning-artifacts/game-session-refactor/02-winston-arch-spec.md
  _bmad-output/planning-artifacts/game-session-refactor/03-amelia-dev-slice.md

## What to implement (Story 2 ONLY — do not start Story 3)

1. Create `src/features/gameplay/context/GameSessionContext.tsx`
   - Copy the exact interface from `02-winston-arch-spec.md`
   - Export: `GameSessionContextValue`, `GameSessionType`, `GameSessionContext`,
     `useGameSessionContext`, `GameSessionProvider`
   - `useGameSessionContext` must throw with a clear error message if called outside provider

2. Update `src/features/gameplay/context/index.tsx`
   - Re-export `GameSessionContextValue`, `useGameSessionContext`, `GameSessionProvider`

3. Update `src/features/exhibition/pages/ExhibitionGamePage/index.tsx`
   - Wrap `<Game>` with `<GameSessionProvider value={deriveExhibitionSession(setup)}>`
   - `deriveExhibitionSession` is in the arch spec

4. Update `src/features/leagues/pages/LeagueGamePage/index.tsx`
   - Wrap `<Game>` with `<GameSessionProvider value={deriveLeagueSession(seasonGameId, managedTeamIdx)}>`
   - `deriveLeagueSession` is in the arch spec

5. Update `src/features/gameplay/components/GameControls/index.tsx`
   - Remove `managerModeAllowed` from the `Props` type
   - Remove `managerModeAllowed` from the function params
   - Replace with: `const { managerModeAllowed } = useGameSessionContext();`

6. Update `src/features/gameplay/components/Game/GameInner.tsx`
   - Remove `managerModeAllowed` prop pass to `<GameControls>`
   - Remove `const [managerModeAllowed, setManagerModeAllowed] = React.useState(true)` local state
   - NOTE: Do NOT yet remove seasonGameIdRef, disableSave handling, or other session if-checks — Story 3

7. CRITICAL — Update `src/features/gameplay/components/Game/GamePage.tsx`
   - MUST add `<GameSessionProvider>` wrapping `<GameProviderWrapper>`.
   - GamePage uses a `useState`-based session value because the auto-resume path updates
     managerModeAllowed asynchronously after the save is matched.
   - See `02-winston-arch-spec.md` §"How GamePage Wraps the Context" for the exact pattern.
   - Failure to do this causes a runtime crash: "useGameSessionContext must be used within
     GameSessionProvider" on every save-resume flow once Story 2 ships.
   - Missing-setup guard: if GamePage has no pendingLoadSave and no auto-resume save, default
     session to { managerModeAllowed: true, disableSave: false, seasonGameId: null, managedTeam: null }

8. Update `src/test/testHelpers.ts`
   - Add `makeGameSessionContext(overrides?)` helper (see `02-winston-arch-spec.md`)

9. Update `src/features/gameplay/components/GameControls/GameControls.test.tsx`
   - Wrap every `render(<GameControls ...>)` with `<GameSessionProvider value={makeGameSessionContext(...)}>`
   - Tests verifying managerModeAllowed=false: pass `{ managerModeAllowed: false }` to makeGameSessionContext

10. Create `src/features/gameplay/context/GameSessionContext.test.tsx`
    - Test: `useGameSessionContext()` throws outside provider
    - Test: values provided by `GameSessionProvider` are readable via hook
    - Test: `makeGameSessionContext({ managerModeAllowed: false })` produces correct shape

## Agent routing

- Implementation: bmad-agent-dev (Amelia) → SR menu
- Before PR: bmad-agent-architect (Winston) → CR menu → must APPROVE
- No E2E changes expected in Story 2; run existing game-routes.spec.ts as regression guard

## BLOCK constraints

- Do NOT add any GameSessionContext fields to GameContext (simulation context)
- GameSessionProvider MUST be outside (wrapping) GameProviderWrapper in the tree
- No imports from GameSessionContext in: strategy, advanceRunners, gameOver, playerOut,
  hitBall, buntAttempt, playerActions, reducer
- Do NOT remove session if-checks from GameInner in this story — that is Story 3
- Do NOT bundle Story 2 and Story 3 in the same PR

## Validation before creating the PR

  yarn lint
  yarn format:check
  yarn typecheck
  yarn typecheck:e2e
  yarn test src/features/gameplay/context/GameSessionContext.test.tsx
  yarn test src/features/gameplay/components/GameControls/
  yarn build

E2E: route to e2e-test-runner to confirm existing game-routes.spec.ts still passes.

Do not stop to ask clarifying questions — all decisions are locked in the plan files.
```

---

## Story 3 Prompt: Remove if-checks from GameInner

```
You are implementing Story 3 of the game-session-refactor epic in the `maniator/blipit-legends`
repository. Stories 1 and 2 are already merged. Read these files IN ORDER before writing code:

  docs/game-session-refactor/01-architecture-decision-record.md
  _bmad-output/planning-artifacts/game-session-refactor/02-winston-arch-spec.md
  _bmad-output/planning-artifacts/game-session-refactor/03-amelia-dev-slice.md

## What to implement (Story 3 — cleanup)

1. Update `src/features/gameplay/components/Game/GameInner.tsx`
   - Remove: `const [managerModeAllowed, setManagerModeAllowed] = React.useState(true);`
   - Remove: `const seasonGameIdRef = React.useRef<string | undefined>(undefined);`
   - Remove: the `consumeSetup` effect block that sets managerModeAllowed and seasonGameIdRef
   - Add: `const { managerModeAllowed, seasonGameId, disableSave, managedTeam } = useGameSessionContext();`
   - Remove all direct reads of `pendingGameSetup.disableSave`, `.seasonGameId`, `.managedTeam`
   - GameInner may still receive `pendingGameSetup` for simulation engine init (teams, seed, overrides)
     but must not branch on session-type fields

2. Update `src/features/gameplay/hooks/useRxdbGameSync.ts`
   - Hook calls `useGameSessionContext()` internally to read `disableSave`
   - Remove any `disableSave` prop/param it currently receives from GameInner

3. Update `src/features/leagues/hooks/useSeasonGameSync.ts`
   - Hook calls `useGameSessionContext()` internally to read `seasonGameId`
   - Remove `seasonGameIdRef` parameter (was `React.MutableRefObject<string | undefined>`)

4. Update `src/storage/types.ts`
   - Add `@deprecated Use GameSessionContext instead` JSDoc to `ExhibitionGameSetup.disableSave`
   - Add `@deprecated Use GameSessionContext instead` JSDoc to `ExhibitionGameSetup.seasonGameId`
   - Do NOT remove the fields yet — leave for v2 cleanup when callers are fully migrated

5. Audit remaining direct reads of ExhibitionGameSetup.disableSave / .seasonGameId
   - Run: grep -r "disableSave\|seasonGameId" src/ --include="*.ts" --include="*.tsx"
   - Confirm only `@storage/types.ts` declarations and the new page components remain

## Agent routing

- Implementation: bmad-agent-dev (Amelia) → SR menu
- Before PR: bmad-agent-architect (Winston) → CR menu → must APPROVE
- Full E2E regression: e2e-test-runner specialist → all 7 device projects

## BLOCK constraints

- Do NOT import from GameSessionContext in any module in the cycle-free chain:
  strategy → advanceRunners → gameOver → playerOut → hitBall → buntAttempt → playerActions → reducer
- Do NOT remove disableSave / seasonGameId fields from ExhibitionGameSetup in this story
- Do NOT touch any PRNG, RxDB schema, or simulation reducer logic

## Validation before creating the PR

  yarn lint
  yarn format:check
  yarn typecheck
  yarn typecheck:e2e
  yarn test
  yarn build

Full E2E — route to e2e-test-runner to run all 7 Playwright device projects in Docker.
The e2e-test-runner must confirm:
  - Exhibition game starts and completes on /game/exhibition
  - League game starts on /game/league/:id and writes season result on FINAL
  - Save resume still works on /game (regression guard)
  - Watch mode shows no manager controls (managerModeAllowed=false)
  - Manager mode shows controls (managerModeAllowed=true)

After e2e-test-runner confirms pass, Winston CR → APPROVE → create PR.

After the PR merges, route to Paige (bmad-agent-tech-writer) to produce the required doc updates:
  - docs/architecture.md — add /game/exhibition and /game/league/:seasonGameId routes; mark /game
    as legacy; update onStartGame description; add GameSessionContext section; update auto-play
    section to include ExhibitionGamePage and LeagueGamePage
  - docs/repo-layout.md — add ExhibitionGamePage and LeagueGamePage file entries; update router
  - .github/copilot-instructions.md — add two new route rows to the route table
  - docs/game-session-refactor/01-architecture-decision-record.md — update Status to IMPLEMENTED
Paige's doc updates must be reviewed and approved by Winston before being merged.

Do not stop to ask clarifying questions — all decisions are locked in the plan files.
```

---

## Post-Epic Validation Checklist

After all three stories are merged and green on `master`, confirm:

- [ ] `GameInner` has zero direct reads of `ExhibitionGameSetup.disableSave/seasonGameId/managedTeam`
- [ ] `GameControls` has no `managerModeAllowed` prop
- [ ] `useRxdbGameSync` has no `disableSave` parameter
- [ ] `useSeasonGameSync` has no `seasonGameIdRef` parameter
- [ ] `GameSessionContext` is NOT imported by any module in the cycle-free chain
- [ ] All 7 Playwright device projects pass on `master`
- [ ] Winston issued APPROVE for all three story PRs
- [ ] Paige produced doc updates for `docs/architecture.md`, `docs/repo-layout.md`, `.github/copilot-instructions.md`
- [ ] `docs/game-session-refactor/01-architecture-decision-record.md` status updated to IMPLEMENTED
