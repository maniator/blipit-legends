# AI Manager v2 — Future Pre-Game Decisions

> Deferred scope: not part of the initial league-mode delivery.

## v1 baseline

- In-game AI decisions continue using existing gameplay systems.
- Pre-game league AI remains intentionally simple.

## v2 goals

- Rest-aware starter selection
- Better batting order construction
- Bench priority strategy

## Requirements for future implementation

- Deterministic outputs for identical inputs
- No hidden randomness outside documented seed flow
- Clear separation between per-game setup choices and persisted roster state

## Dependency

Rest-aware starter selection depends on cross-game workload tracking from future stamina work.
