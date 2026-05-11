# BlipIt Legends — Project Context

> AI-optimized implementation rules for `maniator/blipit-legends`. Loaded as persistent facts by all bmad agents. Contains unobvious details that LLMs must be reminded of.

## Project Identity

- **Name:** BlipIt Legends (also called "Ballgame" internally)
- **Live URL:** https://blipit.net/
- **Type:** Self-playing baseball simulator PWA — fully offline-capable, no backend
- **Stack:** React 19 · TypeScript · Vite v7 · Vitest · Playwright · styled-components v6 · React Router v7 · RxDB v17 (IndexedDB) · Yarn Berry v4 · Node 24

## Critical Code Rules

### Never Break These

- **Seeded PRNG is sacred.** All randomness flows through `src/shared/utils/rng.ts` (mulberry32). Never use `Math.random()`. Same seed + same teams = identical play-by-play.
- **RxDB schema changes MUST bump `version` + add `migrationStrategies`.** Same-version schema changes cause DB6 hash mismatch for all users, blocking app startup.
- **Module cycle-free order is enforced:** `strategy → advanceRunners → gameOver → playerOut → hitBall → buntAttempt → playerActions → reducer`. No module may import from a module later in this chain.
- **Never import `GameContext` directly** — always use the `useGameContext()` hook from `@feat/gameplay/context/index`.
- **Service worker must NOT use RxDB** — RxDB is window-only.

### Import Rules

- **`Function` type is banned** — use explicit signatures: `(action: GameAction) => void`.
- **`@storage/*` alias** — always import from `@storage/db`, `@storage/types`, `@storage/hash`, `@storage/generateId`, `@storage/saveIO`; never relative paths across directories.
- **`generateId.ts` is the only source of DB IDs** — use `generateTeamId()`, `generatePlayerId()`, `generateSaveId()`. Never `Date.now()` or `Math.random()` for IDs.
- **`fnv1a` hash from `@storage/hash`** — never reimplement it.
- **`announce.ts` is a barrel re-export** — always import from `@feat/gameplay/utils/announce`; never import directly from `tts.ts` or `audio.ts`.

### Styling Rules

- **Always use `mq` helpers** from `@shared/utils/mediaQueries`: `${mq.mobile}`, `${mq.desktop}`, `${mq.tablet}`, `${mq.notMobile}`. Never write raw `@media` strings.
- **Always use `dvh` not `vh`** for modal `max-height` — `vh` ignores browser chrome on mobile.
- **Styled-components transient props** — non-HTML props must use `$propName` prefix, typed via generics: `styled.div<{ $active: boolean }>`.
- **No IIFEs in JSX** — compute values as `const` before `return`; extract non-trivial blocks into named sub-components.
- **Consult `docs/style-guide.md` before adding any new color, font size, or component shape.**

### React Conventions

- **`import * as React from "react"`** — not the default import.
- **`React.FunctionComponent` with no type param** for zero-prop components (not `React.FunctionComponent<{}>`).
- **Lazy-loaded components:** `InstructionsModal`, `SavesModal`, `DecisionPanel` use `React.lazy()` in `GameControls/index.tsx`. Do not convert to static imports.
- **Options-hash for new functions with >2 non-`state`/`log` params** — use a named options interface with destructured defaults, not positional magic numbers.

## Key Files

| Area                 | Key Files                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------- |
| Simulation engine    | `src/features/gameplay/context/reducer.ts`, `playerActions.ts`, `hitBall.ts`, `advanceRunners.ts` |
| PRNG                 | `src/shared/utils/rng.ts`                                                                         |
| RxDB persistence     | `src/storage/db.ts`, `src/features/saves/storage/saveStore.ts`                                    |
| Custom teams         | `src/features/customTeams/storage/customTeamStore.ts`                                             |
| Routes               | `src/router.tsx`                                                                                  |
| Styling theme        | `src/shared/theme.ts`, `src/shared/utils/mediaQueries.ts`                                         |
| E2E helpers          | `e2e/utils/helpers.ts`                                                                            |
| Baseball rules delta | `docs/agent/baseball-rules-delta.md`                                                              |
| PM knowledge map     | `docs/agent/pm-agent-knowledge-map.md`                                                            |
| PRD                  | `_bmad-output/planning-artifacts/prd.md`                                                          |

## Path Aliases (tsconfig)

| Alias        | Resolves to      |
| ------------ | ---------------- |
| `@feat/*`    | `src/features/*` |
| `@shared/*`  | `src/shared/*`   |
| `@storage/*` | `src/storage/*`  |
| `@test/*`    | `src/test/*`     |

## Build & Test Commands

