# League Mode — Plan & Reference

> **Status:** planning. No League-Mode code has shipped yet. These docs are the single source of truth for what we will build, in what order, and under what contracts. They replace every previous `docs/league-mode/*.md` file (those drafts are intentionally gone — do not resurrect them without updating this index).

League Mode adds **multi-team leagues, full seasons, and playoffs** on top of the existing exhibition simulator. It is delivered in five versions, **v0 through v4**, where v0 is _this docs rewrite_ and v1 is the first shippable code.

## Document map

| Doc                                                  | What it covers                                                                                                                   |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| [`roadmap.md`](roadmap.md)                           | Full **v0 → v4** phase plan, what each version ships, what each version explicitly defers                                        |
| [`decisions.md`](decisions.md)                       | Every locked design decision (presets, fatigue knobs, autogen behavior, etc.) with rationale and the question that drove it      |
| [`data-model.md`](data-model.md)                     | RxDB collections, schemas, the "all teams live in `customTeams`" contract, autogen markers, season state                         |
| [`setup-wizard.md`](setup-wizard.md)                 | League creation flow, step-by-step UX, validations                                                                               |
| [`team-autogeneration.md`](team-autogeneration.md)   | Autogen modes, naming themes, parity slider, generator algorithm, determinism contract                                           |
| [`schedule-and-sim.md`](schedule-and-sim.md)         | Round-robin schedule generation, per-game seed derivation, headless sim, "sim to next user game" loop                            |
| [`fatigue-and-injuries.md`](fatigue-and-injuries.md) | v1 pitcher fatigue, v2 position-player wear & injury system, modifier injection contract                                         |
| [`playoffs-and-trades.md`](playoffs-and-trades.md)   | v3 scope: playoff bracket (WC/LCS/BCS), trade engine, AI trade behavior                                                          |
| [`awards-and-archive.md`](awards-and-archive.md)     | v4 scope: composite award formulas, season archival policy, optional offseason carryover                                         |
| [`routing.md`](routing.md)                           | New routes added per phase, league-context handoff rules                                                                         |
| [`ui-reuse.md`](ui-reuse.md)                         | Component reuse catalog — what existing UI to reuse on every league screen, generalization candidates, net-new components budget |
| [`risks.md`](risks.md)                               | Consolidated risk register across v1–v4                                                                                          |

## Headline scope (locked)

| Topic              | v1                                                                                                                                                    | v2                                        | v3                                                       | v4                                                                                               |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| League sizes       | Mini (8)                                                                                                                                              | + Standard (16)                           | —                                                        | + Full (24)                                                                                      |
| Season length      | Sprint (30)                                                                                                                                           | + Standard (60)                           | —                                                        | + Marathon (120)                                                                                 |
| Schedule           | Round-robin                                                                                                                                           | Round-robin + interleague                 | Reseeding playoffs                                       | "Sim full season" mode + progress bar                                                            |
| Manager Mode       | User team only                                                                                                                                        | (unchanged)                               | (unchanged)                                              | Optional "manage all teams"                                                                      |
| Fatigue            | **Pitcher arm fatigue** + UI badge                                                                                                                    | + Position-player wear (~5% knob)         | Playoff fatigue rules (full fatigue, ×0.25 injury rate)  | (unchanged)                                                                                      |
| Injuries / IL      | —                                                                                                                                                     | 0.4% per player-game + IL + bench fill-in | Playoff injury rate ×0.25                                | Optional minor-league call-ups                                                                   |
| Trades             | —                                                                                                                                                     | —                                         | Manual + AI trades, deadline (default 70%, configurable) | (unchanged)                                                                                      |
| Playoffs           | —                                                                                                                                                     | —                                         | 4 teams/league, WC bo3 / LCS bo5 / BCS bo7 (presets)     | (unchanged)                                                                                      |
| Awards             | —                                                                                                                                                     | —                                         | —                                                        | MVP / Cy Young composites + leaders screen                                                       |
| Team library       | All teams (built-in, custom, autogen) live in the **single `customTeams` collection** — no separate "league teams" collection. Same in every version. |
| Autogeneration     | All four naming themes, parity slider, **Mixed** default                                                                                              | (unchanged)                               | (unchanged)                                              | (unchanged)                                                                                      |
| Concurrent seasons | One active season at any time. Setup wizard refuses to start a new one until current is `complete` or explicitly abandoned.                           |
| Replay & sharing   | Test-only seed determinism                                                                                                                            | (unchanged)                               | (unchanged)                                              | "Replay season" + "shareable seed" UI behind `featureFlags.shareableSeasonSeeds` / `allowReplay` |

