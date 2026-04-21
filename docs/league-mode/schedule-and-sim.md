# League Mode — Schedule & Simulation

> Companion to [`README.md`](README.md). Defines deterministic schedule generation, per-game seed derivation, and the headless "sim to next user game" loop.

## Goals

1. **Determinism.** Same `(masterSeed, teamIds, gamesPerTeam, seriesLength, divisionConfig)` → identical schedule. Same per-game seed → identical box score.
2. **Series-based regular season.** Default series length 3, configurable 2 / 3 / 4.
3. **Reasonable balance.** Each team plays each opponent a similar number of times; home/away assignments balanced.
4. **No double-bookings.** A team never appears in two games on the same `gameDay`.
5. **Idempotent completion.** A scheduled game completes exactly once.

## Schedule generation

Pure module: `src/features/league/schedule/`.

Inputs (frozen at season creation, persisted on the `seasons` doc for reproducibility):

- `teamIds: string[]` — sorted lexicographically before generation.
- `divisions?: { id; teamIds }[]` — v2+; **`teamIds` arrays inside each division are also lex-sorted before generation**, otherwise division-aware matchup pool order varies.
- `gamesPerTeam: number` — derived from season-length preset.
- `seriesLength: number`.
- `interleague?: boolean` — v2+; whether leagues cross-play.
- `seed: string` — `seasons.masterSeed`.

**Sub-PRNG isolation:** schedule generation uses an isolated sub-PRNG seeded from `mulberry32(fnv1a(\`${masterSeed}:schedule\`))`, never the master PRNG directly. This way a future change to autogen (or any other master-PRNG consumer) does not shift schedule output for replays.

Algorithm:

1. **Build matchup pool.** For each pair `(A, B)` (iterated using the lex-sorted `teamIds`, never `Set`/`Map` iteration), compute target series count from games-per-team and division weighting.
2. **Round-robin rotation** to assign series across rounds. Use the schedule sub-PRNG for tie-breaking (which pair gets the bye in odd-team rounds).
3. **Expand series → games.** Each series produces `seriesLength` consecutive `gameDay` entries; home/away alternates within the series; over the season, host/visitor counts balance by ±1.
4. **Validate.** Assert no team appears twice on the same `gameDay`. If violated, the generator is buggy — fail loudly via the shared logger.
5. **Validate feasibility.** Some `(N teams, gamesPerTeam, seriesLength, divisions)` tuples are mathematically infeasible (e.g., 8 teams × 31 games × 3-game series with strict series-balance). The wizard validates feasibility **before** calling the generator and surfaces a specific error to the user; the generator itself also asserts pre-generation as a defense-in-depth check.

Output: `seasonGames[]` with `gameDay`, `homeSeasonTeamId`, `awaySeasonTeamId`, `seriesId`, `derivedSeed` populated.

> All iteration that affects PRNG call order MUST use sorted arrays — never `Object.keys(map)`, `Set` or `Map` iteration order, or query-result order from RxDB. This is a binding determinism contract.

### Odd team counts

Supported via byes. Bye distribution is deterministic from the seed and balanced across teams (no team gets more than ⌈total / N⌉ byes). **Algorithm (binding):** for each round where the team count is odd, sort the rounds-completed counts ascending; among ties, sort by lex `teamId`; assign the bye to the team at index `floor(scheduleSubPRNG() × tiedGroupSize)` of the lowest tied group.

### Sprint mode opponent-frequency caveat

Mini preset (8 teams, 30 games, 3-game series) yields ~4.28 games per opponent — **opponent-frequency is intentionally non-uniform**: each team plays 1–2 series per opponent, with extras distributed by seed. Surface this in the wizard as a one-liner under the Sprint preset label.

## Per-game seed derivation

This is a non-negotiable contract (see [`README.md`](README.md)).

```
deriveScheduledGameSeed(seasonId, seasonGameId): string
  1. input  = `${seasonId}:${seasonGameId}`
  2. hash   = fnv1a(input)                     // hex string
  3. uint32 = parseInt(hash, 16) >>> 0
  4. return uint32.toString(36)                // base-36, lowercase
```

