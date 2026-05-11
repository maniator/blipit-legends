# 08 — Items Deferred to v2

Date: 2026-05-11
Source: party-mode roundtable (John 📋 + Winston 🏗️ + Amelia 💻 + Paige 📚)

This document captures known issues and small features that were explicitly discussed,
agreed upon, and **intentionally deferred** from League Mode v1 to the v2 sprint. Each
entry includes the bug/feature description, the agreed fix approach, any open UX copy
decisions, and sequencing notes — so the next implementing agent arrives with full
context and does not rediscover these through QA.

---

## D-01 — Duplicate autogen team names on seed reuse

### Status

Deferred to v2 (P1). Not a v1 blocker — no crash, no data loss, no save corruption.

### Bug description

When the League Setup Wizard runs in `allAutogen` or `mixed` mode and the user creates
a second season using the same autogen seed (or a seed that produces the same team
names), the wizard inserts new custom-team docs into RxDB whose `name` field collides
with an already-existing doc. The result is two teams with identical display names
appearing in the season standings table. No functional failure occurs downstream, but
the UX is confusing.

Screenshot evidence: `e2e/qa-artifacts/screenshots/BUG-duplicate-team-name.png`
(gitignored; captured during League v1 live QA pass on `copilot/league-v1-qa-follow-up`).

### Root cause

In `LeagueSetupWizard/handleCreate` (mixed-mode path, ~line 549), the wizard calls
`ctStore.createCustomTeam(...)` for each generated team without first checking whether
a team with the same autogen fingerprint already exists in the DB.

### Agreed fix approach

1. Before the insertion loop in `handleCreate`, fetch the existing teams snapshot once:
   `const allExisting = await ctStore.getAllTeams();`

2. For each generated team, check fingerprint equality before inserting:

   ```typescript
   const existing = allExisting.find(
     (t) =>
       t.autogen?.baseSeed === gen.autogen.baseSeed &&
       t.autogen?.theme === gen.autogen.theme &&
       t.autogen?.parity === gen.autogen.parity &&
       t.autogen?.version === gen.autogen.version,
   );
   if (existing) {
     allTeamIds.push(existing.id); // reuse existing doc, no insert
   } else {
     await ctStore.createCustomTeam({ ...gen }, { id: gen.id });
     allTeamIds.push(gen.id);
   }
   ```

3. Extract this lookup-and-reuse pattern to a **named helper function** —
   `resolveAutogenTeams(generated, allExisting)` — kept in the wizard's
   utils or in `autogen/`. It must be independently unit-testable with a mock store.

4. **Add a compound RxDB index** on `customTeams`: `["autogen.baseSeed", "autogen.theme", "autogen.parity"]`.
   This is a schema change — mandatory version bump and trivial `(oldDoc) => oldDoc`
   migration strategy required. See `docs/rxdb-persistence.md §Schema versioning &
migration` for the full procedure.

5. **Unit test coverage** — three cases:
   - All-new autogen: `createCustomTeam` called N times, all IDs fresh.
   - Partial dedup: called N−1 times; pre-existing ID appears in `allTeamIds`.
   - Full dedup: called zero times; reuse-notice flag is truthy.

### PRNG safety

No concern. `generateLeagueTeams` runs and consumes its PRNG before the DB lookup.
The existence check is async I/O only — it touches nothing in `rng.ts`. `reinitSeed`
has not been called yet at this point in the wizard flow.

### User-facing notification

Only surface a message when reuse **changes the user's effective mode** (e.g., they
chose `allAutogen` but one of the generated teams already exists as a pre-existing
custom team → the season effectively becomes `mixed`).

Suggested inline wizard copy (review step):

> **"[Team Name] already exists from a previous season and will be reused. Your league
> will include one custom team alongside your generated teams."**

Rules:

- Lead with the team name so the user can verify it is the right one.
- No jargon ("deduplication", "mixed mode"). State the practical effect plainly.
- One non-blocking `<p>` or info callout in the wizard review step — **not** a blocking
  modal. The user does not need to confirm; this is informational only.
- If reuse is fully silent (mode does not change), no message is needed.

Copy is not finalized — route to Sally (🎨 `bmad-agent-ux-designer`) for the wizard
review step visual treatment before implementing.

### Docs to update when implemented

- `docs/game-session-refactor/02-route-split-design.md` — add a note under the
  mixed-mode autogen section: "If an autogen team with matching `baseSeed + theme +
parity + version` already exists, it is reused rather than recreated."
- `docs/rxdb-persistence.md` — one sentence: "`autogen.baseSeed + theme + parity` is
  the deduplication key; consumers should query by this triple before inserting."
- `docs/league-v1-followup/07-done-vs-open-summary.md` — move this entry from Open to
  Done (update P1 section).

### Sequencing

1. Winston CR sign-off on schema version bump before Amelia picks up implementation.
2. Sally sign-off on inline copy and callout visual treatment.
3. Amelia implements `resolveAutogenTeams` helper + schema bump + unit tests.
4. `e2e-test-runner` adds a regression E2E test: create season, navigate away, create
   another season with the same seed — verify no duplicate team names in standings.

---

## D-02 — SeasonTeamPage "View teams" discoverability from hub

### Status

Deferred to v2 (P1 polish). Core page and route exist; entry point from hub is missing.

### Description

`SeasonTeamPage` is implemented and reachable from standings rows
(`SeasonHomePage/index.tsx:256-266`), but the "View teams" link on the `LeaguesHubPage`
still navigates to the global `/teams` route instead of the season-scoped team page.
This means users browsing from the hub can't reach per-season team stats without first
going through the standings table.

### Agreed fix

Update `LeaguesHubPage`'s "View teams" action to navigate to `/stats/:teamId` or the
season team page for the active season's user team.

### Docs to update when implemented

- `docs/architecture.md` — update the Route Structure table to note that the hub's
  "View teams" CTA routes to the season-scoped page, not `/teams`.

---

## D-03 — Roster-edit lock UI visibility in team management

### Status

Deferred to v2 (P1 polish). Storage-level lock exists; UI message is not visible.

### Description

`customTeamStore.ts:85-97` guards against editing teams that are locked to an active
season, and tests cover the guard. However, the Manage Teams list (`ManageTeamsScreen`)
does not render an explicit "This team is locked — active season in progress" message.
Users who try to edit a locked team get a silent failure or a generic error.

### Agreed fix

Add a visible lock indicator in the team list row (e.g., a 🔒 icon with tooltip or
inline copy) and surface a user-facing message if they attempt to enter the editor for
a locked team.

### Docs to update when implemented

- `docs/style-guide.md` — if a new lock-state pattern or icon is introduced, Sally must
  review and add it to the style guide before implementation.
