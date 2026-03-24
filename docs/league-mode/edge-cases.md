# League Mode — Edge Cases & Error Handling

> See [README.md](README.md) for decisions log. This document catalogs every non-happy-path scenario across the full league lifecycle and specifies the correct behavior for each.

---

## 1. League Setup *(applies to initial slice)*

| Scenario | Correct behavior |
|---|---|
| **Team already in an active league** | Block selection on `LeagueSetupPage`; show "This team is already in an active league." Validate again on confirm in case state drifted. |
| **Custom team deleted after being added to setup page** | Re-validate on confirm; if the team no longer exists in RxDB, show an error and require a replacement. |
| **Only 2 teams selected** | Valid — the schedule degenerates to a single matchup pair played repeatedly. No divisions. The UI should display a note that no divisions are possible with fewer than 4 teams. |
| **Odd number of teams** | Valid — the bye system handles it. Show the user during setup that one team will have a bye each round. |
| **Division count that doesn't divide evenly into team count** | Block the configuration option; show "Cannot split N teams into D divisions evenly." Only offer division counts that divide cleanly (e.g. 6 teams → only 2 divisions is valid, not 4). |
| **League name collision (case-insensitive)** | Block creation; show "A league with this name already exists." Check via the `nameLowercase` index in RxDB. |
| **gamesPerTeam = 0 or negative** | Validation error — minimum is `seriesLength` (at least one complete series). |
| **seriesLength > gamesPerTeam** | Cap `seriesLength` to `gamesPerTeam` automatically, or show a warning and prevent confirmation. |
| **Custom game count below minimum** | Minimum is `seriesLength × 1` (one complete series per matchup). Show the minimum value in the input hint. |

---

## 2. Schedule Generation *(applies to initial slice)*

| Scenario | Correct behavior |
|---|---|
| **gamesPerTeam not achievable exactly with given seriesLength** | Round to the nearest achievable count (multiple of `seriesLength`). Show the actual game count to the user before confirming season creation; never silently produce a different count than configured. |
| **Single unique matchup (2-team league)** | The circle method produces one matchup per round. Repeat passes until game-count target is met. Schedule is valid. |
| **All teams in one division with division weighting enabled** | Division weighting is a no-op (every pair is a division rival). Fall back to flat weighting silently. |
| **Schedule batch write fails mid-way (storage error)** | Roll back: delete any `ScheduledGameRecord` docs that were written, reset `leagueSeason.status` to `SCHEDULED`, and show a "Storage error — season not started" message. Never leave a half-written schedule. |
| **generateId collision on scheduledGameId** | Astronomically unlikely given FNV-1a. If a primary key conflict is caught by RxDB, generate a new ID and retry once. If it fails twice, surface the error — this indicates a deeper storage problem. |

---

## 3. Regular Season — Game Play *(applies to initial slice)*

| Scenario | Correct behavior |
|---|---|
| **User navigates away mid-Watch/Manage game** | The game state is held only in `GameContext` memory — it is lost on navigation. The `ScheduledGameRecord` remains `PENDING`. The user can return to `SchedulePage` and choose to Watch again (same seed → same game starts fresh) or Sim instead. |
| **App crash during headlessSim** | The `ScheduledGameRecord` stays `PENDING`. On next load the user can re-simulate; the same seed produces the same result, so replay is deterministic. No data corruption. |
| **headlessSim hits `maxIterations`** | Throw a descriptive error including the current reducer state. The game is marked with a special `ERROR` status (or left `PENDING`). Show the user a retry option. The same seed will reproduce the same pathological state — log it for debugging. Do not silently return a partial result. |
| **Game day has all games CANCELLED** | Advance `currentGameDay` automatically past it. Do not show an empty "game day" card to the user. |
| **`flaggedForWatch` game never played** | The season cannot auto-advance past that game day until the flag is cleared or the game is simulated. The `SchedulePage` must show a persistent prompt: "You have a flagged game on Day N — Watch it or Simulate to continue." Provide a one-tap "Sim it" shortcut directly on the card. |
| **Lineup roster is empty or invalid at sim time** | `headlessSim` should catch this before running and throw a clear error: "Team [name] has no valid lineup." The user should be prompted to fix the roster. This should not occur in normal flow since rosters are validated at league creation and trade time. |

---

## 4. Batched Simulation (Simulate Day) *(applies to initial slice)*

