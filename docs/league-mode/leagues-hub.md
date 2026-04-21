# League Mode — Leagues Hub

> Companion to [`README.md`](README.md). Owns the `/leagues` hub UX across all phases. Resolves UX P0-4 and P1-11 from the round-2 `@ux-design-lead` review (return-user "Continue" CTA, empty/active/complete states, microcopy inventory, `/saves` vs `/leagues` mental-model split).

## Why a dedicated doc

The leagues hub is the single screen every return user touches first once League Mode ships. It must answer "what should I do next?" in one glance regardless of season state. Routing.md lists the route; this doc owns the **content shown at that route**.

## Five hub states (canonical)

| #   | State                                              | Primary action                                                           | Secondary action                                                                                                   |
| --- | -------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| 1   | Zero seasons ever, **zero customTeams in library** | "Build your first team" → `/teams/new`                                   | "Start a Season" (autogen-only path) → `/leagues/new?mode=allAutogen`                                              |
| 2   | Zero seasons ever, has customTeams                 | "Start a Season" → `/leagues/new`                                        | "Manage teams" → `/teams`                                                                                          |
| 3   | One active season, zero historical                 | **"Continue: <season name> · day 12 / 30"** → `/leagues/:activeSeasonId` | "View teams" → `/teams`                                                                                            |
| 4   | One active + N historical                          | **"Continue: <season name> · day 12 / 30"** → `/leagues/:activeSeasonId` | "View past seasons" expands historical list                                                                        |
| 5   | Zero active + N historical (just finished)         | "Start a New Season" → `/leagues/new` (with carryover prompt in v4)      | "View champion: <team> won Spring 2026" → `/leagues/:lastSeasonId/awards` (v4) or `/leagues/:lastSeasonId` (v1–v3) |

State 3 / 4's "Continue" CTA is **the most important affordance in the entire hub** for return users. It must outrank every other CTA visually and is the screen's first focusable element.

## Home-screen integration (`/`)

After v1 ships, returning users with an active season should see a **"Continue"** affordance on the home screen _above_ the existing "Play Ball" exhibition CTA. Specifically:

- **No active season** → home screen unchanged (Play Ball is the primary CTA).
- **Has active season** → home screen renders a `<StatusBanner variant="info">` row at the top: _"Continue: <season name> · day 12 / 30"_ with a button linking to `/leagues/:activeSeasonId`. "Play Ball" remains as a secondary action.
- The `League teaser box` already documented in `docs/style-guide.md §8.6` may be repurposed as the container for this row, after `@ux-design-lead` signs off in `style-guide-additions.md`.

## `/saves` vs `/leagues` — mental model

These are **two distinct user flows** and the docs / nav must surface that:

| Surface    | What lives there                                                   | Naming guidance                              |
| ---------- | ------------------------------------------------------------------ | -------------------------------------------- |
| `/saves`   | Single-game **exhibition** save slots (resume mid-game; no league) | Nav label updates to **"Exhibitions"** in v1 |
| `/leagues` | Multi-game **season** records (active + historical)                | Nav label **"Leagues"**                      |

The home screen's "Continue" affordance always points to whichever is more recent (an active league always wins; otherwise the most recently played exhibition save). This avoids forcing the user to choose between two parallel "lists of stuff I saved" UIs to find their game.

