# League Mode — UI Reuse

> Companion to [`README.md`](README.md). **First-class principle: reuse existing UI components and styled-components patterns wherever possible.** Every league screen below is described in terms of the existing components it composes, with new components introduced only when no existing surface fits. This keeps visual language consistent, shrinks the v1–v4 implementation surface, and keeps the visual snapshot baseline manageable.

## Reuse-first principle

When designing or implementing a league screen, the order of preference is:

1. **Reuse the existing component as-is.** Pass new data through its existing props.
2. **Generalize an existing component** by adding a small prop (variant, optional callback, optional render slot). Update its `data-testid` if the role changes.
3. **Compose a new wrapper** around existing components.
4. **Build a new component** — but only after steps 1–3 are demonstrably wrong. Document why in the PR.

Every PR adding a league UI screen lists which existing components it reused and which (if any) are net-new.

## Existing components catalog

The following live in `src/` today and are first-class candidates for reuse in league UIs.

### Game presentation

| Component                                                     | Where it lives                                        | What it does today                              | League reuse                                                                                                            |
| ------------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `LineScore`                                                   | `src/features/gameplay/components/LineScore/`         | Inning-by-inning line score for the active game | Drop-in for **completed-game detail panels** in season schedule, playoff series detail, transactions feed (game links). |
| `Diamond`                                                     | `src/features/gameplay/components/Diamond/`           | Visual base/runner state                        | Reuse on watch-mode in-game UI; not needed elsewhere in v1.                                                             |
| `Ball`                                                        | `src/features/gameplay/components/Ball/`              | Pitch-result animation                          | Watch-mode only. No league reuse.                                                                                       |
| `HitLog`                                                      | `src/features/gameplay/components/HitLog/`            | Play-by-play log                                | Reuse in playoff series detail and any "view this game" modal in the season schedule.                                   |
| `Announcements`                                               | `src/features/gameplay/components/Announcements/`     | Speech-gated game announcements                 | Watch-mode only. No league reuse.                                                                                       |
| `PlayerStatsPanel` + `PlayerDetails`                          | `src/features/gameplay/components/PlayerStatsPanel/`  | Single-player stat card                         | Reuse on **season team page** (per-player rows), trade UI (player picker rows), awards screen (winner card).            |
| `SubstitutionPanel`                                           | `src/features/gameplay/components/SubstitutionPanel/` | In-game lineup swap UI                          | Reuse for **in-season lineup updates** on the v2 RosterManagementPage. Generalize prop name `onSubstitute` if needed.   |
| `DecisionPanel`                                               | `src/features/gameplay/components/DecisionPanel/`     | Manager-mode prompt (steal, bunt, etc.)         | Reuse for **trade-offer prompts** in v3 (same modal shell, different content slots).                                    |
| `TeamTabBar`                                                  | `src/features/gameplay/components/TeamTabBar/`        | Home/away team tab switcher                     | Reuse on season team page when switching between sub-views (lineup / rotation / IL).                                    |
| `GameControls` (incl. lazy `InstructionsModal`, `SavesModal`) | `src/features/gameplay/components/GameControls/`      | Game-screen control surface                     | Watch-mode only when entered from league context — already works as-is via `seasonGameId` query param.                  |

### Career stats

| Component                  | Where                                  | Today                         | League reuse                                                                                      |
| -------------------------- | -------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------- |
| `CareerStatsBattingTable`  | `src/features/careerStats/components/` | Sortable batting stats table  | Reuse on **season leaders** (v4) and **season team page** stats tab. Pass season-scoped data set. |
| `CareerStatsPitchingTable` | `src/features/careerStats/components/` | Sortable pitching stats table | Same — reuse for season-scoped pitching leaders / team rotation stats.                            |
| `CareerStatsSummaryPanel`  | `src/features/careerStats/components/` | Aggregate stat summary        | Reuse for **awards screen** winner cards (top-3 finishers list).                                  |

### Custom team / setup primitives