```
reinitSeed(cachedDerivedSeed: string):
  1. uint32 = parseInt(cachedDerivedSeed, 36) >>> 0
  2. mulberry32 internal state = uint32
```

- The helper lives at `src/features/league/utils/deriveScheduledGameSeed.ts`.
- **Never** pass the raw `${seasonId}:${seasonGameId}` string into `reinitSeed`. The colon separator is not base-36-safe and would break determinism guarantees in `mulberry32`.
- The derived seed is **cached on the `seasonGames` doc** at schedule generation time (`derivedSeed` field). All sim code reads the cached value rather than recomputing — this keeps the seed stable even if the helper's implementation changes later.
- **Schema migrations on `seasonGames` MUST NOT recompute or rewrite `derivedSeed`.** Any migration is required to preserve the field verbatim.
- **Only the per-game flow may call `reinitSeed`.** Animations, UI tooltips, autogen previews, and any non-simulation code must never call into `mulberry32` between `reinitSeed(derivedSeed)` and the final pitch of that game. This will be enforced by an ESLint rule (a v1 implementation acceptance item — see [`agent-prompts/v1.md`](agent-prompts/v1.md)) restricting `reinitSeed` imports to the simulation entry point and the league sim loop.

## Simulation modes

| Mode                      | Where                             | Notes                                                                                                              |
| ------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Watch / Manage**        | `/game` route with league context | User watches their team's game; manager-mode prompts available; on completion, result reconciled to `seasonGames`. |
| **Quick Sim (headless)**  | Single-game, no UI                | Used for non-user games and when user clicks "Quick sim my next game".                                             |
| **Sim to next user game** | Batch                             | Sequentially simulates every scheduled game until the next game involving the user's team.                         |
| **Sim full season** (v4)  | Batch                             | Sequentially simulates every remaining scheduled game; UI shows progress bar.                                      |

### Why sequential?

The `mulberry32` PRNG instance is global (per `src/shared/utils/rng.ts`). Running games in parallel would produce non-deterministic results because PRNG calls would interleave. Each game must run start-to-finish before the next begins.

This is fine because:

- A headless game runs in <50ms on commodity hardware.
- "Sim to next user game" typically resolves <16 games (one game day for a Mini league).
- "Sim full season" (v4) runs a fairness budget (e.g., 4 games per `requestIdleCallback`) so the UI stays responsive.

### Concurrency model (binding)

The global PRNG forbids overlapping simulations of any kind. The following guards are non-negotiable:

1. **Per-game claim before sim.** Before any sim begins, the per-game flow atomically transitions `seasonGames[gameId].status` from `'scheduled'` → `'in_progress'` and writes a `claimedBy` writer-id (`crypto.randomUUID()`-per-tab token; not derived from PRNG). A second runner that observes `'in_progress'` aborts immediately.
2. **Season-scoped batch mutex.** Batch simulations ("Sim to next user game", v4 "Sim full season") acquire a per-`seasonId` in-memory mutex token before the batch starts and release on completion or abort. While held, the batch flow is the only PRNG consumer for that season.
3. **Watch ↔ headless mutual exclusion.** While a `/game?seasonGameId=X` watch session is active for a season, headless batch sims and "Quick sim my next game" for the same season are blocked (UI shows the action as disabled with a tooltip). Vice versa.
4. **Multi-tab guard.** RxDB is configured `multiInstance: false` (`src/storage/db.ts`), so cross-tab simulations cannot share the database. Additionally, on app start the league module checks for any `seasonGames` left at `status='in_progress'` with a stale `claimedBy` from a prior tab; these are reset to `'scheduled'` (the fresh `reinitSeed(derivedSeed)` re-runs the game from scratch — safe because per-game writes are atomic, see Idempotency).
5. **`reinitSeed` is the LAST step before sim entry.** Step 4 (`seasonModifiers` construction) involves async RxDB reads. **`reinitSeed(derivedSeed)` is called only after all those awaits resolve**, so no other code can consume PRNG between seed reset and the first pitch.

### Per-game flow (atomic)

For each scheduled game in order:

