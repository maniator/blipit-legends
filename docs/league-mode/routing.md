# League Mode — Routing

> Companion to [`README.md`](README.md). Lists every new route added per phase. All routes preserve existing exhibition + game routes intact.

## v1 routes

| Route                                    | Component (planned)   | Notes                                                                                                                                                      |
| ---------------------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/leagues`                               | `LeaguesHubPage`      | List of past + active seasons. Empty state CTA: "Start a Season".                                                                                          |
| `/leagues/new`                           | `LeagueSetupWizard`   | Multi-step wizard. Refuses to advance past Step 1 if an `active` season exists; deep-links into the existing season instead.                               |
| `/leagues/:seasonId`                     | `SeasonHomePage`      | Season dashboard: standings, "next game" CTA, navigation to schedule / teams / transactions.                                                               |
| `/leagues/:seasonId/schedule`            | `SeasonSchedulePage`  | Day-by-day schedule with completed game results.                                                                                                           |
| `/leagues/:seasonId/teams/:seasonTeamId` | `SeasonTeamPage`      | Team page in season context: roster snapshot, fatigue badges, results-to-date.                                                                             |
| `/game?seasonGameId=<id>`                | `GamePage` (existing) | Watch-mode entry. Query string keeps it reload-safe and avoids clashing with the existing `/game` route. See [`schedule-and-sim.md`](schedule-and-sim.md). |

## v2 additions

| Route                                           | Component              | Notes                                                                                 |
| ----------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------- |
| `/leagues/:seasonId/injuries`                   | `InjuryReportPage`     | All currently-IL players across the league.                                           |
| `/leagues/:seasonId/transactions`               | `TransactionsFeedPage` | Chronological feed of all season transactions (IL moves; trades in v3).               |
| `/leagues/:seasonId/teams/:seasonTeamId/manage` | `RosterManagementPage` | In-depth roster/lineup/rotation editor — the v2 "in-depth roster management" surface. |

## v3 additions

| Route                                           | Component            | Notes                                               |
| ----------------------------------------------- | -------------------- | --------------------------------------------------- |
| `/leagues/:seasonId/teams/:seasonTeamId/trades` | `TradeCenterPage`    | User-initiated trades.                              |
| `/leagues/:seasonId/playoffs`                   | `PlayoffBracketPage` | Bracket overview (mobile accordion / desktop tree). |
| `/leagues/:seasonId/playoffs/:seriesId`         | `PlayoffSeriesPage`  | Series detail with per-game results + box scores.   |

## v4 additions

| Route                        | Component           | Notes                                                              |
| ---------------------------- | ------------------- | ------------------------------------------------------------------ |
| `/leagues/:seasonId/awards`  | `AwardsPage`        | Composite-formula transparency screen.                             |
| `/leagues/:seasonId/leaders` | `LeadersPage`       | Stat-leader tables.                                                |
| `/leagues/:seasonId/history` | `SeasonHistoryPage` | Full season history view; reads from `seasonArchives` if archived. |

## Existing routes — no changes

- `/`, `/exhibition/new`, `/game` (without `seasonGameId`), `/saves`, `/teams`, `/teams/new`, `/teams/:id/edit`, `/help`, `/stats/:teamId`, `/stats/players/:playerId` — all unchanged.

## UI reuse for new pages

Every page above composes existing components per [`ui-reuse.md`](ui-reuse.md). Highlights:

- All league pages wrap their content in `PageLayout` (shared chrome) and use `mq` helpers for responsive rules.
- `SeasonHomePage` and `SeasonSchedulePage` embed `LineScore` for completed games (no new game-result component).
- `SeasonTeamPage` reuses `CustomTeamEditor` in read-only mode; `RosterManagementPage` (v2) reuses `SortablePlayerRow` and `SubstitutionPanel` for in-season lineup updates.
- `AwardsPage` (v4) and `LeadersPage` (v4) reuse `CareerStatsBattingTable`, `CareerStatsPitchingTable`, and `CareerStatsSummaryPanel` directly — no bespoke awards table.
- `LeaguesHubPage` reuses the shape of `SaveSlotList`; the v1 PR extracts a shared `<SlotList>` so both surfaces share one component.
- `PlayoffBracketPage` (v3) is the largest net-new component; it switches between vertical-accordion (mobile) and horizontal-tree (desktop) via `mq`.

## Compatibility & handoff rules

### `/game?seasonGameId=…` handoff

- Watch-mode entry into `/game` always goes through this query-string-addressable URL.
- `GamePage` reads `seasonGameId` on first mount and rehydrates league context from RxDB.
- Reload-safe by construction.
- If `seasonGameId` is missing, `/game` falls back to existing exhibition save behavior — no regression.
- Do **not** use `location.state` for league context handoff; it does not survive reloads or React Router data-router transitions.

### URL encoding

All path segment IDs (`seasonId`, `seasonTeamId`, `seriesId`, `seasonGameId`) are URL-encoded on construction. They use `nanoid`-style alphanumerics, so encoding is usually a no-op, but the encoder is mandatory for forward compatibility.

### Deep-linking

All league routes are deep-linkable. Refreshing any URL rehydrates from RxDB.

### Lock contract surfacing in routes

The Custom Team Editor route (`/teams/:id/edit`) needs to enforce the roster-edit lock when the team is in an active league. **Implemented as a first-class editor mode**, not as generic "disable":

- `<CustomTeamEditor mode="locked" lockedReason={…} lockedDeepLink={…} />` — the editor itself owns the lock rendering so every consumer (this route + the v2 `SeasonTeamPage` embed) gets the same UX without re-implementing.
- In `mode="locked"`: form inputs are disabled, DnD handles use `@dnd-kit`'s `disabled` (not opacity), destructive actions (Save / Delete / Import) are **hidden** (not just disabled), and `editorReducer` actions are guarded as no-ops at the dispatch site so keyboard shortcuts can't mutate state that storage will reject.
- `<StatusBanner>` (extracted in v1) renders inside the editor in lock mode with the message: _"This team is in an active season. Trades, lineup changes, and IL moves happen on the season's team page. Edit will be available again when the season ends."_ Banner includes a deep-link to `/leagues/:seasonId/teams/:seasonTeamId/manage`.
- Visual snapshots: locked state gets its own mobile + desktop baselines.

This route-level enforcement is the user-facing half of the lock contract; the storage-layer guard (the binding contract) is described in [`data-model.md`](data-model.md) and [`setup-wizard.md`](setup-wizard.md).

## Deferred (out of v4)

- Cross-season comparison routes.
- Trade-history-by-player routes.
- Public read-only "share season" routes (would require a backend; this app is local-only).
