# League Mode — Agent Prompts

> Companion to [`docs/league-mode/README.md`](docs/league-mode/README.md). One ready-to-use prompt per phase. Paste the full file contents into a `@pm-agent` request to start that phase's planning + implementation cycle.

| Phase | Prompt                                                                         | Goal (one line)                                                                              |
| ----- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| v1    | [`docs/league-mode/agent-prompts/v1.md`](docs/league-mode/agent-prompts/v1.md) | Foundation + pitcher fatigue — "create a small league → watch a 30-game season → champion"   |
| v2    | [`docs/league-mode/agent-prompts/v2.md`](docs/league-mode/agent-prompts/v2.md) | Standard preset (16 teams), full position-player wear, injury system + IL, transactions feed |
| v3    | [`docs/league-mode/agent-prompts/v3.md`](docs/league-mode/agent-prompts/v3.md) | Postseason bracket + trade engine, playoff fatigue rules                                     |
| v4    | [`docs/league-mode/agent-prompts/v4.md`](docs/league-mode/agent-prompts/v4.md) | Polish, awards, leaders, full preset (24/120), optional minors + carryover + archive         |

## How to use a phase prompt

1. **Read the phase prompt end-to-end.** Each one inlines the locked decisions, contracts, agent route, and acceptance criteria for that phase. You should not need to re-derive scope from `docs/league-mode/roadmap.md`.
2. **Confirm prerequisites** listed at the top of the prompt are merged. Phases are sequential — v3 does not start until v2 is shipped, with one explicit exception called out per prompt.
3. **Paste into `@pm-agent`.** PM produces an implementation plan, hands off execution to the named specialist agent (per [`.github/agents/README.md`](.github/agents/README.md) routing).
4. **`@senior-lead` gate.** Each phase declares which sub-decisions require `@senior-lead` APPROVE/BLOCK before code lands.

## Editing rules

- Prompts are **the executable form of the plan**. If a contract changes in a sibling doc (`docs/league-mode/decisions.md`, `docs/league-mode/data-model.md`, etc.), **update the corresponding phase prompt in the same PR**. Drift between prompts and the design docs is the failure mode this directory exists to prevent.
- New net-new visual components must be cleared with `@ux-design-lead` (and added to [`docs/league-mode/style-guide-additions.md`](docs/league-mode/style-guide-additions.md)) before the relevant phase prompt is updated to require them.
- Every phase prompt closes with explicit, testable acceptance criteria mirrored from `docs/league-mode/roadmap.md`. Update both together.