| Component                   | Where                                                   | Today                                                          | League reuse                                                                                                                              |
| --------------------------- | ------------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `CustomTeamEditor`          | `src/features/customTeams/components/CustomTeamEditor/` | Full team editor with drag-and-drop (`@dnd-kit`)               | Reuse **read-only mode** on the season team page (existing form disabled per roster-edit lock contract). Keep DnD disabled in lock state. |
| `SortablePlayerRow`         | `CustomTeamEditor/SortablePlayerRow.tsx`                | Drag-and-drop player row                                       | Reuse on v2 RosterManagementPage (lineup builder). DnD enabled because writes go through sanctioned path.                                 |
| `useImportCustomTeams` hook | `src/features/customTeams/hooks/`                       | File / paste / clipboard JSON import w/ duplicate-confirm flow | Reuse to **import an entire league** in setup wizard "Import league JSON" advanced action (deferred to v4).                               |
| `CustomTeamMatchup`         | `src/features/exhibition/components/`                   | Two-team matchup preview for exhibition                        | Reuse on **season schedule "next game" CTA** to preview today's user-team matchup.                                                        |
| `StarterPitcherSelector`    | `src/features/exhibition/components/`                   | Starter selection                                              | Reuse on watch-mode entry from season; the existing component already encapsulates the rotation pick UI.                                  |

### Saves & navigation

| Component                           | Where                                          | Today                                  | League reuse                                                                                        |
| ----------------------------------- | ---------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `SaveSlotList`                      | `src/features/saves/components/SaveSlotList/`  | Saved-game list w/ load/delete actions | **Generalize** to a `SeasonList` by extracting a common `<SlotList>` shell. Used on `/leagues` hub. |
| `SavesModal` (existing modal shell) | `src/features/saves/components/SavesModal/`    | Modal containing SaveSlotList          | Use the modal shell for any league prompts (e.g., abandon-season confirm).                          |
| `AppShell`, `RootLayout`            | `src/features/gameplay/components/`            | App chrome                             | All league routes nest under the existing AppShell.                                                 |
| `HomeScreen`                        | `src/features/gameplay/components/HomeScreen/` | Top-level home                         | Add a "Start a Season" CTA (decision in [`setup-wizard.md`](setup-wizard.md)).                      |

### Shared primitives

| Component           | Where                                      | Today                                       | League reuse                                                                     |
| ------------------- | ------------------------------------------ | ------------------------------------------- | -------------------------------------------------------------------------------- |
| `PageLayout`        | `src/shared/components/PageLayout/`        | Standard page chrome (header, content slot) | Use for **every** new league page.                                               |
| `FixedBottomBanner` | `src/shared/components/FixedBottomBanner/` | Persistent footer banner                    | Reuse for "Trade deadline in 5 days" or "Season complete" banners on league hub. |
| `UpdateBanner`      | `src/shared/components/UpdateBanner/`      | PWA update prompt                           | No league reuse; mentioned for completeness.                                     |

### Styled-components & tokens

