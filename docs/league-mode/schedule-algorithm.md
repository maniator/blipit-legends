# League Mode — Schedule Algorithm

## Goals

- Deterministic schedule generation from explicit inputs
- Series-based regular season structure
- Reasonable balance across opponents and home/away assignments

## Inputs (determinism contract)

- Team IDs
- Games-per-team target
- Series length
- Division settings
- Explicit `seed`

Given identical inputs, output must be identical.

## High-level approach

1. Build matchup rounds with round-robin rotation
2. Expand rounds into series
3. Assign consecutive game days
4. Validate no team appears in two games on the same day

## Odd team counts

- Support odd team counts by using byes
- Bye distribution must be deterministic from the provided seed

## Seed derivation for game simulation

- Do not use raw `${leagueSeasonId}:${scheduledGameId}` directly with `reinitSeed`
- Canonical derivation algorithm:
  1. Build the exact stable input string `${leagueSeasonId}:${scheduledGameId}`
  2. Hash that input with `fnv1a`
  3. Parse the hex hash as an unsigned integer (`parseInt(hash, 16) >>> 0`)
  4. Convert that integer to lowercase base-36 (`value.toString(36)`)
- Planned shared helper: `deriveScheduledGameSeed(leagueSeasonId, scheduledGameId)` in `src/features/leagueMode/utils/deriveScheduledGameSeed.ts`
- Until that helper is added, any simulation entry point that needs this seed must follow the canonical derivation algorithm above exactly and must not change the hashing, separator, or encoding rules inline

## Validation targets

- Deterministic output with stable inputs
- Balanced matchup distribution within expected tolerance
- No duplicate same-day assignments per team
