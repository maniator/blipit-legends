# League Mode — Edge Cases

## Seed integrity

- Treat raw IDs as seed input material, not final seed strings.
- Ensure all simulation paths use the same base-36-safe derived seed contract.

## Division setup

- `divisionCount = 0` is valid and means no divisions.
- When divisions are enabled, uneven splits are acceptable if deterministic and documented.

## Schedule completion

- A scheduled game must never be finalized twice.
- Retry paths must preserve idempotency.

## Membership lifecycle

- Teams remain associated with their league across season rollover unless explicitly removed/disbanded.

## Future-policy placeholders

The following need explicit policy before implementation and should not be implied as done:

- Skip/forfeit handling impact on standings
- Trade cutoff messaging and UX timing
- Recovery from partial write failures in future trade workflows
