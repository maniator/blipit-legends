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

- `teamIds: string[]` — sorted lexicographically before generation, so order doesn't affect output.
- `gamesPerTeam: number` — derived from season-length preset.
- `seriesLength: number`.
- `divisions?: { id; teamIds }[]` — v2+; affects matchup distribution (intra-division vs inter-division weighting).
- `interleague?: boolean` — v2+; whether leagues cross-play.
- `seed: string` — `seasons.masterSeed`.

Algorithm:

1. **Build matchup pool.** For each pair `(A, B)`, compute target series count from games-per-team and division weighting.
2. **Round-robin rotation** to assign series across rounds. Use the seeded PRNG for tie-breaking (which pair gets the bye in odd-team rounds).
3. **Expand series → games.** Each series produces `seriesLength` consecutive `gameDay` entries; home/away alternates within the series; over the season, host/visitor counts balance by ±1.
4. **Validate.** Assert no team appears twice on the same `gameDay`. If violated, the generator is buggy — fail loudly via the shared logger.

Output: `seasonGames[]` with `gameDay`, `homeSeasonTeamId`, `awaySeasonTeamId`, `seriesId`, `derivedSeed` populated.

### Odd team counts

Supported via byes. Bye distribution is deterministic from the seed and balanced across teams (no team gets more than ⌈total / N⌉ byes).

## Per-game seed derivation

This is a non-negotiable contract (see [`README.md`](README.md)).

```
deriveScheduledGameSeed(seasonId, scheduledGameId): string
  1. input  = `${seasonId}:${scheduledGameId}`
  2. hash   = fnv1a(input)                     // hex string
  3. uint32 = parseInt(hash, 16) >>> 0
  4. return uint32.toString(36)                // base-36, lowercase
```

- The helper lives at `src/features/league/utils/deriveScheduledGameSeed.ts`.
- **Never** pass the raw `${seasonId}:${scheduledGameId}` string into `reinitSeed`. The colon separator is not base-36-safe and would break determinism guarantees in `mulberry32`.
- The derived seed is **cached on the `seasonGames` doc** at schedule generation time (`derivedSeed` field). All sim code reads the cached value rather than recomputing — this keeps the seed stable even if the helper's implementation changes later.

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

### Per-game flow

For each scheduled game in order:

1. Read `seasonGames[gameId].derivedSeed`.
2. Call `reinitSeed(derivedSeed)` to lock the PRNG to a deterministic state.
3. Look up `homeSeasonTeamId`, `awaySeasonTeamId` → load `rosterSnapshot` from each `seasonTeams` doc.
4. Build `seasonModifiers` for both teams from `seasonPlayerState` (v1: pitcher availability only; v2+: + wear, + injury filter).
5. Inject modifiers into the existing simulation entry point (gameplay context). The injection contract is **frozen in v1** so v2/v3/v4 only add fields, never rename or remove them.
6. Run the game to completion (existing reducer logic).
7. Write boxscore to `seasonGames`, mark `status='completed'`, set `completedAt`.
8. Update `seasonTeams.wins/losses/runDifferential`.
9. Update `seasonPlayerState`:
   - SP for the winning/losing team gets `pitcherDaysRest = 0`, `pitcherStartsThisSeason++`, `pitcherAvailability` recalculated.
   - All other pitchers tick `pitcherDaysRest++`, recover toward `pitcherAvailability = 1`.
   - v2+: position-player `wear++` for starters; `wear` ticks down on rest days; injury rolls per the injury system.
10. Advance `seasons.currentGameDay` if all games for that day are complete.

### Idempotency contract

The completion path is idempotent on `seasonGameId`:

- If `seasonGames[gameId].status === 'completed'`, the path returns the existing record without rerunning the simulation.
- This protects against double-completion from concurrent watch + quick-sim flows, retried writes, or service-worker re-mounts.

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
