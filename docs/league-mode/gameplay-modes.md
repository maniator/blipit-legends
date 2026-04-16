# League Mode — Gameplay Modes

## Near-term modes

1. **Watch / Manage**
   - Navigate to `/game` with league context
   - On completion, reconcile result back to scheduled game
2. **Quick Sim (headless)**
   - Run deterministic simulation without rendering the game UI
   - Persist one completed result for that scheduled game
3. **Simulate Day (batch)**
   - Process selected scheduled games sequentially
   - Re-seed before each game using the per-game derived seed

## Contracts

- Batch simulation is sequential because RNG state is shared globally.
- A scheduled game cannot be completed twice.
- Deferred/skip behavior must preserve standings integrity (future detailed policy in edge cases).

## Result handling

- Box score details should always trace to a single completed game identity.
- Summary UI can aggregate same-day results, but persistence remains per game.
