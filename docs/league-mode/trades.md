# League Mode — Trades (Future)

> Deferred scope: not part of the initial league-mode delivery.

## Deadline semantics (canonical)

| Field                  | Meaning                                             |
| ---------------------- | --------------------------------------------------- |
| `tradeDeadlineGameDay` | First game day where trades are closed              |
| Enforcement rule       | Block when `currentGameDay >= tradeDeadlineGameDay` |

## Constraints

- Teams must be in same league season
- No self-trades
- Respect minimum viable roster composition
- Validate player ownership at execution time

## Data integrity rules

- Trade history must be queryable by league season and time order
- Execution result should be explicit success/failure shape (not ambiguous `void | error`)
- Partial-write recovery behavior must be defined before implementation