1. Atomically claim: `seasonGames[gameId].status: 'scheduled' → 'in_progress'` with `claimedBy` writer-id. Abort if already `in_progress` or `completed`.
2. Read `seasonGames[gameId].derivedSeed`.
3. Look up `homeSeasonTeamId`, `awaySeasonTeamId` → load `rosterSnapshot` from each `seasonTeams` doc.
4. Build `seasonModifiers` for both teams from `seasonPlayerState` (v1: pitcher availability only; v2+: + wear, + injury filter).
5. Call `reinitSeed(derivedSeed)` — **last step before sim**.
6. Inject modifiers into the existing simulation entry point (gameplay context). The injection contract is **frozen in v1** so v2/v3/v4 only add fields, never rename or remove them.
7. Run the game to completion (existing reducer logic).
8. v2+: run injury rolls (per [`fatigue-and-injuries.md`](fatigue-and-injuries.md)) **after** the box-score sim, in fixed iteration order.
9. **Single RxDB bulk-write transaction** committing: `seasonGames` (boxscore + `status='completed'` + `completedAt`); `seasonPlayerState` updates for every affected player (recovery curve, wear, injury status); `seasonTransactions` rows (`il_in`/`il_out`) for the day's IL changes. **Aggregates on `seasonTeams` (`wins/losses/runDifferential`) are derived (recomputed by querying `seasonGames`), not incremented** — this eliminates the partial-write double-application class of bugs.
10. Advance `seasons.currentGameDay` if all games for that day are complete.

### Idempotency contract

The completion path is idempotent on `seasonGameId`:

- If `seasonGames[gameId].status === 'completed'`, the path returns the existing record without rerunning the simulation.
- If `status === 'in_progress'` with a stale `claimedBy` (different `claimedBy` than the current process / older than the app's startup time), the row is reset to `'scheduled'` and the new attempt proceeds. The fresh `reinitSeed(derivedSeed)` re-runs the same game deterministically.
- Per-game step 9 is a single bulk transaction, so a crash mid-write either commits everything or commits nothing. There is no partial state to roll back.
- This protects against: double-completion from concurrent watch + quick-sim flows, retried writes on transient RxDB failure, service-worker re-mounts, and reload during in-progress completion.

## League-context handoff to `/game`

`AppShell` is a pure layout (per repo convention) — `GamePage` mounts on the `/game` route with no persistent host. Watch-mode entry needs a reload-safe handoff.

Approach:

- Use a **URL-addressable league context**: `/game?seasonGameId=<id>` (query string, not path, to avoid clashing with the existing `/game` route).
- `GamePage` reads `seasonGameId` on first mount, fetches the seasonGame + seasonTeams + seasonPlayerState, and sets up the gameplay context with the derived seed pre-applied.
- If the user reloads `/game?seasonGameId=…`, the context rehydrates from RxDB exactly as it was.
- If `seasonGameId` is missing, `/game` falls back to the existing exhibition save behavior — no regression.

Reasoning: `location.state` is unreliable across reloads and through the React Router data-router transitions. URL params are.

## Standings & completion

- After every completed game, recompute league standings from `seasonTeams` aggregates. (Cheap — N is at most 24.) UI subscribes via RxDB observable.
- Season is `complete` when every `seasonGames` row has `status='completed'`. v1 declares the champion as best win-pct; v3+ runs the playoff bracket.

## Skip / forfeit / abandon (deferred policy)

Out of v1–v3 scope. v4 may add explicit skip/forfeit semantics. Until then, "abandoning" a season simply marks `seasons.status='abandoned'`; in-flight games are left alone (UI hides them).

## Testing surface

- **Unit**: deterministic schedule generation across team-count × series-length × seed combinations.
- **Unit**: no-double-booking invariant on every generated schedule.
- **Unit**: `deriveScheduledGameSeed` produces identical output for identical inputs across runs.
- **Unit**: idempotent completion — calling the completion path twice with the same `seasonGameId` produces one record and one set of state updates.
- **Integration**: sim-to-next-user-game advances `currentGameDay` correctly and stops on the right game.
- **E2E**: same `masterSeed` produces identical `seasonGames.derivedSeed[]` arrays and identical final standings (asserted at the end of a Mini-preset Sprint season).
