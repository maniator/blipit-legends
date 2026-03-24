# League Mode — Implementation Plan

> See [README.md](README.md) for the decisions log and document index.

> **Scope:** Phases 1–6 are the **initial near-term implementation target**. Phases 7–10 are **future extensions** — fully documented for when they are built, but not part of the first slice.

---

## Phase 1 — RxDB Collections

**Goal:** Define all new persistent data structures needed for league mode.

### Checklist

- [ ] Create `src/features/leagues/storage/schemaV1.ts` with four new collection configs at `version: 0`:
  - `leagues` — league header, team membership, division config, season presets
  - `leagueSeasons` — per-season record (schedule length, trade deadline game#, playoff format, status)
  - `scheduledGames` — one doc per scheduled game slot (PENDING / COMPLETED / CANCELLED)
  - `tradeRecords` — immutable trade log docs *(schema stub only in initial slice; fully wired in Phase 8)*
- [ ] Add all four collections to `DbCollections` in `src/storage/db.ts`
- [ ] Wire collection configs into `initDb`'s `addCollections` call
- [ ] Bump `BETA_SCHEMA_EPOCH` from `"v1.2"` to `"v1.3"` in `src/storage/db.ts` — **this single line handles all schema changes**; no migration strategies needed anywhere
- [ ] Add `activeLeagueId?: string | null` to `TeamRecord` type and `teams` RxDB schema `properties`
- [ ] Add `leagueSeasonId`, `scheduledGameId`, `gameType` fields to `CompletedGameRecord` type and `completedGames` RxDB schema `properties` (and the new `["leagueSeasonId", "playedAt"]` compound index)
- [ ] Write unit tests for `createLeague`, `addSeason`, `upsertScheduledGame`, `createTradeRecord` in a test DB

### Schema Summaries

See [data-model.md](data-model.md) for the full field-level schema definitions and the ER diagram.

> **Note:** The `tradeRecords` schema is defined in Phase 1 for future compatibility with the epoch bump, but trade execution logic is deferred to Phase 8.

---

## Phase 2 — Schedule Generator

**Goal:** Given a list of team IDs and a season length, produce a full round-robin schedule with series grouping.

> See [schedule-algorithm.md](schedule-algorithm.md) for the full algorithm specification, series vs. one-off design decisions, worked examples, and the round-robin rotation pseudocode.

### Checklist

- [ ] Create `src/features/leagues/utils/scheduleGenerator.ts`
- [ ] Implement `generateSchedule(options: GenerateScheduleOptions): ScheduledGameSlot[]`
  - Input: team IDs, season preset (Quick 10 / Short 30 / Standard 60 / Full 162 / Custom N), series length per matchup (default 3), division weighting flag
  - Output: flat array of `ScheduledGameSlot` objects with `homeTeamId`, `awayTeamId`, `gameDay` (integer), `seriesId`
- [ ] Validate even matchup distribution across all teams (every team plays the same total games ±1)
- [ ] If `divisionWeightedSchedule: true`, each division-rival matchup gets ~1.4× the games of inter-division matchups (mirrors MLB division weighting)
- [ ] Compute `tradeDeadlineGameDay` = `Math.floor(totalGames / 2)`; write it to the `leagueSeason` doc at schedule creation
- [ ] Write unit tests:
  - 4-team league, Quick (18 games/team, seriesLength=3) — verify each team plays 18 games, home/away balanced
  - 8-team / 2-division league, Standard (60) — verify division weighting
  - Edge: odd number of teams — verify byes are inserted correctly

### Season Presets

| Preset | Total Regular-Season Games per Team |
|---|---|
| Quick | 10 |
| Short | 30 |
| Standard | 60 |
| Full | 162 |
| Custom | User-specified (min 4, max 200) |

---

## Phase 3 — Division Auto-Assignment & Generate League

**Goal:** When a league is created, evenly distribute the selected teams into the chosen number of divisions automatically. Also provide a **Generate League** quick-start path that auto-creates N teams and wires them into a new league in one shot, so users don't need to manually create every team before their first league game.

### Checklist — Division Assignment

- [ ] Create `src/features/leagues/utils/assignDivisions.ts`
- [ ] Implement `assignDivisions(teamIds: string[], divisionCount: 0 | 2 | 4): DivisionAssignment`
  - `divisionCount: 0` → no divisions; return a single group with all teams
  - Sort teams by name for deterministic assignment
  - Slice team array into `divisionCount` equal chunks; if `teamIds.length % divisionCount !== 0`, front-load the remainder one-per-division until balanced
  - Return: `{ divisionId: string; teamIds: string[] }[]`
- [ ] Store the resulting `divisions` array on the `League` document
- [ ] On `LeagueSetupPage`, allow the user to pick division count (0, 2, or 4) and *optionally* drag-reorder teams within the auto-assigned divisions before confirming; if they don't, the default assignment is used as-is
- [ ] Write unit tests:
  - 8 teams, 2 divisions → two groups of 4
  - 6 teams, 2 divisions → two groups of 3
  - 8 teams, 4 divisions → four groups of 2
  - 9 teams, 4 divisions → groups of [3, 2, 2, 2] (front-loaded)
  - 5 teams, 2 divisions → groups of [3, 2]
  - 6 teams, 0 divisions → one group of 6

### Checklist — Generate League (Quick Setup)

- [ ] Create `src/features/leagues/utils/generateLeague.ts`
- [ ] Implement `generateLeague(options: GenerateLeagueOptions): Promise<GenerateLeagueResult>`
  - Calls `generateDefaultCustomTeamDraft(teamSeed)` for each of N teams, where `teamSeed = \`${rootSeed}_team_${i}\``
  - Checks generated teams for city/nickname collisions; retries with an offset seed (`${rootSeed}_team_${i}_retry_${attempt}`) until all N teams have distinct names
  - Saves each generated team as a full `TeamRecord` via `customTeamStore.createTeam(draft)` — teams are **persistent** and appear in `/teams` like any manually-created team
  - Calls `assignDivisions` with the new team IDs and the chosen `divisionCount`
  - Calls `leagueStore.createLeague(...)` with an auto-generated league name and all team IDs
  - Returns `{ leagueId, teamIds, divisions }`
- [ ] Add `GenerateLeagueModal` component to `LeagueSetupPage` — a simple overlay with:
  - **Team count** picker: 4, 6, or 8 (must be even; UI disables odd values)
  - **Divisions** picker: None, 2, or 4 (auto-validates against team count)
  - **Seed** input (optional; pre-populated with `generateFreshSeed()`, editable for reproducibility)
  - **League name** input (pre-populated with auto-generated name, editable)
  - **"Generate & Play"** button — runs `generateLeague`, then navigates to `LeagueDetailPage`
- [ ] Add a **"Quick Setup — Generate League"** entry point on `LeagueSetupPage` above the manual team-picker flow
- [ ] Write unit tests:
  - `generateLeague({ teamCount: 4, divisionCount: 2, seed: "test" })` → 4 distinct team names, 2 divisions of 2
  - `generateLeague({ teamCount: 6, divisionCount: 0, seed: "test" })` → 6 teams, no divisions
  - Collision retry: mock `generateDefaultCustomTeamDraft` to return duplicate city on first attempt; assert retry produces unique names

### `generateLeague` TypeScript API

```ts
export interface GenerateLeagueOptions {
  teamCount: 4 | 6 | 8;
  divisionCount: 0 | 2 | 4;
  /** Seed for deterministic team generation. Defaults to generateFreshSeed() if omitted. */
  seed?: string | number;
  /** League name override. Defaults to auto-generated "{City} League" from the first team's city. */
  leagueName?: string;
}

export interface GenerateLeagueResult {
  leagueId: string;
  teamIds: string[];
  divisions: DivisionAssignment;
}

export async function generateLeague(
  options: GenerateLeagueOptions,
): Promise<GenerateLeagueResult>;
```

> **Relationship to existing `generateDefaultCustomTeamDraft`:** `generateLeague` is a thin orchestrator — it calls the existing `generateDefaultCustomTeamDraft` function from `@feat/customTeams/generation/generateDefaultTeam` for each team and persists the results via `customTeamStore`. It does not duplicate the team generation logic.

> **Generated teams are permanent:** Teams created by "Generate League" are stored as full `TeamRecord` docs. They appear in `/teams` and can be edited, exported, or reused in future leagues, exactly like manually-created teams. There is no "ephemeral" or "league-only" team concept.

---

## Phase 4 — Feature Directory & Scaffold

**Goal:** Create the full `src/features/leagues/` directory tree before any UI work begins.

### Directory Structure

```
src/features/leagues/
├── components/
│   ├── LeagueCard/               # summary card on hub page
│   ├── StandingsTable/           # division or overall standings
│   ├── ScheduleCard/             # single scheduled game slot
│   ├── SeriesGroup/              # grouped game cards for a series day
│   ├── NightSummaryModal/        # bulk-sim results overlay
│   ├── GenerateLeagueModal/      # Phase 3 quick-setup modal (team count + seed + name)
│   ├── PlayoffBracket/               # bracket visualization ← Phase 9 (future)
│   ├── TradePanel/                    # two-team trade UI ← Phase 8 (future)
│   └── GameModeModal/            # "Box Score / Watch / Skip" picker
├── hooks/
│   ├── useLeagueStore.ts         # reactive RxDB hook for league queries
│   ├── useSchedule.ts            # reactive hook for scheduledGames
│   ├── useStandings.ts           # derived standings from completedGames
│   └── useBulkSimulate.ts        # orchestrates headless sim for N games
├── pages/
│   ├── LeagueHubPage/            # /leagues — list all leagues
│   ├── LeagueSetupPage/          # /leagues/new — create wizard
│   ├── LeagueDetailPage/         # /leagues/:leagueId — season overview
│   ├── SchedulePage/             # /leagues/:leagueId/seasons/:seasonId/schedule
│   ├── PlayoffBracketPage/       # /leagues/:leagueId/seasons/:seasonId/playoffs  # ← Phase 9 (future)
│   └── LeagueRosterPage/         # /leagues/:leagueId/roster (trades)  # ← Phase 8 (future)
├── storage/
│   ├── schemaV1.ts               # RxDB schema configs (see Phase 1)
│   ├── leagueStore.ts            # CRUD operations (createLeague, etc.)
│   ├── scheduleStore.ts          # scheduledGames read/write helpers
│   └── tradeStore.ts             # tradeRecords write helpers  # ← Phase 8 (future)
└── utils/
    ├── scheduleGenerator.ts      # Phase 2
    ├── assignDivisions.ts        # Phase 3
    ├── generateLeague.ts         # Phase 3 — quick-start: auto-create N teams + league in one shot
    ├── standingsComputer.ts      # win% + tiebreakers
    ├── headlessSim.ts            # synchronous single-game sim wrapper
    └── playoffBracket.ts         # bracket seeding + series state  # ← Phase 9 (future)
```

### Checklist

- [ ] Create the directory tree above (empty index files or minimal stubs)
- [ ] Add `@feat/leagues/*` alias to `tsconfig.json` under `compilerOptions.paths`
- [ ] Add the new routes to `src/router.tsx` (see [routing.md](routing.md))
- [ ] Add **League** nav entry to `HomeScreen` (behind a feature flag or always visible — TBD)

> **Note:** Components and pages marked *(future)* should be created as minimal stub files (empty index.ts) during scaffolding so the directory structure is complete, but their implementation is deferred.

---

## Phase 5 — Playing Games (Three Modes)

**Goal:** Users can engage with league games in one of three modes for each game slot.

See [gameplay-modes.md](gameplay-modes.md) for the full flow diagrams.

### Checklist

#### Box Score (headless sim)

- [ ] Implement `headlessSim(setup: GameSaveSetup, seed: string): CompletedGameResult` in `src/features/leagues/utils/headlessSim.ts`
  - Imports the existing game `reducer` and `initialState`
  - Runs the reducer synchronously in a `while (!state.gameOver)` loop with the seeded RNG
  - Returns: `{ homeScore, awayScore, innings, boxScore: BoxScoreData, notableEvents: string[] }`
  - Must be a pure function — no React, no RxDB side effects
- [ ] Implement `selectAiStartingPitcherIdx(rosterPitchers, pitcherRoles, gameSeed)` in `headlessSim.ts` or a shared `starterSelection.ts`
  - Selects the starting pitcher for each AI-managed team using a deterministic seed-hash rotation (see [stamina.md](stamina.md#v1-league-solution-deterministic-rotation-via-game-seed))
  - Prefers pitchers with role `"SP"` or `"SP/RP"`; falls back to index 0 for legacy/stock teams with no roles set
  - Result is used to set `activePitcherIdx` in `GameSaveSetup` before the sim begins
- [ ] Wire headless sim into `scheduleStore.completeScheduledGame(gameId, result)`
  - Writes result to `scheduledGames` doc (status = COMPLETED)
  - Writes a `CompletedGameRecord` to the existing `completedGames` collection (for stats tracking)
- [ ] Add "Box Score" option to `GameModeModal`

#### Watch / Manage

- [ ] Add `leagueContext?: LeagueGameContext` to `location.state` shape for `/game` navigation
  - `LeagueGameContext` = `{ leagueId, seasonId, scheduledGameId }`
- [ ] In `GamePage`, after `gameOver`, detect `leagueContext` in `location.state`
  - If present: call `scheduleStore.completeScheduledGame` with the final score, then `navigate` back to the schedule page
  - If absent: existing exhibition behavior unchanged
- [ ] Add "Watch / Manage" option to `GameModeModal`

#### Simulate Day (Bulk)

- [ ] Implement `useBulkSimulate` hook in `src/features/leagues/hooks/useBulkSimulate.ts`
  - Takes an array of `ScheduledGameSlot` for the current game day
  - Runs each unflagged game through `headlessSim` in sequence (synchronous, no async needed)
  - For flagged ("Watch") games: if any exist, shows a confirmation modal before proceeding
  - On completion: calls `scheduleStore.completeScheduledGame` for each result, then opens `NightSummaryModal`
- [ ] Implement `NightSummaryModal` (see [gameplay-modes.md](gameplay-modes.md#night-summary-modal))
- [ ] Add "Simulate Day" button to `SchedulePage` — enabled when current game day has at least one PENDING game
- [ ] "Simulate Day" default behavior: advance one full "game day" (all matchups in the current active series day)
- [ ] "Simulate Day" advanced override: show checkboxes on each `ScheduleCard` to let user select exactly which games to include in the bulk sim run

---

## Phase 6 — Standings & Season Completion

**Goal:** Live standings derived from completed games; season automatically completes when all regular-season games are resolved, with champion determined by best win percentage.

### Checklist

#### Standings

- [ ] Implement `computeStandings(games: CompletedGameRecord[], teams: TeamRecord[], divisions?: DivisionAssignment): StandingsRow[]` in `standingsComputer.ts`
  - Fields per row: `teamId`, `teamName`, `W`, `L`, `Pct`, `GB`, `divisionId?`, `H2H`, `RD` (run differential in H2H games), `overallRD`
  - Tiebreaker order: H2H win% → RD in H2H games → overall RD
  - Group by division if `divisions` provided, else single overall table
- [ ] Implement `useStandings(seasonId: string)` hook — queries `completedGames` for the given season, passes results to `computeStandings`, returns sorted `StandingsRow[]`
- [ ] Build `StandingsTable` component — renders division headers when divisions present

#### Season Completion (v1 — champion by best record)

- [ ] After each `completeScheduledGame` call, check whether all `REGULAR` games for the season are `COMPLETED` or `CANCELLED`
- [ ] If so, compute final standings and set `leagueSeason.championTeamId` to the team with the best win percentage (tiebreaker: H2H → run differential)
- [ ] Set `leagueSeason.status = "COMPLETE"`
- [ ] `LeagueDetailPage` shows a **Champion Banner** once `status === "COMPLETE"`
- [ ] Season becomes read-only when complete

> **Note:** This is the v1 completion path — no playoffs. The playoff bracket is a Phase 9 extension. See [playoffs.md](playoffs.md) for the future design.

---

## ⏭ Future Phases

> The phases below are **not** part of the initial implementation target. They are documented here to guide future development. Implementation should begin only after Phases 1–6 are shipped and stable.

---

## Phase 7 — Stats Hub Migration *(Future)*

**Goal:** Promote `/stats` from exhibition-only to a hub with Exhibition and League tabs.

> See [stats-migration.md](stats-migration.md) for the full plan.

### Checklist

- [ ] Create `StatsHubLayout` at `/stats` with two tabs: **Exhibition** and **League**
- [ ] Redirect `/stats` → `/stats/exhibition`
- [ ] Exhibition tab mounts existing `CareerStatsPage` as a nested route
- [ ] League tab lists leagues; navigates to `/stats/league/:leagueId` for per-league stats
- [ ] Preserve all existing deep-link redirects (`/career-stats` → `/stats/exhibition`)
- [ ] Update all internal careerStats links from `/stats/:teamId` → `/stats/exhibition/:teamId`

---

## Phase 8 — Trades *(Future)*

> *(Future phase — not part of the initial implementation target.)*

**Goal:** Allow roster swaps between league teams, gate by trade deadline.

See [trades.md](trades.md) for full flow diagram and constraint table.

### Checklist

- [ ] Build `TradePanel` component: two-team picker → player list per team → drag-and-drop (or click-to-select) player exchange → confirm button
- [ ] Implement `tradeStore.executeTrade(trade: TradeInput): Promise<void>`
  - Validates: trade deadline not passed, no PENDING games for either team that day, roster minimums (≥9 batters, ≥1 pitcher each side post-trade)
  - Writes a `TradeRecord` (immutable) to `tradeRecords` collection
  - Updates `TeamRecord.rosterPlayerIds` for both teams atomically
- [ ] Enforce deadline in `LeagueRosterPage`: disable `TradePanel` and show a "Trade Deadline Passed" banner when `currentGameDay > tradeDeadlineGameDay`
- [ ] Add `TradeHistory` view to `LeagueRosterPage`: read-only list of `TradeRecord` docs sorted by date

---

## Phase 9 — Playoffs *(Future)*

> *(Future phase — not part of the initial implementation target.)*

**Goal:** Automatically generate a single-elimination bracket when the regular season ends; run series to completion.

See [playoffs.md](playoffs.md) for bracket diagrams and series-state machine.

### Checklist

- [ ] Implement `playoffBracket.ts`:
  - `seedTeams(standings: StandingsRow[], format: PlayoffFormat): PlayoffSeed[]` — top N teams by division-winner-first seeding
  - `generateBracket(seeds: PlayoffSeed[], format: PlayoffFormat): PlayoffBracket` — produces all first-round matchup slots
  - `advanceBracket(bracket: PlayoffBracket, seriesResult: SeriesResult): PlayoffBracket` — immutable update after a series clinch
- [ ] Auto-trigger playoff bracket creation when `leagueSeason.status` transitions to `PLAYOFFS`
  - Trigger: `scheduledGames` where `seasonId === X` and `type === REGULAR` are all COMPLETED or CANCELLED
- [ ] Schedule all potential series game slots upfront (e.g. Bo5 = 5 slots); mark extras as CANCELLED when series is clinched
- [ ] Build `PlayoffBracketPage` — visual bracket with series scores and series-win counts per team
- [ ] Champion crowning: when the finals series is clinched, set `leagueSeason.status = COMPLETE` and `leagueSeason.championTeamId`

### Playoff Format Options

| Format | Series Length | Default? |
|---|---|---|
| Bo3 | Best of 3 | |
| Bo5 | Best of 5 | ✅ (if user makes no choice) |
| Bo7 | Best of 7 | |

Number of teams that advance: configurable (2 / 4 / 8); default = `min(4, Math.floor(teamCount / 2))`.

---

## Phase 10 — Multi-Season *(Future)*

> *(Future phase — not part of the initial implementation target.)*

**Goal:** After a champion is crowned, allow a new season to begin with the same teams; preserve history.

### Checklist

- [ ] Add "Start New Season" button to `LeagueDetailPage` (enabled only when `leagueSeason.status === COMPLETE`)
- [ ] `leagueStore.startNewSeason(leagueId)`:
  - Creates a new `LeagueSeason` doc with `seasonNumber = previousSeason.seasonNumber + 1`
  - Inherits teams and divisions from the league doc
  - Rosters carry over as-is (no automatic roster reset — players stay on their current teams after trades)
  - Generates a fresh schedule via `generateSchedule`
- [ ] `LeagueDetailPage` shows a season picker (dropdown) to browse historical seasons
- [ ] Historical season data is read-only: schedule, standings, bracket, and box scores are all preserved in RxDB
- [ ] `StatsHubPage` league tab: season picker filters stats to the selected season (or "All Time")
