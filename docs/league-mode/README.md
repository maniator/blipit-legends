# League Mode — Working Design (Rewrite)

> Status: planning only. This is a rewritten and simplified replacement for PR #217's draft docs.

## Scope split

### Near-term (implementation target)

1. League and season records in RxDB
2. Deterministic schedule generation
3. Watch and headless sim flows for scheduled games
4. Standings + season completion
5. Clear ownership and integrity contracts (seeding, IDs, league membership)

### Future (documented, not committed for initial delivery)

- Stats hub migration
- Trade UI and enforcement
- Playoff bracket and progression
- Multi-season continuity
- Cross-game fatigue and AI pre-game planning

## Non-negotiable contracts

- **Seed contract:** never pass raw strings with separators like `:` or `_` into `reinitSeed`; derive a base-36-safe deterministic seed first.
- **League membership contract:** `activeLeagueId` stays set while a team remains in a league, including between seasons.
- **Game ownership contract:** each scheduled game resolves to one completed game record; no duplicate writes from both gameplay and schedule layers.
- **Division contract:** `divisionCount = 0` means no divisions; when divisions are enabled, near-even distribution is valid even when team counts do not divide evenly.
- **Deadline contract:** `tradeDeadlineGameDay` is the first day trades are closed (`currentGameDay >= tradeDeadlineGameDay` blocks trades).

## Document map

- [implementation-plan.md](implementation-plan.md)
- [data-model.md](data-model.md)
- [routing.md](routing.md)
- [gameplay-modes.md](gameplay-modes.md)
- [schedule-algorithm.md](schedule-algorithm.md)
- [edge-cases.md](edge-cases.md)

Future reference docs (deferred scope):

- [stats-migration.md](stats-migration.md)
- [trades.md](trades.md)
- [playoffs.md](playoffs.md)
- [stamina.md](stamina.md)
- [ai-manager-v2.md](ai-manager-v2.md)
