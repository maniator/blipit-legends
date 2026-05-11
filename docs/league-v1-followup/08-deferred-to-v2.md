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

> **Party-mode amendment (2026-05-11, Round 2):** Winston issued REQUEST_CHANGES on the original spec.
> Three amendments required before Amelia picks up implementation — see sections below.

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

### Amendment 1 — Lock guard interaction (Winston BLOCK)

The lock guard at `customTeamStore.ts:85-97` blocks edits to teams bound to an active season.
`handleCreate`'s dedup path must **not** silently bypass this guard. Required behavior:

- Before reusing a matched doc, check whether it is locked.
- If locked to a **different** active season (i.e., Season 1 is still in progress), fall through to
  a fresh insert rather than reuse. Two concurrently-running seasons may not share a team doc.
- If locked to **no** active season (Season 1 is completed/abandoned), reuse is safe.
- Document this rule explicitly in the `resolveAutogenTeams` function JSDoc.

### Amendment 2 — Add `autogen.version` to compound index (Winston)

The proposed index `["autogen.baseSeed", "autogen.theme", "autogen.parity"]` must be extended to
`["autogen.baseSeed", "autogen.theme", "autogen.parity", "autogen.version"]`. Without `version`, a
future algorithm revision (new `autogen.version`) would match old docs during the index scan and
require a post-filter to discard them — this is a performance trap and a future footgun. Including
`version` in the index ensures each algorithm revision naturally forces fresh inserts. Add this as a
single RxDB schema version bump (one migration) covering both the index and the autogen compound key.

### Amendment 3 — Cross-season stat attribution must be an explicit design decision (Winston + Amelia)

`gameHistory` records link to `customTeamId`. If Season 1 and Season 2 share the same team doc IDs
(via fingerprint dedup), career-stats pages will aggregate records from both seasons automatically.

**Decision:** This is intentional and correct. `customTeams` docs represent _team identity_, not
season-scoped snapshots. Multi-season stat aggregation via a shared `customTeamId` is the franchise
model (same team, multiple seasons). This is safe provided `gameHistory` records carry a `seasonId`
field that season-scoped views can use to filter.

**Pre-implementation gate:** Before Amelia picks up D-01, audit `gameHistoryStore` query paths to
confirm every season-scoped stats view filters by `seasonId`. If any cross-season aggregation view
is missing the filter, that view must be fixed first (separate story, no blocker to D-01 spec).

### Amendment 4 — `resolveAutogenTeams` return type (Amelia)

The return type must be:

```typescript
interface ResolveAutogenTeamsResult {
  teamIds: string[]; // final ordered list (positional — matches input `generated` order)
  insertedCount: number; // net-new docs written
  recycledCount: number; // matched existing docs reused
  modeChanged: boolean; // allAutogen → mixed due to detected managed-team overlap
}
```

The `teamIds` order must be stable and match the input `generated` array order — schedule generation
relies on positional assignment.

### Amendment 5 — Second-season unit test cases (Amelia + John)

In addition to the three test cases in the original spec, add:

```typescript
it("returns recycledCount === N and insertedCount === 0 when all N teams already exist");
// ^ The key regression gate for second-season reuse with same seed

it("teamIds order matches input `generated` order when all teams are recycled");
// ^ Protects schedule generation positional assignment

it("does not insert duplicate docs when called twice with same seed");
// ^ Integration-flavored: collection length unchanged after second call

it("recycledCount is 0 when a different seed produces different fingerprints");
// ^ Sanity: different seed = zero reuse, no false positives

it("falls through to fresh insert when matched doc is locked to a different active season");
// ^ Covers the lock guard interaction (Amendment 1)
```

### Amendment 6 — Mode-switch notification clarification (John)

The notification fires only when the user's effective mode changes from what they explicitly selected.
Rules:

- If user selected `allAutogen` and all generated teams are brand-new inserts → no notice.
- If user selected `allAutogen` and some/all generated teams are recycled from a previous season,
  but no managed team is involved → no notice (mode is still `allAutogen`; recycling is transparent).
- If user selected `allAutogen` but a recycled team happens to be a user's custom-managed team
  → notice fires ("Your league will include one custom team alongside your generated teams").
- If user selected `allAutogen` and **all** teams are recycled from a prior season → show one
  informational line: "Using your existing teams from a previous season." Non-blocking, review step only.

Update the wizard copy constants in `validateWizardState.ts` to add the "fully recycled" string.

### Additional acceptance criteria (cross-season scenario — John)

> **Given** an autogenned team doc was created in Season 1 and is now reused (by fingerprint match)
> for Season 2, **when** Season 2's slot assignments reference that team, **then** the team doc's
> base roster and attributes are unchanged from its original autogenned state — no Season 1
> mutations bleed onto the shared doc.

> **Given** the same `baseSeed + theme + parity + version` fingerprint is used across multiple
> seasons, **when** each season is viewed independently, **then** each season's standings, stats,
> and schedule reference their own season records — never the other season's data.

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
