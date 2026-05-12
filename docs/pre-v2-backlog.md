# Pre-v2 Backlog

Tracks all items that must ship before League v2 work begins.

---

## Background

League v1 shipped with two open work streams now gating v2. **Block A** — the Game Session
Refactor — introduces `GameSessionContext` and splits the monolithic `/game` route into
dedicated exhibition and league routes; this epic is fully planned and spec'd. **Block B**
closes the three items explicitly deferred from League v1 (D-01 autogen dedup, D-02 hub
discoverability, D-03 roster lock UI). Both blocks must be merged and CI-green before any v2
feature work begins.

---

## Block A — Game Session Refactor

All three stories are fully spec'd. Implementation prompts are copy-paste ready.

| Artifact                     | Path                                                                                 | Purpose                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Epic README                  | `docs/game-session-refactor/README.md`                                               | Scope, sequencing gate, party-mode decision record                            |
| Architecture Decision Record | `docs/game-session-refactor/01-architecture-decision-record.md`                      | Winston's ADR — `GameSessionContext` interface, tree shape, BLOCK constraints |
| Route Split Design           | `docs/game-session-refactor/02-route-split-design.md`                                | New routes, navigation contract, migration path                               |
| PM Execution Board           | `_bmad-output/planning-artifacts/game-session-refactor/01-pm-execution-board.md`     | Sequenced story table, owners, ACs, Winston CR gate                           |
| Winston Arch Spec            | `_bmad-output/planning-artifacts/game-session-refactor/02-winston-arch-spec.md`      | `GameSessionContext` interface + provider tree shape                          |
| Amelia Dev Slice             | `_bmad-output/planning-artifacts/game-session-refactor/03-amelia-dev-slice.md`       | Per-story implementation checklist                                            |
| Implementation Prompts       | `_bmad-output/planning-artifacts/game-session-refactor/04-implementation-prompts.md` | Copy-paste prompts for Stories S1, S2, S3                                     |

**Story sequence (strictly sequential — no parallelism):**

| Story                                | Scope                                                        | Gate                          |
| ------------------------------------ | ------------------------------------------------------------ | ----------------------------- |
| S1 — Route Split                     | New `ExhibitionGamePage` + `LeagueGamePage` + router changes | Winston CR APPROVE            |
| S2 — `GameSessionContext` Extraction | Context + provider + `GameControls` + `GamePage`             | Winston CR APPROVE            |
| S3 — `GameInner` Cleanup             | Remove all if-checks from `GameInner`, deprecate fields      | Winston CR APPROVE + Full E2E |

**Block A is independent of Block B** — the file sets do not overlap. D-01/D-02/D-03 may begin
concurrently with Block A stories, subject to Winston's CR gate on D-01 (schema change).

---

## Block B — League v1 Deferred Items

Three items explicitly deferred from League v1. D-01 is fully spec'd with six party-mode
amendments. D-02 and D-03 are short polish items. All three are pre-v2 prerequisites.

| ID   | Title                                                                      | Status             | Winston CR                   | Implementation Prompt                                                                 |
| ---- | -------------------------------------------------------------------------- | ------------------ | ---------------------------- | ------------------------------------------------------------------------------------- |
| D-01 | Autogen team deduplication (fingerprint match + lock guard + schema index) | Ready to implement | **Required** (schema change) | `_bmad-output/planning-artifacts/league-v2-prep/01-d01-autogen-dedup-prompt.md`       |
| D-02 | SeasonTeamPage "View teams" discoverability from LeaguesHubPage            | Ready to implement | Not required                 | `_bmad-output/planning-artifacts/league-v2-prep/02-d02-hub-discoverability-prompt.md` |
| D-03 | Roster-edit lock UI indicator in ManageTeamsScreen                         | Ready to implement | Not required                 | `_bmad-output/planning-artifacts/league-v2-prep/03-d03-roster-lock-ui-prompt.md`      |

**Canonical spec:** All three items are specified in `docs/league-v1-followup/08-deferred-to-v2.md`.
D-01 includes six post-party-mode amendments (lock guard, compound index with `autogen.version`,
cross-season stat attribution decision, `resolveAutogenTeams` return type, 8 unit test cases, and
mode-switch notification clarification). The D-01 implementation prompt embeds these amendments
directly so the implementing agent needs no other file.

---

## Completion Criteria

- [ ] Block A: S1, S2, and S3 merged to `master` with green CI on all 7 Playwright device projects
- [ ] Block A: `GameInner` has zero direct reads of `ExhibitionGameSetup.disableSave/seasonGameId/managedTeam`
- [ ] Block A: `GameControls` has no `managerModeAllowed` prop
- [ ] Block A: `yarn check:circular-deps` passes; `dist/sw.js` precache covers new SPA routes
- [ ] Block A: Winston issued APPROVE for all three story PRs
- [ ] Block B: D-01 merged — no duplicate team names on second-season autogen, no RxDB DB6 error on upgrade
- [ ] Block B: D-02 merged — "View teams" from LeaguesHubPage navigates to correct target
- [ ] Block B: D-03 merged — locked team rows show 🔒; unlocked rows unchanged
- [ ] Block B: D-01 Winston CR APPROVE received before merge

Once all items above are ✅, v2 feature planning may begin.

---

> For League v2 feature planning artifacts, see `_bmad-output/planning-artifacts/` (TBD — created when v2 scope is finalized).
