# League Mode — Data Model

## Core records (near-term)

- `LeagueRecord`: league identity, team membership, division settings
- `LeagueSeasonRecord`: one season instance, current day, status, standings snapshot metadata
- `ScheduledGameRecord`: scheduled matchup and completion state

## Key fields and semantics

- `activeLeagueId` on team records represents active membership and remains set while the team belongs to that league.
- `currentGameDay` advances with schedule progress.
- `tradeDeadlineGameDay` is reserved now for compatibility; enforcement is future work.
- `status` fields should use explicit finite values consistent with implementation types.

## Ownership boundaries

- Gameplay simulation produces game outcomes.
- Schedule completion persists league-level completion state.
- Completed game persistence must be idempotent and must not create duplicates for a single scheduled game.

## Migration posture

Initial league-mode release may use an epoch reset if required, but in this repo that means deleting the entire local `ballgame` IndexedDB, not just league-mode records.
If used, this is a full local wipe for users, including saves, custom teams, stats, and other persisted local data, and should ship only with explicit intent and user-impact communication.
Any post-launch schema evolution must use version bumps and migration strategies per [`docs/rxdb-persistence.md`](../rxdb-persistence.md).

## Indexing expectations

- Index by `leagueSeasonId` and day/status for schedule queries
- Add sort-friendly indexes for historical queries (for example, trade history in future scope)
