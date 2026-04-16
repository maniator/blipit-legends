# League Mode — Stamina and Fatigue

## Near-term behavior

- Fatigue is applied within a single game only.
- Cross-game fatigue carryover is out of scope for initial league release.
- Starter selection remains deterministic and simple for league simulation paths.

## Why this is acceptable for v1

- Keeps initial league mode focused on scheduling, progression, and standings.
- Avoids introducing additional persistent workload state before foundation is stable.

## Future direction (deferred)

- Add per-season pitcher workload tracking
- Apply short-rest penalties during game setup
- Add rest-aware AI starter selection
- Add explicit UX for starter planning

## Documentation guardrail

Avoid comparator pseudo-code or tie-break examples that are not valid implementations.
