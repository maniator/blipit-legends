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

| Pattern / token                            | Where                                                     | Reuse                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------ | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mq` breakpoint helpers                    | `src/shared/utils/mediaQueries.ts`                        | **Always** use for league responsive styles. Never write raw `@media` strings.                                                                                                                                                                                                                                 |
| Pill / badge styling (e.g., `NotifBadge`)  | `src/features/gameplay/components/GameControls/styles.ts` | Pattern source for the **fatigue badge** (🟢/🟡/🔴) and **IL badge** (🚑). Extract a shared `<StatusPill>` styled component to `src/shared/components/StatusPill/`. Pill colors must map to existing semantic tokens in [`docs/style-guide.md`](../style-guide.md); new colors require a style-guide PR first. |
| Color palette, typography, button variants | `docs/style-guide.md`                                     | **Single source of truth.** Every league UI must use existing tokens. New colors require a style-guide update first.                                                                                                                                                                                           |
| `dvh`-based modal `max-height`             | `src/features/exhibition/styles.ts`                       | Reuse for league setup wizard modal sizing — `max-height: min(90dvh, 820px)` desktop / `min(96dvh, 820px)` mobile. Never use `vh`.                                                                                                                                                                             |

## Net-new components catalog

Where reuse genuinely doesn't fit, these are the new components introduced. Keep this list small.

| Component                                    | Phase | Built from                                                                                                                                                                                                                   |
| -------------------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `StatusPill`                                 | v1    | Extracted shared component for `🟢 Fresh` / `🟡 Tired` / `🔴 Spent` (and v2 `🚑 IL`) badges. Single component, variant prop. Pill colors must map to existing semantic tokens in [`docs/style-guide.md`](../style-guide.md). |
| `StatusBanner`                               | v1    | Shared inline-banner component (title + body + optional CTA). Used by the **roster-edit lock banner** on `/teams/:id/edit` and `SeasonTeamPage`, plus "trade deadline passed" / "season abandoned" surfaces in v3+.          |
| `EmptyState`                                 | v1    | Icon + title + body + CTA. Used by `LeaguesHubPage`, `TransactionsFeedPage`, `InjuryReportPage`, `AwardsPage` (pre-completion), `PlayoffBracketPage` (pre-playoffs).                                                         |
| `ModalShell`                                 | v1    | Extracted modal primitive (header / scroll body / sticky footer; `dvh`-based sizing) from `src/features/exhibition/styles.ts` + `InstructionsModal/styles.ts`. Consumed by `LeagueSetupWizard` and onward.                   |
| `StandingsTable`                             | v1    | Composes `<SortableTable>` (extracted from `CareerStatsBattingTable` / `CareerStatsPitchingTable`).                                                                                                                          |
| `ScheduleDayList`                            | v1    | List of `seasonGames` rows; each row composes `LineScore` for completed games and `CustomTeamMatchup` for upcoming.                                                                                                          |
| `LeagueSetupWizard`                          | v1    | Uses `<ModalShell>` + form primitives; reducer pattern modeled on `CustomTeamEditor`'s `editorReducer`.                                                                                                                      |
| `AutogenPanel`                               | v1    | Composed inside `LeagueSetupWizard`. Reuses `StatusPill` for theme/parity selectors styling.                                                                                                                                 |
| `SeasonHomePage`                             | v1    | Composes `StandingsTable`, `ScheduleDayList`, `CustomTeamMatchup` (next-game CTA).                                                                                                                                           |
| `SeasonContextProvider` / `useSeasonContext` | v1    | Non-visual; rehydrates the season + leagues + seasonTeams subset for any league sub-route. Consumed by every league page.                                                                                                    |
| `RosterManagementPage`                       | v2    | Composes the **decoupled** `SortablePlayerRow` (extracted in v1; see Generalization candidates), `SubstitutionPanel`, `PlayerStatsPanel`. No new dnd-kit setup.                                                              |
| `TradeProposalDialog`                        | v3    | Discrete modal composed of `<ModalShell>` + `PlayerStatsPanel` rows + Accept/Reject affordances modeled on `DecisionPanel`. Not folded into `TradeCenterPage`.                                                               |
| `TradeCenterPage`                            | v3    | Composes `PlayerStatsPanel` (compact-row variant) + `TradeProposalDialog`.                                                                                                                                                   |
| `PlayoffBracketAccordion`                    | v3    | Mobile bracket — vertical accordion using native `<details>`. Selected via `${mq.mobile}`.                                                                                                                                   |
| `PlayoffBracketTree`                         | v3    | Tablet/desktop bracket — horizontal tree with connector lines (new visual token; pre-clear with `@ux-design-lead` per [`docs/style-guide.md`](../style-guide.md)). Selected via `${mq.notMobile}`.                           |
| `PlayoffBracket`                             | v3    | Outer switcher container that renders the appropriate bracket variant per viewport.                                                                                                                                          |
| `PlayoffSeriesPage`                          | v3    | Series-level scaffolding (best-of-N progress, "Game N starts in…"). Per-game expansion reuses `LineScore` + `HitLog`.                                                                                                        |
| `AwardsPage`                                 | v4    | Composes `CareerStatsSummaryPanel` for winner cards + `CareerStatsBattingTable`/`CareerStatsPitchingTable` for top-3 finishers.                                                                                              |

**Reclassified as compositions, not net-new components:**

- `LeadersPage` — `PageLayout` + `CareerStatsBattingTable` + `CareerStatsPitchingTable` with season-scoped data. Zero net-new visual surface.
- `TransactionsFeedPage` — once `<SlotList>` is extracted (v1), this is a `<SlotList>` consumer.
- `SeasonHistoryPage` — `PageLayout` + reuse of `StandingsTable` / `AwardsPage` views with archived data.
- `InjuryReportPage` — `PageLayout` + `<SortableTable>` + `StatusPill` (IL variant). Composition.

## Generalization candidates

When implementing the components above, expect to lift these out of single-feature folders:

- **`<SortableTable>`** — both `CareerStatsBattingTable` and `CareerStatsPitchingTable` carry similar sort logic. The new `StandingsTable` in v1 makes this the third use site → extract.
- **`<SlotList>`** — `SaveSlotList` and the new `SeasonList` (v1) share the same shape. Extract on the v1 PR that adds the league hub.
- **`<StatusPill>`** — already noted; extract in v1.
- **Modal shell** — there is no shared "Dialog" primitive yet; `SavesModal`, `InstructionsModal`, `DecisionPanel`, and the exhibition setup modal each style their own `<dialog>`. **Recommended for v1:** extract a `<ModalShell>` primitive (header bar, scroll body, sticky footer, `max-height: min(90dvh, 820px)` desktop / `min(96dvh, 820px)` mobile) from `src/features/exhibition/styles.ts` and `InstructionsModal/styles.ts`. The `LeagueSetupWizard` is a modal-on-route and will drift visually if it inlines its own shell rather than borrowing the existing pattern.
- **`<SortablePlayerRow>` decoupled from editor reducer** — the existing row in `CustomTeamEditor/SortablePlayerRow.tsx` is bound to `editorReducer` and `useEditorDragHandlers`. Extract a presentational row + a hook layer in v1 so the v2 `RosterManagementPage` can reuse it without forking.
- **`<EmptyState>`** — used today implicitly in `SaveSlotList`; will recur on the leagues hub, transactions feed, injury report, awards (pre-completion), and bracket (pre-playoffs). Extract in v1.

## Per-screen reuse map (quick reference)

| New screen                     | Primary reused components                                                                                      |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `LeaguesHubPage`               | `PageLayout`, `<SlotList>`/`SaveSlotList` shape, `FixedBottomBanner`                                           |
| `LeagueSetupWizard`            | `<ModalShell>` (extracted from exhibition modal in v1), existing form primitives, `StatusPill` (autogen knobs) |
| `SeasonHomePage`               | `PageLayout`, `StandingsTable`, `ScheduleDayList`, `CustomTeamMatchup`                                         |
| `SeasonSchedulePage`           | `PageLayout`, `ScheduleDayList`, `LineScore` (completed games inline)                                          |
| `SeasonTeamPage`               | `PageLayout`, `CustomTeamEditor` (read-only), `StatusPill`, `PlayerStatsPanel`                                 |
| `RosterManagementPage` (v2)    | `SortablePlayerRow`, `SubstitutionPanel`, `PlayerStatsPanel`, `StatusPill`                                     |
| `InjuryReportPage` (v2)        | `PageLayout`, `<SortableTable>`, `StatusPill` (IL variant)                                                     |
| `TransactionsFeedPage` (v2/v3) | `PageLayout`, generic feed list                                                                                |
| `TradeCenterPage` (v3)         | `PlayerStatsPanel`, `DecisionPanel` shell                                                                      |
| `PlayoffBracketPage` (v3)      | `PageLayout`, new `PlayoffBracket`, `LineScore` (per-game inline)                                              |
| `AwardsPage` (v4)              | `CareerStatsSummaryPanel`, `CareerStatsBattingTable`/`CareerStatsPitchingTable`                                |
| `LeadersPage` (v4)             | `CareerStatsBattingTable`, `CareerStatsPitchingTable`                                                          |

## Out-of-scope: visual redesigns

League Mode does **not** introduce new colors, typography scales, or button variants. Every visual decision defers to [`docs/style-guide.md`](../style-guide.md). If a league screen seems to need a new visual token, raise that as a separate style-guide PR before adding the league UI.

## Testing reuse

- Reuse extends to **visual snapshots**: when a league screen embeds an existing component (`LineScore`, `PlayerStatsPanel`, etc.), do not re-snapshot the inner component as a separate baseline. The existing component's snapshot covers it.
- **Snapshot baseline convention** (matches existing repo practice in `e2e/tests/visual/*.spec.ts-snapshots/`):
  - **Top-level league pages** get baselines on **all 6 device projects** (`desktop`, `tablet`, `iphone-15-pro-max`, `iphone-15`, `pixel-7`, `pixel-5`) — same as `home-screen-*` and `instructions-modal-*` today. Trim only when two close phone projects render visually identically.
  - **Embedded sub-components** (e.g. `<StatusPill>`, `<StandingsTable>` excerpts inside a larger page snapshot) get **1 mobile + 1 desktop** baseline.
  - **State variants** that need their own baseline at minimum: empty (no seasons / no IL / no awards), locked (Custom Team Editor in lock mode), trade-deadline-passed (TradeCenterPage read-only), pre-playoffs (PlayoffBracketPage during regular season), standings ties (StandingsTable with tiebreaker badges), wizard validation error (each step's error chrome).
- **Container parity for baseline regeneration is a hard repo invariant.** Visual snapshot baselines are regenerated **only inside `mcr.microsoft.com/playwright:v1.58.2-noble`** via the `update-visual-snapshots` workflow or the `@e2e-test-runner` agent. Never via host-OS `yarn test:e2e:update-snapshots`. This applies to every league screen across v1–v4.
- Estimated total new baseline PNGs across v1–v4: ~100 (v1: ~36, v2: ~22, v3: ~24, v4: ~20). Plan CI/storage budget accordingly.