| Pattern / token                                    | Where                                                        | Reuse                                                                                                                                                               |
| -------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mq` breakpoint helpers                            | `src/shared/utils/mediaQueries.ts`                           | **Always** use for league responsive styles. Never write raw `@media` strings.                                                                                      |
| Pill / badge styling (e.g., `ManagerModeControls`) | `src/features/gameplay/components/GameControls/styles.ts`    | Pattern source for the **fatigue badge** (🟢/🟡/🔴) and **IL badge** (🚑). Extract a shared `<StatusPill>` styled component to `src/shared/components/StatusPill/`. |
| Color palette, typography, button variants         | `docs/style-guide.md`                                        | **Single source of truth.** Every league UI must use existing tokens. New colors require a style-guide update first.                                                |
| `dvh`-based modal `max-height`                     | `src/features/exhibition/components/NewGameDialog/styles.ts` | Reuse for league setup wizard modal sizing — don't use `vh`.                                                                                                        |

## Net-new components catalog

Where reuse genuinely doesn't fit, these are the new components introduced. Keep this list small.

| Component              | Phase | Built from                                                                                                                                                                                               |
| ---------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `StatusPill`           | v1    | Extracted shared component for `🟢 Fresh` / `🟡 Tired` / `🔴 Spent` (and v2 `🚑 IL`) badges. Single component, variant prop.                                                                             |
| `StandingsTable`       | v1    | Composes `<table>` with the same column-header / sortable conventions as `CareerStatsBattingTable`. Consider extracting a shared `<SortableTable>` if a third sortable table appears in the same PR set. |
| `ScheduleDayList`      | v1    | List of `seasonGames` rows; each row composes `LineScore` for completed games and `CustomTeamMatchup` for upcoming.                                                                                      |
| `LeagueSetupWizard`    | v1    | Uses existing modal shell + form primitives; reducer pattern modeled on `CustomTeamEditor`'s `editorReducer`.                                                                                            |
| `AutogenPanel`         | v1    | Composed inside `LeagueSetupWizard`. Reuses `StatusPill` for theme/parity selectors styling.                                                                                                             |
| `SeasonHomePage`       | v1    | Composes `StandingsTable`, `ScheduleDayList`, `CustomTeamMatchup` (next-game CTA).                                                                                                                       |
| `RosterManagementPage` | v2    | Composes `SortablePlayerRow`, `SubstitutionPanel`, `PlayerStatsPanel`. No new dnd-kit setup needed.                                                                                                      |
| `TransactionsFeedPage` | v2/v3 | Generic chronological feed list. Single new list component; rows compose existing player/team avatars.                                                                                                   |
| `TradeCenterPage`      | v3    | Composes `PlayerStatsPanel` + `DecisionPanel` modal shell.                                                                                                                                               |
| `PlayoffBracket`       | v3    | New component; vertical-accordion / horizontal-tree layout switch via `mq`.                                                                                                                              |
| `AwardsPage`           | v4    | Composes `CareerStatsSummaryPanel` for winner cards + `CareerStatsBattingTable`/`CareerStatsPitchingTable` for top-3.                                                                                    |
| `LeadersPage`          | v4    | Pure reuse — `CareerStatsBattingTable` + `CareerStatsPitchingTable` with season-scoped data.                                                                                                             |

## Generalization candidates

When implementing the components above, expect to lift these out of single-feature folders:

- **`<SortableTable>`** — both `CareerStatsBattingTable` and `CareerStatsPitchingTable` carry similar sort logic. The new `StandingsTable` in v1 makes this the third use site → extract.
- **`<SlotList>`** — `SaveSlotList` and the new `SeasonList` (v1) share the same shape. Extract on the v1 PR that adds the league hub.
- **`<StatusPill>`** — already noted; extract in v1.
- **Modal shell** — there is no shared "Dialog" primitive yet; `SavesModal`, `InstructionsModal`, `DecisionPanel`, and `NewGameDialog` each style their own `<dialog>`. Don't extract for v1 league work (out of scope), but reuse the closest existing shell verbatim instead of re-implementing.

## Per-screen reuse map (quick reference)

| New screen                     | Primary reused components                                                           |
| ------------------------------ | ----------------------------------------------------------------------------------- |
| `LeaguesHubPage`               | `PageLayout`, `<SlotList>`/`SaveSlotList` shape, `FixedBottomBanner`                |
| `LeagueSetupWizard`            | `NewGameDialog` modal shell, existing form primitives, `StatusPill` (autogen knobs) |
| `SeasonHomePage`               | `PageLayout`, `StandingsTable`, `ScheduleDayList`, `CustomTeamMatchup`              |
| `SeasonSchedulePage`           | `PageLayout`, `ScheduleDayList`, `LineScore` (completed games inline)               |
| `SeasonTeamPage`               | `PageLayout`, `CustomTeamEditor` (read-only), `StatusPill`, `PlayerStatsPanel`      |
| `RosterManagementPage` (v2)    | `SortablePlayerRow`, `SubstitutionPanel`, `PlayerStatsPanel`, `StatusPill`          |
| `InjuryReportPage` (v2)        | `PageLayout`, `<SortableTable>`, `StatusPill` (IL variant)                          |
| `TransactionsFeedPage` (v2/v3) | `PageLayout`, generic feed list                                                     |
| `TradeCenterPage` (v3)         | `PlayerStatsPanel`, `DecisionPanel` shell                                           |
| `PlayoffBracketPage` (v3)      | `PageLayout`, new `PlayoffBracket`, `LineScore` (per-game inline)                   |
| `AwardsPage` (v4)              | `CareerStatsSummaryPanel`, `CareerStatsBattingTable`/`CareerStatsPitchingTable`     |
| `LeadersPage` (v4)             | `CareerStatsBattingTable`, `CareerStatsPitchingTable`                               |

## Out-of-scope: visual redesigns

League Mode does **not** introduce new colors, typography scales, or button variants. Every visual decision defers to [`docs/style-guide.md`](../style-guide.md). If a league screen seems to need a new visual token, raise that as a separate style-guide PR before adding the league UI.

## Testing reuse

- Reuse extends to **visual snapshots**: when a league screen embeds an existing component (`LineScore`, `PlayerStatsPanel`, etc.), do not re-snapshot the inner component as a separate baseline. The existing component's snapshot covers it.
- New screens get exactly **one mobile + one desktop** visual snapshot per state worth capturing.
- Use the `@ui-visual-snapshot` agent for baseline regeneration — never run snapshot updates outside the Playwright Docker container.
