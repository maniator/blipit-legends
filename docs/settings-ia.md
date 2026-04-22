# Settings IA Spec — `/settings` Route

> **Spec type:** Design Spec (Mode 2) + IA Audit (Mode 1)
> **Related:** PR #237, followup item #233-F4
> **Owner:** `@ux-design-lead`
> **Handoff target:** `@ui-visual-snapshot` (implementation), `@e2e-test-runner` (snapshots)

---

## 1. Current IA Audit — What's in `GameControls` Today

`src/features/gameplay/components/GameControls/index.tsx` renders a single `<Controls>` panel that mixes two distinct concern categories:

### 1a. Persistent preferences (survive across games, user-level config)

| Control                                                      | localStorage key        | Default                           |
| ------------------------------------------------------------ | ----------------------- | --------------------------------- |
| Speed slider (`SPEED_STEPS`: Slow / Normal / Fast / Instant) | `speed`                 | `700` (Normal)                    |
| Announcement volume range (0–1, mute toggle)                 | `announcementVolume`    | `1`                               |
| Music/alert volume range (0–1, mute toggle)                  | `alertVolume`           | `1`                               |
| Manager Decision Values tuning panel (`decisionValues`)      | `managerDecisionValues` | `DEFAULT_MANAGER_DECISION_VALUES` |

### 1b. In-game session actions (contextual, tied to an active game)

| Control                                       | Notes                                 |
| --------------------------------------------- | ------------------------------------- |
| ← Home button                                 | Shown when `onBackToHome` is provided |
| New Game button                               | Shown when `gameOver`                 |
| 💾 Saves modal trigger                        | Save/load during active game          |
| ? Help / InstructionsModal trigger            | Contextual help                       |
| ⏸/▶ Pause / Resume button                     | Shown when `gameStarted && !gameOver` |
| Manager Mode checkbox                         | Shown when `gameStarted`              |
| Strategy selector (Balanced / Aggressive / …) | Shown inside `ManagerModeControls`    |
| Managed team selector                         | Shown inside `ManagerModeControls`    |
| Substitution trigger                          | Shown inside `ManagerModeControls`    |
| Decision Panel (steal/bunt/IBB/shift)         | Shown when `managerMode` is active    |

### 1c. Problem statement

Persistent preferences (speed, volume, `decisionValues`) do not belong in the game HUD. They:

- Clutter the in-game control surface on mobile (430 px wide) where every pixel matters.
- Are discoverable only while a game is running — new users cannot configure audio before starting.
- Require vertical scrolling on small viewports to reach the Manager Mode controls.
- Mix interaction frequencies: volume is set once per session; pause/resume is used per pitch.

**Heuristic violations:**

- **H8 (Aesthetic and minimalist design):** HUD contains controls irrelevant to current game action.
- **H7 (Flexibility and efficiency of use):** Power users cannot pre-configure settings from Home.
- **WCAG 2.4.3 (Focus Order):** Speed and volume sliders precede in-game action buttons in tab order, delaying access to Pause during gameplay (P1).

---

## 2. Proposed `/settings` Route

### What moves to `/settings`

| Setting                          | localStorage key        | Notes                                                 |
| -------------------------------- | ----------------------- | ----------------------------------------------------- |
| Speed preference                 | `speed`                 | Default speed for new games                           |
| Announcement volume              | `announcementVolume`    | Persisted across games                                |
| Music / alert volume             | `alertVolume`           | Persisted across games                                |
| Manager Decision Values defaults | `managerDecisionValues` | Tuning sliders for steal, bunt, IBB, shift thresholds |

### What stays in the game HUD

| Control                               | Rationale                                                   |
| ------------------------------------- | ----------------------------------------------------------- |
| ⏸/▶ Pause / Resume                    | Per-pitch action; must be instantly reachable               |
| Manager Mode toggle                   | Activates during active game; meaningless before game start |
| Strategy selector                     | Game-session scope; changes affect live AI decisions        |
| Managed team selector                 | Game-session scope                                          |
| Substitution panel trigger            | In-game action                                              |
| ← Home / New Game / 💾 Saves / ? Help | Navigation and session actions                              |

> **Speed in the HUD:** The Speed slider may remain in the HUD as a **quick-access override**
> (read from and write to the same `speed` localStorage key), so the user can change tempo
> mid-game without navigating away. The `/settings` page is the _canonical_ home; the HUD
> control is a secondary affordance. This is a P2 polish decision left to the implementer.

---

## 3. ASCII Wireframe — `/settings` Page