| Scenario | Correct behavior |
|---|---|
| **User double-taps Simulate Day** | The `isSimulating` guard in `useBulkSimulate` prevents re-entry. The button is disabled while `isSimulating === true`. |
| **Partial batch write failure** | Each game is committed individually and sequentially. Games that succeeded are persisted. Games that failed remain `PENDING` and are not shown in `NightSummaryModal`. The user is notified of any failures and can retry the remaining games. |
| **All games on current day are flagged** | Show `FlaggedGamesWarning` for all of them. The user must either "Sim anyway" (sims all) or "Stop here" (no games simmed). |
| **Zero PENDING games on current day** | The "Simulate Day" button is disabled. `advanceGameDay` fires automatically if all games on the current day are already COMPLETED or CANCELLED. |
| **Concurrent tab opens and starts a second sim** | RxDB is configured with `multiInstance: false`. A second tab will fail to initialize the DB and will show an error. No concurrent simulation is possible. |
| **Seed collision between two games in the same batch** | Impossible by construction — each game's seed is `${leagueSeasonId}:${scheduledGameId}` and `scheduledGameId` is a unique RxDB primary key. The uniqueness is enforced at the storage layer, not just by convention. See [schedule-algorithm.md — Game Seed Uniqueness](schedule-algorithm.md#game-seed-uniqueness). |

---

## 5. Game Seeds *(applies to initial slice)*

| Scenario | Correct behavior |
|---|---|
| **Same game re-simulated after crash** | The formula `${leagueSeasonId}:${scheduledGameId}` is deterministic — same inputs always produce the same seed, so the same game result is reproduced. |
| **Playoff game seed** | Playoff `ScheduledGameRecord` docs use the same `generateScheduledGameId()` function. The same seed formula applies — uniqueness and determinism are both guaranteed. |
| **Two seasons accidentally produce matching `scheduledGameId` values** | The `leagueSeasonId` prefix in the seed formula distinguishes them. Even if two seasons contain a doc with the same `scheduledGameId` string (extremely unlikely given FNV-1a), their seeds will be different. |
| **Seed stored on `CompletedGameRecord`** | The seed passed to `headlessSim` must be written verbatim to `CompletedGameRecord.seed`. This enables independent re-verification of any result. |

---

## 6. Trades *(Phase 8 — future)*

