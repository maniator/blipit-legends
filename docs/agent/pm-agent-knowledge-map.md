# PM Agent — Knowledge Map

Source index, ownership, and refresh cadence for the Ballgame PM Agent.

---

## Purpose

This document is the single index of every authoritative source the PM Agent must consult before answering a question. It is divided into three layers: (A) repo-native docs and source files, (B) baseball rules corpus, and (C) decision history / ADR notes.

The agent **must cite a source from this map** for every simulator claim. Any answer that asserts simulator behavior without a Layer A citation is non-compliant.

---

## Layer A — Repo-native sources (highest priority)

### A1. Product and architecture docs

| Source | Path | Owner | Refresh trigger |
|---|---|---|---|
| Repo layout + aliases | `docs/repo-layout.md` | Core team | Any structural refactor |
| Architecture + autoplay | `docs/architecture.md` | Core team | Any route or engine change |
| RxDB / persistence | `docs/rxdb-persistence.md` | Core team | Any schema or store change |
| E2E testing guide | `docs/e2e-testing.md` | Core team | Any new test project, fixture, or snapshot |
| UI style guide | `docs/style-guide.md` | Core team | Any new color, component, or breakpoint |
| README | `README.md` | Core team | Any major product change |
| Contributing guide | `CONTRIBUTING.md` | Core team | Any workflow or PR-process change |
| Copilot instructions | `.github/copilot-instructions.md` | Core team | Any coding convention change |

### A2. Gameplay engine source files

These files are the ground truth for simulator behavior. The agent must cite line ranges when making claims about how the simulator works.

| File | What it governs |
|---|---|
| `src/features/gameplay/context/gameStateTypes.ts` | Full `State` shape — all fields that drive simulation |
| `src/features/gameplay/context/reducer.ts` | Action dispatch, decision detection (`detectDecision`), steal %, IBB/shift guard conditions |
| `src/features/gameplay/context/handlers/sim.ts` | Simulation action handlers (`foul`, `intentional_walk`, `steal_attempt`, `bunt_attempt`, `wait`, etc.) |
| `src/features/gameplay/context/handlers/decisions.ts` | Manager decision handlers (`set_defensive_shift`, `set_pinch_hitter`, etc.) |
| `src/features/gameplay/context/advanceRunners.ts` | Deterministic runner advancement per hit type; walk force-only logic |
| `src/features/gameplay/context/hitBall.ts` | Ball-in-play resolution: batted-ball types, grounder/fly/liner probabilities, DP logic, sac fly, runner stretch |
| `src/features/gameplay/context/gameOver.ts` | Game-end logic: `checkGameOver`, `nextHalfInning` (home-lead skip, tiebreak runner), `checkWalkoff` |
| `src/features/gameplay/context/playerOut.ts` | Out recording, batter rotation, pitch-count increment, pitcher fatigue tracking |
| `src/features/gameplay/context/playerActions.ts` | `playerStrike`, `playerBall`, `playerWait` — ball/strike resolution including fatigue control penalty |
| `src/features/gameplay/context/buntAttempt.ts` | Bunt outcome probabilities (single / FC / sac bunt / pop-up) |
| `src/features/gameplay/context/stealAttempt.ts` | Steal resolution — success or caught-stealing per `successPct` |
| `src/features/gameplay/context/strategy.ts` | Strategy modifier table (`stratMod`) scaling all batting outcomes |
| `src/features/gameplay/context/decisionTypes.ts` | Exhaustive union of all manager-mode decision types |
| `src/features/gameplay/context/pitchSimulation/index.ts` | Batted-ball type resolution, fatigue factor (`computeFatigueFactor`) |
| `src/shared/utils/rng.ts` | Module-global PRNG (`random`, `reinitSeed`, `restoreRng`) — ground truth for replay determinism |
| `src/features/help/components/HelpContent/index.tsx` | In-app rules text — the game's own user-facing rulebook |

### A3. Agent and rollout docs

| Source | Path | Purpose |
|---|---|---|
| Agents overview | `.github/agents/README.md` | Custom agent routing guide |
| PM agent spec | `.github/agents/pm-agent.md` | Agent system prompt + behavior contract |
| Baseball rules delta | `docs/agent/baseball-rules-delta.md` | MLB vs Ballgame deviations (this repo) |
| Eval suite | `docs/agent/pm-agent-eval-suite.md` | Regression test questions + scorecard |
| Rollout playbook | `docs/agent/pm-agent-rollout.md` | Phase-gated deployment plan |

---

## Layer B — Baseball rules corpus

### B1. Primary authority

**MLB Official Baseball Rules** (published annually by the Commissioner's Office).

- The agent uses the MLB rulebook as the gold-standard for official baseball questions.
- When MLB rules and Ballgame simulator behavior differ, the agent **always states both**, clearly labeling each. See `docs/agent/baseball-rules-delta.md` for the full delta table.
- Key rule section references used in this codebase:

| Section | Topic |
|---|---|
| Rule 5.04(a) | Batting order — nine batters, sequential |
| Rule 5.05(b)(2) | Intentional base on balls (4 pitches in real baseball) |
| Rule 5.06(b)(3)(H) | Infield fly rule |
| Rule 5.06(c) | Scoring a run; walk-off condition |
| Rule 5.08 | How a team scores; home team skip when leading after top of 9th+ |
| Rule 5.09(a) | Recording outs — strikeouts, fly balls, ground outs |
| Rule 5.09(b)(2) | Force plays; base on balls force advancement only |
| Rule 7 | Determining the winner; extra innings |
| OBR Appendix (Automatic runner) | Extra-inning tiebreak runner on 2nd — permanent since 2022 |

### B2. Derived summaries

Curated plain-language summaries of each rule area are embedded in `docs/agent/baseball-rules-delta.md` alongside the simulator-specific delta. These are faster to reference than the full rulebook and are purpose-built for this codebase.

### B3. External web lookups

The agent **may** perform a web lookup when seeking a specific MLB rule citation not available in Layer A or B1/B2, or when verifying a statistical claim about real-world baseball. Any answer derived from a web lookup must be prefixed with:

> `[External source — not repo-verified]`

---

## Layer C — Decision history (supplementary)

| Source | Notes |
|---|---|
| `docs/future-tasks/` | Planned but not-yet-implemented features; useful for scope and risk flagging |
| PR descriptions (GitHub) | Historical context for past architectural decisions |
| Issue tracker (GitHub) | Bug reports and feature requests; useful for risk mapping |

Layer C is supplementary. Prefer Layer A citations over Layer C inferences.

---

## Refresh cadence

| Trigger | Action required |
|---|---|
| Any gameplay engine file change | Re-verify affected Layer A2 entries; update `baseball-rules-delta.md` if simulator behavior changes |
| Any docs update | Re-read the updated doc; note if delta or knowledge-map entries need revision |
| New RxDB schema version bump | Update `rxdb-persistence.md` reference; flag migration requirement in PM planning responses |
| New Playwright project added | Update `e2e-testing.md` reference in A1 |
| New manager-mode decision type added to `decisionTypes.ts` | Update A2 table; add row to delta if applicable |
| MLB rule change | Update B1 section references; update delta table |
| Monthly cadence | Spot-check all Layer A2 files for drift between source and delta table claims |

---

## Source priority when answers conflict

```
Layer A2 (source files) > Layer A1 (docs) > Layer B1 (MLB rules) > Layer B2 (summaries) > Layer C
```

When a doc says one thing and a source file says another, the source file wins. The agent should flag the discrepancy rather than silently choosing one.