```
┌──────────────────────────────────────────────────────────────┐
│  ← Back                    ⚙ Settings                        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  AUDIO                                                       │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  🔊  Announcements  [━━━━━━━━━━━●━━━━━━━] 80%         │  │
│  │  🎵  Music          [━━━━━━━━━━━●━━━━━━━] 80%         │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  PLAYBACK                                                    │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Speed   ○ Slow  ○ Normal  ● Fast  ○ Instant           │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  MANAGER DECISIONS (defaults for new games)                  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Steal threshold    [━━━━━━━━━●━━━━━━━━━━] 45          │  │
│  │  Bunt threshold     [━━━━━━━━━●━━━━━━━━━━] 40          │  │
│  │  IBB threshold      [━━━━━━━━━●━━━━━━━━━━] 60          │  │
│  │  Shift threshold    [━━━━━━━━━●━━━━━━━━━━] 55          │  │
│  │                                    [Reset to defaults] │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Mobile layout (≤ 430 px):** Single-column stacked sections; section headers remain visible as sticky
anchors. Sliders use full-width touch targets (min height 44 px per WCAG 2.5.5). The "Reset to
defaults" button is full-width below the decision sliders.

**Desktop layout (≥ 1280 px):** Two-column grid — Audio + Playback left column, Manager Decisions
right column.

---

## 4. Transition Plan

### 4a. New route

Add `/settings` to the SPA router alongside existing routes (`/`, `/exhibition/new`,
`/saves`, `/help`, `/teams/:id/edit`).

```
/settings  →  <SettingsPage />   (new feature: src/features/settings/)
```

Nav entry: Add a ⚙ Settings link in the app shell / Home screen header area (sibling to the
existing Home page buttons). On mobile, a floating settings icon button (bottom-right, above
the scoreboard area, hidden during active game) is acceptable as a secondary affordance.

### 4b. Component extraction

Extract the following from `GameControls` into standalone components under
`src/features/settings/components/`:

```
VolumeControls      →  src/features/settings/components/VolumeControls/
SpeedPicker         →  src/features/settings/components/SpeedPicker/
DecisionValuesTuner →  src/features/settings/components/DecisionValuesTuner/
```

The `useGameControls` hook continues to read from the same localStorage keys so that settings
changed on `/settings` are immediately reflected in any active game. No data-format migration
is needed — the keys are identical.

### 4c. localStorage key registry (no rename needed)

| Key                     | Current owner     | Post-migration owner                                       |
| ----------------------- | ----------------- | ---------------------------------------------------------- |
| `speed`                 | `useGameControls` | `useSettings` (new hook); `useGameControls` reads same key |
| `announcementVolume`    | `useGameControls` | `useSettings`; `useGameControls` reads same key            |
| `alertVolume`           | `useGameControls` | `useSettings`; `useGameControls` reads same key            |
| `managerDecisionValues` | `useGameControls` | `useSettings`; `useGameControls` reads same key            |
| `managerMode`           | `useGameControls` | Stays in `useGameControls` (in-game only)                  |
| `strategy`              | `useGameControls` | Stays in `useGameControls` (in-game only)                  |
| `managedTeam`           | `useGameControls` | Stays in `useGameControls` (in-game only)                  |

**No backward-compatibility migration script is required.** All keys are identical. Any user
visiting `/settings` before a game will read and write the same values that `GameControls`
already reads. First-visit users who never open `/settings` will continue to receive defaults
from `useGameControls` unchanged.

### 4d. HUD simplification (post-settings-route launch)

Once `/settings` is live:

1. Remove `VolumeControls` component import from `GameControls/index.tsx`.
2. Remove volume-related props from `useGameControls` return value (or keep as read-only for
   the optional HUD speed override pattern described in §2).
3. Keep Speed slider in HUD as a quick-access override (same localStorage key — no sync needed).
4. Remove `decisionValues` / `resetDecisionValues` from `ManagerModeControls` props; the
   `DecisionValuesTuner` lives only on `/settings`. The live Decision Panel (steal/bunt/IBB/shift
   interrupts) is unaffected — it reads from the same `managerDecisionValues` key at runtime.

### 4e. Routing and nav integration

- Add `<Link to="/settings">` or equivalent in `AppShell` and on the Home screen.
- The `/settings` route must be reachable without an active game.
- The Back button on `/settings` returns to the previous route (use `navigate(-1)` or equivalent).
- No auth guard — settings are local and unauthenticated.

---

## 5. Risks

| Risk                                                                                                                                                                                                                | Severity | Mitigation                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Discoverability regression** — users accustomed to adjusting volume in the HUD may not find `/settings`                                                                                                           | P1       | Keep mute toggle icon (🔊/🔇) in HUD as a single-tap shortcut that writes to `announcementVolume`; full slider lives on `/settings`                                                                                                                                                          |
| **Speed slider removal from HUD** — power users change speed mid-game frequently                                                                                                                                    | P1       | Keep Speed slider in HUD (secondary affordance); `/settings` is canonical default                                                                                                                                                                                                            |
| **`managerDecisionValues` confusion** — users may not understand "defaults for new games" framing                                                                                                                   | P2       | Clear section header copy: "Manager Decisions (defaults for new games)" with tooltip/help text                                                                                                                                                                                               |
| **Snapshot churn** — removing VolumeControls from HUD changes layout snapshots for all 6 viewports                                                                                                                  | P1       | Coordinate with `@e2e-test-runner` to regenerate baselines in the same PR as implementation                                                                                                                                                                                                  |
| **Self-heal loop** — `useGameControls` currently self-heals corrupt localStorage values on mount; `useSettings` must replicate this guard                                                                           | P1       | Carry the sanitization + write-back pattern from `useGameControls` into the new `useSettings` hook                                                                                                                                                                                           |
| **Speed=0 (Instant) and volume side-effects** — `setSpeechRate` and `setAnnouncementVolume` are called inside `useGameControls` effects; extracting to `useSettings` must not break these calls during active games | P0       | `useGameControls` retains the `useEffect` calls that call `setSpeechRate` / `setAnnouncementVolume`; it reads from localStorage directly. `useSettings` writes to localStorage; `usehooks-ts` `useLocalStorage` emits storage events that re-trigger `useGameControls` effects automatically |
| **Mobile nav clutter** — adding a ⚙ Settings button to the already-compact Home screen                                                                                                                              | P2       | Use an icon-only button (⚙) with `aria-label="Settings"`; validate with `@user-casual-watcher` proxy interview before shipping                                                                                                                                                               |

---

## Design tokens used

- `theme.colors.surface` — settings card background
- `theme.colors.text` — label color
- `theme.colors.primary` — slider thumb and active radio
- `theme.colors.border` — section dividers
- `mq.sm` — stacked single-column below 430 px
- `mq.lg` — two-column grid at 1280 px

---

## Responsive behavior

| Viewport                    | Layout                                                          |
| --------------------------- | --------------------------------------------------------------- |
| `desktop` 1280×800          | Two-column grid: Audio + Playback left, Manager Decisions right |
| `tablet` 820×1180           | Single column, full-width sections                              |
| `iphone-15-pro-max` 430×739 | Single column, full-width; sticky section headers               |
| `iphone-15` 393×659         | Single column; Reset button full-width                          |
| `pixel-7` 412×839           | Single column                                                   |
| `pixel-5` 393×727           | Single column                                                   |

---

## Visual-snapshot impact prediction

Files likely to change when the HUD is simplified (VolumeControls removed):

- `e2e/tests/visual/layout.spec.ts-snapshots/layout-*-desktop-*.png`
- `e2e/tests/visual/layout.spec.ts-snapshots/layout-*-iphone-15-pro-max-*.png`
- `e2e/tests/visual/layout.spec.ts-snapshots/layout-*-iphone-15-*.png`
- `e2e/tests/visual/layout.spec.ts-snapshots/layout-*-pixel-7-*.png`
- `e2e/tests/visual/layout.spec.ts-snapshots/layout-*-pixel-5-*.png`
- `e2e/tests/visual/layout.spec.ts-snapshots/layout-*-tablet-*.png`

New baselines needed for `/settings` route (all 6 viewports × at least 1 state = 6+ new files).

---

## Pre-handoff checklist

- [x] Goal + non-goals stated
- [x] Persona(s) named (Casual Auto-Watcher, Manager-Mode Strategist, Stats-Curious Fan)
- [x] Primary flow + edge-case flows documented
- [x] Rudimentary mockup (ASCII) attached
- [x] All states covered (default / loading n/a / empty n/a / error n/a / success implicit on save)
- [x] Copy finalized (American English; sentence case; consistent baseball terms)
- [x] Accessibility: keyboard path, ARIA roles noted; contrast via `theme.colors.*`
- [x] Responsive behavior documented for all 6 Playwright viewports
- [x] Design tokens cited by theme key (no raw hex)
- [x] Visual-snapshot impact predicted
- [x] Handoff target named (`@ui-visual-snapshot` for implementation, `@e2e-test-runner` for snapshots)
