> This section covers UI reuse catalog, net-new components, style-guide-additions token requirements, and consolidated risk register. Part 5 of 6.

## UI Reuse Principles
- Reuse order: (1) existing component as-is; (2) generalize with small prop; (3) compose wrapper; (4) new build — only if 1–3 demonstrably wrong; document why in PR
- Every league UI PR must list reused vs net-new components

## Existing Components for League Reuse
- LineScore → completed-game detail panels in schedule, playoff series, transactions feed
- PlayerStatsPanel + PlayerDetails → season team page rows, trade UI player picker, awards winner card
- SubstitutionPanel → v2 RosterManagementPage lineup updates
- CareerStatsBattingTable / CareerStatsPitchingTable → v4 season leaders + season team stats tab
- CareerStatsSummaryPanel → awards screen top-3 winner cards
- CustomTeamEditor → season team page read-only mode (roster-edit lock; DnD disabled in lock state)
- SortablePlayerRow → v2 RosterManagementPage lineup builder
- CustomTeamMatchup → season schedule 'next game' CTA preview
- SaveSlotList → generalize to SeasonList by extracting common SlotList shell; used on /leagues hub
- SavesModal shell → league prompts (e.g., abandon-season confirm)
- PageLayout → every new league page
- mq helpers → always; never raw @media strings; dvh modal sizing (never vh)

## Net-New Components (keep list small)
- StatusPill (v1): fresh/tired/spent/il/auto/team variants; src/shared/components/StatusPill/; variant prop API
- StatusBanner (v1): info/warn/neutral variants; ARIA role=status (info/neutral), role=alert (warn) — confirm with Sally
- EmptyState (v1): icon 24×24px + title + body + CTA; used by LeaguesHubPage, TransactionsFeedPage, AwardsPage, PlayoffBracketPage
- ModalShell (v1): extracted from exhibition/styles.ts; header/scroll-body/sticky-footer; dvh-based sizing
- StandingsTable (v1): composes SortableTable extracted from CareerStats tables
- ScheduleDayList (v1): seasonGames rows; completed=LineScore, upcoming=CustomTeamMatchup
- LeagueSetupWizard (v1): ModalShell + form primitives; reducer pattern modeled on editorReducer
- PlayoffBracketAccordion (v3): mobile; native <details>; selected via mq.mobile
- PlayoffBracketTree (v3): desktop; horizontal tree + connector lines; pre-clear BracketConnector token with Sally

## Style-Guide Token Requirements (proposal — blocked on Sally sign-off before any visual snapshots)
- StatusPill: each variant needs (background, foreground, border) triplet meeting WCAG 2.2 AA against bgSurface (#0d1b2e)
- OPEN QUESTION: #ffd06b on #0d1b2e borderline AA at body sizes — verification owed before v1 visual snapshots baselined
- StatusBanner: pull from existing semantic color tokens; no new hex
- BracketConnector (v3): stroke=muted borderForm; weight 2px desktop; orthogonal joints; no bezier; desktop only

## Risk Register (summary)
- R1 (Medium/v4): RxDB collection-count budget — steady-state 12, peak 13; measure before v4 starts
- R2 (Critical/v1): Same-version schema edits brick users (DB6 hash) — every change bumps version + migrationStrategies; PR template checkbox
- R3 (High/v1): Per-game seed drift — single deriveScheduledGameSeed() helper; cached on seasonGames.derivedSeed
- R4 (High/v1): Global PRNG corruption from concurrent sim — sequential only; reinitSeed before every game
- R5 (High/v1): Idempotency — completion path keyed on seasonGameId; checks status==='completed' first
- R6 (High/v1): Roster-edit lock bypass — storage-layer write guard; route-level disabled-form is UX courtesy only
- R7 (Medium/v1): Autogen non-determinism — seeded PRNG; autogen.version stored; replay UI warns on mismatch
- R13 (Medium/v3): AI↔AI trade quality — symmetric need/surplus scoring; both sides must score positive; post-v3 audit via Buck
- R14 (High/v3): Trade engine partial write → orphaned roster — RxDB doc-version-checked writes; rollback on failure
- R17 (High/v4): Season archive corruption — archive round-trip unit-tested; seasons never archived (keeps awards queryable)
- R21 (High/v1): Service worker RxDB access — SW is window-only-RxDB-free; no league background work in SW
- High-severity risks cluster in v1 and v3; all mitigated by design; R1 most likely to bite in v4
