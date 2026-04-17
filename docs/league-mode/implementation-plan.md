# League Mode — Implementation Plan

## Phase 1: data foundation

- Add league/season/scheduled-game schemas
- Add basic stores and read APIs
- Lock in seed + ownership contracts from [README.md](README.md)

## Phase 2: schedule generation

- Deterministic round-robin schedule generation
- Series-based structure (default length 3)
- Persist full season schedule at season creation

## Phase 3: league setup UX

- Create league flow
- Team assignment and division selection
- Support no-division and uneven-division distributions

## Phase 4: game execution integration

- Launch watch mode via `/game` with league context
- Run headless simulation for quick resolve flows
- Ensure each scheduled game is completed once

## Phase 5: standings and completion

- Update standings on every completed scheduled game
- Mark season complete when all regular games resolve
- Champion by best win percentage for initial release

## Deferred phases (future)

- Stats hub routing and screens
- Trades
- Playoffs
- Multi-season continuation
- Cross-game fatigue and AI pre-game upgrades

## Delivery checklist

- Keep near-term docs aligned with actual current architecture and data contracts
- Keep future docs clearly labeled as non-committed
- Avoid pseudo-code that can be mistaken for implementation-ready logic
