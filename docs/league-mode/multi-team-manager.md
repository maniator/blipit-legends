# League Mode — Multi-Team Manager Mode (v4)

> Companion to [`README.md`](README.md). Resolves UX P1-8 from round-2 review: v4's optional "manage every team" toggle had zero UX spec.

## Status

**Stub for v4.** This doc names the contracts and routing rules that v4 implementation must respect. Detailed visual mockups land via `@ux-design-lead` before the v4 implementation PR opens (see [`agent-prompts/v4.md`](agent-prompts/v4.md) `@senior-lead` gate #2).

## What it is

A setup-time toggle (off by default per decision #4) that lets the user receive Manager Mode prompts for **every** team in the league, not just one. v1–v3 ship with `teamIds: string[]` length 1; v4 lifts this to length N **without rewriting** the v1 manager-mode prompt surface (per `risks.md` #25 mitigation).

## Where the toggle lives

- Setup wizard, Step 5 (Seed & advanced) — checkbox: **"Manage every team in this league (advanced)"**.
- Help text: _"You'll receive Manager Mode prompts for every team's games. Off by default — most users prefer to manage one team."_
- Snapshotted onto the `seasons` doc as `featureFlags.multiTeamManager: boolean` — part of the feature-flag snapshot per decision #26, so mid-season toggles are no-ops.

## Prompt routing rules (binding contract)

When N>1 teams have simultaneous Manager Mode decisions during the same game-day:

1. **Queue per game.** Within a single watch-mode game, prompts surface in **batting-event order** (the order they would naturally arise during play-by-play). The user resolves one at a time; the sim pauses only on the active prompt.
2. **Cross-game queueing.** When two of the user-managed teams play on the same `gameDay` in different games, games are simulated **sequentially** (per the global PRNG concurrency contract in `schedule-and-sim.md`). The user resolves prompts for game 1 to completion before game 2 starts.
3. **Opposing managers** (the user manages both teams in the same game): allowed in v4. Prompts surface as normal; the side currently at bat / on the mound owns the prompt context. The UI labels which team's decision is being made.
4. **No primary-team priority knob in v4.** Adding one (e.g., "auto-resolve other teams' prompts to AI policy") is a v4-stretch tracked in [`agent-prompts/v4.md`](agent-prompts/v4.md) acceptance criteria.
5. **Quick Sim ignores multi-team prompts.** When the user runs Quick Sim, every team — including all user-managed teams — auto-resolves to the AI policy (per `fatigue-and-injuries.md` v1 AI rotation/lineup policy section). This is consistent with single-team manager mode and avoids prompt floods on quick-sim.

## UI labelling

- Manager-mode prompt panel header gains a team-name pill so the user always knows whose decision is active. Format: `<TeamPill team={teamName}> Decision</TeamPill>`. Reuses the existing `StatusPill` (variant `auto`/`team` — to be added to `style-guide-additions.md`).
- Prompt history (last N decisions) shows the team name alongside each entry.

## Persistence

- `seasons.featureFlags.multiTeamManager: boolean` — snapshotted at season start (part of the feature-flag snapshot per decision #26).
- The list of user-managed `seasonTeamId`s is derived: in single-team mode it is the user's pick; in multi-team mode it is **every** `seasonTeamId` in the season's leagues (no per-team opt-in granularity in v4).

## Determinism

- AI auto-resolve in Quick Sim consumes PRNG identically whether the user is in single-team or multi-team mode. Multi-team mode does **not** alter the PRNG sequence — it only changes which decisions surface to the UI vs auto-resolve.
- Replay: a season created with `multiTeamManager: true` and quick-simmed to completion produces byte-identical results to the same season created with `multiTeamManager: false`.

## Accessibility

- Cross-team prompt queue: live-region announcement (`role="status"`) when a new team's prompt becomes active: _"Now managing: {teamName}."_
- Visual disambiguation between teams: the active team's color borders the prompt panel (color sourced from existing team-color tokens; no net-new colors).

## Risks

- **Prompt fatigue at Standard / Full preset** — managing 16 or 24 teams could fire dozens of prompts per game-day. Mitigation: aggressive defaults to "auto-resolve" (the AI policy) for non-active teams once a v4-stretch primary-team toggle ships. v4 baseline expects users opt into this knowingly.
- **Watch ↔ multi-team prompt** during a single game: `schedule-and-sim.md` already documents the watch ↔ headless mutex per season; multi-team adds no new race condition.

## Testing surface

- **Unit:** prompt routing rules — same `gameDay`, two user-managed teams in different games → prompts surface in completion order.
- **Integration:** Quick Sim with multi-team mode produces byte-identical season log to single-team mode at the same seed.
- **E2E:** opposing-managers scenario — visual snapshot of the team-pill swap mid-game.

## Out of scope for v4

- Per-team opt-in / opt-out (all-or-nothing in v4).
- "Auto-resolve all but one team" knob — tracked as a v4-stretch in [`agent-prompts/v4.md`](agent-prompts/v4.md) acceptance criteria.
- Networked / multi-user manager mode — out of all v1–v4 (local-only app, see `decisions.md` "won't ship" register).