```bash
yarn lint          # ESLint
yarn lint:fix      # ESLint with auto-fix (also sorts imports)
yarn format        # Prettier (run before every commit)
yarn typecheck     # TypeScript check for src/
yarn test          # Vitest (unit tests)
yarn test:coverage # Unit tests with coverage report
yarn build         # Production build to dist/
```

## Agent Routing

### bmad Agents (planning, design, review, implementation)

| Task                                                     | bmad Agent                           | Menu                   |
| -------------------------------------------------------- | ------------------------------------ | ---------------------- |
| Feature planning, risk review, implementation sequencing | `bmad-agent-pm` (John)               | M1                     |
| Baseball rules (MLB vs simulator)                        | `bmad-agent-pm` (John)               | M2                     |
| PR description review                                    | `bmad-agent-pm` (John)               | PR                     |
| Engineering sign-off request to architect                | `bmad-agent-pm` (John)               | SL                     |
| Gameplay realism review (logs look unrealistic)          | `bmad-agent-baseball-manager` (Buck) | RL                     |
| Post-change realism validation                           | `bmad-agent-baseball-manager` (Buck) | VR                     |
| Architecture decision, module boundary                   | `bmad-agent-architect` (Winston)     | AD                     |
| High-value change engineering sign-off                   | `bmad-agent-architect` (Winston)     | CR                     |
| Story implementation, feature coding                     | `bmad-agent-dev` (Amelia)            | —                      |
| Code review                                              | `bmad-agent-dev` (Amelia)            | bmad-code-review skill |
| Simulation correctness bug (broken/impossible state)     | `bmad-agent-dev` (Amelia)            | SC                     |
| RxDB schema change, migration                            | `bmad-agent-dev` (Amelia)            | RX                     |
| Safe refactor (behavior-preserving)                      | `bmad-agent-dev` (Amelia)            | SR                     |
| UI/styled-components implementation                      | `bmad-agent-dev` (Amelia)            | UI                     |
| E2E test authoring                                       | `bmad-agent-dev` (Amelia)            | E2E                    |
| UX design, wireframes, accessibility                     | `bmad-agent-ux-designer` (Sally)     | HR/SD                  |
| User persona interview (6 personas)                      | `bmad-agent-ux-designer` (Sally)     | P1–P6                  |
| Multi-agent deliberation                                 | `bmad-party-mode` skill              | —                      |
| PRD creation                                             | `bmad-agent-pm` (John)               | bmad-create-prd skill  |

### Operational Specialists (kept — non-obvious setup steps)

| Task                                               | Agent             | Why kept                                                                                                                   |
| -------------------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Visual snapshot baseline regen, E2E test execution | `e2e-test-runner` | Docker container correctness — baselines generated outside `mcr.microsoft.com/playwright:v1.58.2-noble` are silently wrong |
| GitHub Actions / CI workflow YAML                  | `ci-workflow`     | `copilot-setup-steps.yml` must NOT use `container:` — catastrophic, non-obvious bootstrap failure                          |
| Live QA against blipit.net                         | `playwright-prod` | Localhost reverse proxy must be started first — no other documented path to production QA                                  |

## Playwright MCP Local App Access Rule

- For Playwright MCP local-browser sessions, use the `playwright-isolated-browser_*` tools (the `playwright-isolated` MCP server, spawned with `--no-sandbox --isolated`).
- Start `npx vite preview` with `--host 0.0.0.0` so Chrome can reach it over IPv4.
- **Recommended bootstrap:** `nohup npx vite preview --port 5173 --host 0.0.0.0 >> vite-preview.log 2>&1 & disown`, wait 4 seconds, then verify with `curl -s -o /dev/null -w "HTTP %{http_code}" http://127.0.0.1:5173/`.
- The Playwright CLI `webServer` approach (e.g. `npx playwright test --config=playwright.config.ts --project=desktop`) also works and is still valid for standard E2E runs — it is no longer the _only_ option.
- Navigate the MCP browser to `http://127.0.0.1:5173` (not `localhost:5173`).
- Full rationale and troubleshooting live in `docs/e2e-testing.md` § "Starting the preview server for MCP browser automation".

> **Key config note:** The MCP server key **must** be `"playwright-isolated"` (not `"playwright"`) in GitHub repo settings → Copilot → MCP servers. The `"playwright"` name collides with the pre-started systemd service and the repo config is silently ignored, causing tools to fail.

## Sub-Agent Push Rule

Sub-agents must **never** run `git push`, `gh`, or `report_progress`. Sub-agents may create local commits, then must report the commit SHA back to the root Copilot agent so the root Copilot agent can push using `report_progress`.