## Non-negotiable contracts

These hold for every version and override anything that conflicts in a sub-doc.

- **One team library.** All teams — built-in, user-created, autogenerated for a league — are stored in the existing `customTeams` collection. There is no separate "league teams" collection or alternate team type. League state references teams by `customTeamId`.
- **Roster-edit lock for in-season teams.** A `customTeams` doc whose `id` is referenced by any season with `status === 'active'` is **read-only via the Custom Team Editor**. Mutations are only allowed via the season's sanctioned paths: in-season trades, IL moves (v2+), call-ups (v4+), and lineup/rotation changes inside the season UI. Editing becomes available again as soon as the season transitions to `complete` or `abandoned`. This is enforced at the storage layer (write guard), not just the UI.
- **UI reuse first.** League Mode does not introduce new visual language. Every new screen reuses existing components (`LineScore`, `PlayerStatsPanel`, `CareerStatsBattingTable`, `SortablePlayerRow`, `CustomTeamMatchup`, modal shells, etc.) before composing wrappers, and never builds a net-new component when reuse or generalization fits. The catalog and per-screen reuse map live in [`ui-reuse.md`](ui-reuse.md). New colors/typography/button variants are out of scope — every visual decision defers to [`docs/style-guide.md`](../style-guide.md).
- **Seed contract.** Per-game RNG seeds are derived deterministically: `fnv1a(\`${leagueSeasonId}:${scheduledGameId}\`) → uint32 → base-36`. Never pass raw colon-joined strings into `reinitSeed`. Helper: `deriveScheduledGameSeed()`in`src/features/leagueMode/utils/`.
- **Game ownership.** Each scheduled game resolves to exactly one completed game record. No duplicate writes from both gameplay and schedule layers; idempotent retries are required.
- **League membership lifecycle.** A team's `activeLeagueId` stays set across season rollovers until the team is explicitly removed from the league. Carryover is opt-in (v4).
- **Schema evolution.** Every change to a league/season schema bumps `version` and ships a migration strategy per [`docs/rxdb-persistence.md`](../rxdb-persistence.md). Same-version schema changes are forbidden — they cause a DB6 hash mismatch and brick existing users.
- **Single active season.** Storage allows historical season records, but the setup wizard refuses to create a new season while one is `active`.
- **Determinism boundary.** All league-affecting randomness (schedule, autogen, AI trades, injury rolls, fatigue ticks) flows through `src/shared/utils/rng.ts` seeded from the season master seed. No `Math.random()` anywhere in league code.
- **Feature-flag snapshot.** When a season starts, the active feature flags are snapshotted onto the season record. Flipping a flag mid-season does not change in-flight behavior.

## Where to start reading

If you are…

- **Implementing v1:** start with [`roadmap.md`](roadmap.md) → [`data-model.md`](data-model.md) → [`setup-wizard.md`](setup-wizard.md) → [`team-autogeneration.md`](team-autogeneration.md) → [`schedule-and-sim.md`](schedule-and-sim.md) → [`fatigue-and-injuries.md`](fatigue-and-injuries.md) (v1 pitcher section only). **Read [`ui-reuse.md`](ui-reuse.md) before implementing any screen.**
- **Reviewing scope:** [`roadmap.md`](roadmap.md) and [`decisions.md`](decisions.md) together cover what is in / out of every version.
- **Auditing risk:** [`risks.md`](risks.md).
- **Designing UX for a later phase:** the corresponding phase doc (e.g. `playoffs-and-trades.md`) plus [`decisions.md`](decisions.md) for the locked behaviors.
