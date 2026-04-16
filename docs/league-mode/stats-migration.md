# League Mode — Stats Hub Migration (Future)

> Deferred scope: not part of the initial league-mode delivery.

## Goal

Evolve `/stats` into a hub that supports both exhibition and league stat views while preserving existing deep links.

## Proposed direction

- Add stats hub layout under `/stats`
- Keep exhibition stats as existing behavior under explicit exhibition paths
- Add league-scoped stats route by league ID
- Maintain legacy redirects for old stat URLs

## Rule

No breaking route change: every existing stats URL must still resolve via direct route or redirect.