| Scenario | Correct behavior |
|---|---|
| **Player traded, then traded again in the same season** | Valid, provided the second trade passes all constraints at the time of execution. Both `TradeRecord` docs are preserved as an immutable audit trail. |
| **Both teams at minimum roster** | No trade is possible. Show "Both teams are at the minimum roster size — no players can be moved." The confirm button must remain disabled. |
| **Trade deadline day boundary** | Trades are blocked when `currentGameDay >= tradeDeadlineGameDay`. The deadline is exclusive — once you're on or past the deadline game day, trading is over. If the deadline equals game day 1, trades are never open. |
| **Multi-player trade where one player fails validation** | The entire trade is rejected atomically — none of the player moves execute. Return a single `TradeValidationError` with the specific failing constraint. |
| **RxDB partial write during trade execution** | See [trades.md — Atomicity Note](trades.md#atomicity-note). Player updates are written first, `TradeRecord` last. If the `TradeRecord` insert fails, a recovery record is written on next load by `validateLeagueRosterIntegrity`. |
| **Trade attempted during playoffs** | Blocked. Playoffs begin after all regular-season games are complete, which is always after `tradeDeadlineGameDay`. The deadline validation (`currentGameDay >= tradeDeadlineGameDay`) catches this automatically. |
| **Team tries to trade with a team that has a live Watch game in progress** | Blocked with error: "Cannot trade while a live game is in progress." Detected via an in-memory `activeScheduledGameId` — not inferred from `flaggedForWatch`, which only means "watch later" and does not imply a game is actively running. |

---

## 7. Standings & Tiebreaking *(applies to initial slice)*

| Scenario | Correct behavior |
|---|---|
| **Three-way tie in win %** | Apply the full tiebreaker chain in order: (1) H2H win% among tied teams, (2) run differential in H2H games, (3) overall run differential. If still tied after all tiebreakers, use alphabetical team name as a final deterministic tiebreaker — never leave sort order undefined. |
| **Team with 0 games played (all byes)** | W=0, L=0, Pct=.000. Place last in standings (or last among teams with the same win%). This is expected with odd-team-count leagues. |
| **Division winner has a worse record than a wild card team** | The division winner is still seeded #1 for their division bracket slot. This is intentional — same as real MLB. Display a note if this occurs (e.g. "Division winner — qualified via division title"). |
| **Standings queried mid-season (incomplete games)** | Use only `COMPLETED` `CompletedGameRecord` docs. `PENDING` and `CANCELLED` games are ignored for standings purposes. |
| **Team with identical W-L-RD to another after all tiebreakers** | Alphabetical by `team.name` is the final deterministic fallback. Never use a random or insertion-order sort. |

---

## 8. Playoffs *(Phase 9 — future)*

| Scenario | Correct behavior |
|---|---|
| **Odd number of advancing teams (e.g. 3, 5, 6)** | Expand bracket to the next power of 2. Top-seeded team(s) receive byes in round 1. A bye is modeled as a CANCELLED series (all slots CANCELLED immediately). |
| **2-team league** | There are no divisions and only 2 teams qualify for playoffs. The bracket is a single finals series — Bo5 by default. No round 1 bracket is needed. |
| **Series swept (e.g. 3-0 in Bo5)** | Remaining game slots (games 4 and 5) are immediately CANCELLED after game 3 is committed. Next-round slots are created. |
| **`headlessSim` hits `maxIterations` in a playoff game** | Same handling as regular season — throw, show error, allow retry. A pathological state in the existing reducer is a bug to fix, not a state to silently ignore. |
| **Playoff game `flaggedForWatch` but never played** | Same as regular season — the bracket cannot advance until the game is resolved. Show a persistent prompt on `PlayoffBracketPage`. |
| **Bracket auto-generation fails (e.g. standings compute error)** | Do not set `leagueSeason.status = "PLAYOFFS"`. Show an error on `SchedulePage`: "Could not generate playoff bracket — please retry." Log the error with full standings state for debugging. |
| **Finals clinched but `leagueSeason` doc not yet updated** | The `completeScheduledGame` function updates `leagueSeason.status` and `championTeamId` in the same write batch as the final game. The reactive RxDB subscription on `LeagueDetailPage` will update the UI once the write completes. |

---

## 9. Multi-Season & Season Rollover *(Phase 10 — future)*

| Scenario | Correct behavior |
|---|---|
| **Roster at start of new season reflects post-trade state** | `TeamRecord.players` at the time of the new season creation is the roster used. There is no "season snapshot" of rosters — each season uses the live player data. If that's undesirable for future seasons, `LeagueSeasonRecord.teamIdsAtStart` records membership but not individual player data. |
| **Player deleted between seasons** | Historical `CompletedGameRecord` and stat records reference the deleted `playerId`. The career-stats page may show "Unknown Player" for that ID. Prevent deletion of players who have `CompletedGameRecord` entries with their `playerId` — or at minimum warn before deleting. |
| **Team renamed between seasons** | Old season stats continue to reference `teamId`, which is stable. The UI should resolve team names from the current `TeamRecord` for display — past games will show the current name. If preserving historical names matters, store `homeTeamNameAtTime` / `awayTeamNameAtTime` on `CompletedGameRecord`. |
| **`activeLeagueId` not cleared after season completes** | `leagueStore.completeLeagueSeason` must clear `activeLeagueId` on every `TeamRecord` in the season. If it's not cleared, teams are permanently locked out of new leagues. This must be part of the `COMPLETE` transition — not a separate cleanup step. |
| **New season started before the previous one is `COMPLETE`** | Block the "Start New Season" button until `leagueSeason.status === "COMPLETE"`. Validate in `leagueSeasonStore.createSeason` before any writes. |

---

## 10. Data Integrity & Storage *(applies to initial slice)*

| Scenario | Correct behavior |
|---|---|
| **Epoch bump wipes an active league** | All data is lost — this is the documented and accepted consequence of using `BETA_SCHEMA_EPOCH`. After League Mode ships, the epoch mechanism must never be bumped again. See [data-model.md](data-model.md#chosen-approach-epoch-bump). |
| **IndexedDB storage quota exceeded during schedule batch write** | Catch the storage error before any writes; show "Storage full — unable to start season." Do not partially write a schedule — an incomplete schedule is worse than no schedule. |
| **`CompletedGameRecord` references a non-existent `scheduledGameId`** | Can occur if a batch write partially fails. The `validateLeagueRosterIntegrity` function should run on season load and flag orphaned records. Orphaned `CompletedGameRecord` docs are still valid for stats — they are just missing their schedule backlink. |
| **RxDB `closeDuplicates` and concurrent tabs** | `createRxDatabase` is configured with `multiInstance: false`. A second tab attempting to open the same DB will fail during init and show an error to the user. This is intentional — it prevents race conditions in game simulations. |
| **App goes offline mid-simulation** | All data is local — there is no network dependency. Offline state has no effect on simulation or persistence. |
| **Large league (many teams, Full 162-game season) — schedule write performance** | A Full 162-game season with 8 teams produces 162 × 4 = 648 `ScheduledGameRecord` docs. RxDB bulk insert (`addCollections` + `bulkInsert`) handles this in one transaction. If it takes more than ~2 seconds, show a progress indicator during season creation. |
