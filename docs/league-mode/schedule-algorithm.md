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
- Derive a deterministic base-36-safe seed string first
- Use the same derivation in all simulation entry points

## Validation targets

- Deterministic output with stable inputs
- Balanced matchup distribution within expected tolerance
- No duplicate same-day assignments per team