`@user-save-curator` proxy interview is owed before v1 ships to validate this split (see `routing.md`'s back-affordance section for the matching navigation contract).

## Microcopy inventory (v1–v4)

| Surface / context                                   | String                                                                                                                                                        | Phase |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `/leagues` empty (state 1 — no teams)               | "Welcome to League Mode. Build a team to start your first season — or skip ahead with all-autogenerated teams."                                               | v1    |
| `/leagues` empty (state 2 — has teams)              | "You haven't started a season yet. Create one →"                                                                                                              | v1    |
| `/leagues` active (state 3 / 4) — primary CTA       | "Continue: {seasonName} · day {currentGameDay} / {totalGameDays}"                                                                                             | v1    |
| `/leagues` complete (state 5)                       | "Welcome back. Start a new season or revisit your champions."                                                                                                 | v1    |
| Active-season block in setup wizard Step 1          | "You already have an active season. Finish or abandon it before creating a new one."                                                                          | v1    |
| Active-season block — secondary actions             | "Continue current season" (primary) · "Abandon current season" (destructive)                                                                                  | v1    |
| Abandon-season confirmation modal                   | "Abandon '{seasonName}'? In-flight games are kept for reference but the season won't continue. This cannot be undone."                                        | v1    |
| Sprint preset caveat on wizard Step 1               | "In a Sprint season, your team plays each opponent only 1–2 times. Pick Standard for a fuller schedule (available in v2)."                                    | v1    |
| Auto-fill missing slots affordance                  | "Some teams are below the league-play minimum. Auto-fill the missing slots from autogen?" · button: "Auto-fill"                                               | v1    |
| Roster-edit lock banner (default)                   | "This team is in an active season. Trades, lineup changes, and IL moves happen on the season's team page. Edit will be available again when the season ends." | v1    |
| Roster-edit lock banner — deep link                 | "Open season team page →"                                                                                                                                     | v1    |
| Sim-to-next-user-game progress                      | "Simulating game {n} of {m}…" (with cancel option)                                                                                                            | v1    |
| `/leagues/:id/transactions` empty (early v2 season) | "No moves yet. IL events and trades will appear here as the season unfolds."                                                                                  | v2    |
| `/leagues/:id/playoffs` pre-playoff                 | "Playoffs begin after game {N}. Standings update each game-day."                                                                                              | v3    |
| `/leagues/:id/playoffs/:seriesId` pre-start         | "Series begins after the previous round completes."                                                                                                           | v3    |
| Trade deadline passed banner                        | "Trade deadline has passed. Rosters are locked until the off-season."                                                                                         | v3    |
| `/leagues/:id/awards` pre-completion                | "Awards are decided when the season ends."                                                                                                                    | v4    |
| RoY award with zero eligible rookies                | "No eligible rookies this season."                                                                                                                            | v4    |
| Carryover toggle on "Start New Season" wizard       | "Carry over from previous season — heals IL, resets fatigue, keeps rosters and league membership."                                                            | v4    |
| Sim-full-season progress                            | "Simulating season — game {n} of {m}." (with cancel option)                                                                                                   | v4    |
| Sim-full-season cancellation                        | "Cancel simulation? Completed games are kept; you can resume from game {n+1} later."                                                                          | v4    |

All copy uses American English (per decision #X5).

## ARIA & accessibility

- `/leagues` page: `<h1>Leagues</h1>` (sole h1 on the page); historical-seasons list uses an accessible accordion (`<details><summary>`) per `docs/style-guide.md §13`.
- "Continue" CTA: first focusable element on the page; `aria-describedby` references the season-progress text.
- Home-screen `<StatusBanner variant="info">` for "Continue" gets `role="status"` (informational, not urgent).
- Confirmation modals use `role="alertdialog"` with focus trapped; primary action is **not** the destructive one.
- Sprint caveat surfaces as `<p>` directly under the radio label (not a tooltip — discoverable without hover).

## Responsive behavior

- **Mobile (≤ 768 px):** card stack — "Continue" card at top, then "Start a Season" card, then collapsed "Past seasons" accordion.
- **Tablet / desktop (≥ 769 px):** two-column layout — left: "Continue" card spanning two rows; right: secondary actions stacked above the past-seasons list.
- Both viewports follow the existing `PageLayout` shell + `mq` helpers from `@shared/utils/mediaQueries`.

## Testing surface

- **E2E:** all five hub states render their canonical copy (snapshot-tested per state).
- **E2E:** "Continue" CTA from home screen routes correctly when an active season exists; reverts to Play Ball when none.
- **Visual:** mobile + desktop snapshots for states 1, 2, 3, 5 (state 4 = state 3 + visible past list, covered by state 3 + a separate past-list expand snapshot).
- **A11y:** axe-core pass on `/leagues` for each of the 5 states.

## Out of scope

Cross-season comparison (silenced in `decisions.md` "won't ship" register). Networked / shareable hub views (local-only app per `routing.md`).
