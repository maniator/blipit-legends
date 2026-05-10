---
type: bmad-distillate
sources:
  - "../../../docs/league-mode/README.md"
  - "../../../docs/league-mode/roadmap.md"
  - "../../../docs/league-mode/decisions.md"
  - "../../../docs/league-mode/data-model.md"
  - "../../../docs/league-mode/routing.md"
  - "../../../docs/league-mode/schedule-and-sim.md"
  - "../../../docs/league-mode/setup-wizard.md"
  - "../../../docs/league-mode/team-autogeneration.md"
  - "../../../docs/league-mode/fatigue-and-injuries.md"
  - "../../../docs/league-mode/leagues-hub.md"
  - "../../../docs/league-mode/playoffs-and-trades.md"
  - "../../../docs/league-mode/awards-and-archive.md"
  - "../../../docs/league-mode/multi-team-manager.md"
  - "../../../docs/league-mode/save-export.md"
  - "../../../docs/league-mode/ui-reuse.md"
  - "../../../docs/league-mode/style-guide-additions.md"
  - "../../../docs/league-mode/risks.md"
  - "../../../docs/league-mode/agent-prompts/README.md"
  - "../../../docs/league-mode/agent-prompts/v1.md"
  - "../../../docs/league-mode/agent-prompts/v2.md"
  - "../../../docs/league-mode/agent-prompts/v3.md"
  - "../../../docs/league-mode/agent-prompts/v4.md"
downstream_consumer: "League Mode v1–v4 implementation — John (bmad-agent-pm), Winston (bmad-agent-architect), Amelia (bmad-agent-dev)"
created: "2026-05-10"
token_estimate: 14000
parts: 6
---

- Distillate of all 22 League Mode planning docs (v0–v4); ~92K source tokens compressed to ~14K; lossless for implementation use
- Consumer: bmad agents (John/PM planning, Winston/Architect CR gates, Amelia/Dev implementation, Buck/Baseball-Manager realism review, Sally/UX design sign-off)
- 6 parts; each self-contained; load only the section(s) relevant to your task

## Section Manifest

| File | Contents |
| ---- | -------- |
| [01-overview-roadmap-decisions.md](01-overview-roadmap-decisions.md) | Overview, roadmap (v0–v4), version deliverables, non-negotiable contracts, locked decisions |
| [02-data-model-routing-schedule.md](02-data-model-routing-schedule.md) | Data model (all collections), roster-edit lock, routing per version, schedule generation, per-game seed derivation, concurrency model |
| [03-setup-wizard-autogen-fatigue-hub.md](03-setup-wizard-autogen-fatigue-hub.md) | Setup wizard UX, team autogeneration, pitcher fatigue/injuries (v1), leagues hub page states |
| [04-advanced-features-trades-playoffs-awards.md](04-advanced-features-trades-playoffs-awards.md) | Trades (v3), playoffs/bracket (v3), awards/archive (v4), multi-team manager mode (v4), save-export bundle format |
| [05-ui-reuse-style-risks.md](05-ui-reuse-style-risks.md) | UI reuse catalog, net-new components, style-guide-additions token requirements, consolidated risk register |
| [06-agent-prompts-execution.md](06-agent-prompts-execution.md) | Phase-by-phase execution prompts (v1–v4), acceptance criteria, agent gates |

## Cross-Cutting Items (apply to every section)

- All league randomness → src/shared/utils/rng.ts (mulberry32 seeded from masterSeed); no Math.random()
- All IDs → @storage/generateId (generateSeasonId/generateSeasonTeamId/generateSeasonGameId); never Date.now()/Math.random()
- fnv1a → @storage/hash; never reimplement
- Schema change → always bump version + add migrationStrategies; same-version edits forbidden (DB6 hash mismatch bricks all users)
- All colors/typography/button variants → docs/style-guide.md; new tokens proposed to Sally before any visual snapshots baselined
- Service worker is RxDB-free; no league background work in SW
- All imports follow path aliases: @feat/league/*, @feat/leagues/*, @shared/*, @storage/*
