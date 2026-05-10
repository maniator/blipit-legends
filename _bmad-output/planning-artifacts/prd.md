---
stepsCompleted:
  - step-01-init.md
  - step-02-discovery.md
  - step-02b-vision.md
  - step-02c-executive-summary.md
  - step-03-success.md
  - step-04-journeys.md
  - step-05-domain.md
  - step-06-innovation.md
  - step-07-project-type.md
  - step-08-scoping.md
  - step-09-functional.md
  - step-10-nonfunctional.md
  - step-11-polish.md
  - step-12-complete.md
inputDocuments:
  - docs/project-context.md
  - docs/architecture.md
  - docs/rxdb-persistence.md
  - docs/repo-layout.md
  - docs/style-guide.md
  - docs/agent/baseball-rules-delta.md
  - README.md
workflowType: prd
---

# Product Requirements Document — BlipIt Legends

**Author:** BMad
**Date:** 2026-05-10
**Project:** BlipIt Legends / Ballgame (`maniator/blipit-legends`)
**Live URL:** https://blipit.net/
**Status:** Complete (generated via `bmad-create-prd` skill, brownfield project)

---

## Executive Summary

BlipIt Legends is a **self-playing baseball simulator** that runs entirely in the browser as a Progressive Web App — no backend, no login, no configuration required. Users open the app, tap Play Ball, and watch a full 9-inning baseball game unfold pitch-by-pitch with text-to-speech commentary. Power users can enable **Manager Mode** to make real-time strategic decisions (steal, bunt, intentional walk, pinch hitter, defensive shift) at natural inflection points in the game.

The product's core differentiator is the intersection of **realism** and **effortlessness**: game outcomes follow MLB-calibrated probability distributions with full handedness matchups and pitch-type resolution, yet a casual user never needs to touch a setting. Seeded randomness makes every game fully deterministic and replayable from its seed. A custom team builder lets enthusiasts create, save, and share named rosters with per-player stat attributes.

**Current version:** Fully playable with Exhibition games, Manager Mode, custom teams, local saves, career stats, and PWA installability.

**Next horizon:** League Mode — multi-team scheduled seasons with standings and playoffs (see `docs/league-mode/`).

---

## Product Vision

### The Problem

Baseball fans who want to watch a simulated game have no middle ground between stat-heavy fantasy tools (which require deep configuration) and shallow arcade games (which feel nothing like real baseball). There is no "lean back and watch a realistic game unfold" experience built for the browser.

### The Vision

BlipIt Legends is the dugout experience in your browser. You sit back and watch a game that feels real — pitch types, platoon matchups, fatigue, baserunning, walk-off moments — or you lean forward and make manager calls at the moments that actually matter. Everything is stored locally; nothing requires an account. The game installs on your phone like a native app and works offline.

### Unique Value

- **Zero-friction start:** No login, no team selection required, game begins immediately.
- **Meaningful manager decisions:** Not every pitch — only the 8–12 decision moments per game that a real manager would actually call.
- **Replayable by design:** Every game is seeded; same seed + same teams = identical play-by-play. Saves resume mid-inning, exactly.
- **Share your team:** Custom teams export to signed JSON files that anyone can import on any device.

---

## Success Criteria

### Product Scope

BlipIt Legends is a **browser-based entertainment product** with the following scope constraints:

- **No backend** — all persistence is local (RxDB/IndexedDB) or localStorage.
- **No authentication** — single-user experience; no accounts, no sync.
- **No real MLB licensing** — all teams and players are fictitious.
- **Distribution via PWA** — no app store; users install from the browser.

### Primary Success Metrics

| Metric | Target | Measurement |
| --- | --- | --- |
| Zero-config game completion rate | Games started via default "Play Ball" complete successfully | E2E smoke test + no crash reports |
| Manager Mode decision realism | 0 "impossible state" decisions shipped | simulation-correctness agent audit + determinism E2E |
| Save round-trip fidelity | Loaded game resumes identically to auto-saved state | save-load E2E test |
| K% / BB% / HR% proximity to MLB | Within ±20% of MLB seasonal averages per 9 innings | baseball-manager realism review |
| PWA installability | Lighthouse installability score = 100 | Lighthouse CI |
| E2E test coverage | All critical user flows covered | playwright-e2e CI workflow |
| Mobile usability | All critical UI elements visible & non-overlapping on iPhone 15 and Pixel 7 portrait | responsive-smoke E2E + visual regression |

### Anti-Goals (Out of Scope)

- Cloud saves or cross-device sync
- Real MLB player/team names or logos
- iOS App Store or Google Play native apps
- Multiplayer or networked gameplay
- Server-side anything

---

## User Journeys

### Journey 1 — The Casual Auto-Watcher (Primary)

**Persona:** Opens the app on mobile, taps Play Ball, watches passively.

1. User opens https://blipit.net/ on Android.
2. Sees the Home screen with "Play Ball" as the dominant CTA.
3. Taps Play Ball → New Game dialog (pre-filled defaults).
4. Taps the "Play Ball" button in the dialog.
5. Game loads at `/game`; auto-play begins immediately at Normal speed.
6. Narration announces pitches and plays; scoreboard updates live.
7. Game completes in ~3 minutes at Fast speed; FINAL banner appears.
8. User navigates Home or starts a new game.

**Success state:** Full game completed with no required input from the user.

---

### Journey 2 — The Manager-Mode Strategist

**Persona:** Activates Manager Mode and makes decisions at key moments.

1. On the New Game dialog, selects "Manager Mode ON" and chooses a team and strategy (e.g., Aggressive).
2. Game runs on auto-play; at a key moment (e.g., runner on 1st, 0 outs, down by 1 in the 7th), the auto-play pauses.
3. Decision Panel appears with a 10-second countdown: "Steal attempt?" [Yes] [No].
4. User taps "Yes"; the steal attempt is simulated; result appears in the play log.
5. If user misses the window, auto-skip fires and the sim picks the default.
6. Game resumes. User makes 6–12 such decisions over the course of the game.

**Success state:** User feels like a manager — decisions felt meaningful and arrived at natural moments.

---

### Journey 3 — The Custom-Team Builder

**Persona:** Creates a custom team with named players and stat attributes.

1. Navigates to `/teams` → "New Team".
2. Fills in team name; adds 9 lineup players with names, handedness, contact/power/speed values.
3. Drags players to reorder the batting lineup.
4. Drags a lineup player onto the bench to swap them.
5. Adds pitchers with velocity/control/movement stats.
6. Saves the team.
7. On New Game dialog, selects the custom team as home or away.
8. Game plays with the custom roster; players' names appear in the scoreboard and log.
9. Exports the team to a JSON file; shares it with a friend who imports it on their device.

**Success state:** Custom team appears correctly in the game; export/import round-trip preserves all player data and fingerprints.

---

### Journey 4 — The Save/Replay Curator

**Persona:** Names saves and loads them to resume or review.

1. Plays a game to the 5th inning; navigates to the Saves modal in-game.
2. Names the save "Bottom 5 comeback attempt" and saves it.
3. Closes the browser; reopens the app later.
4. Navigates to `/saves`; sees the saved game with name, teams, and date.
5. Loads the save; game resumes from exactly the same state (same PRNG position, same score).
6. Exports the save as a JSON file for backup.

**Success state:** Loaded game is byte-for-byte identical to the saved state; play resumes deterministically.

---

### Journey 5 — The Stats-Curious Fan

**Persona:** Checks career stats for favorite teams and players after multiple games.

1. After several completed games, navigates to `/stats/:teamId`.
2. Sees win/loss record, run differential, batting leaders (HR, AVG, RBI), and pitching leaders (ERA, SV, K).
3. Drills into a player name → `/stats/players/:playerId` for career batting and pitching breakdown.
4. Confirms stats match what they observed in-game (no phantom RBIs, correct ERA).

**Success state:** Stats are accurate, readable on mobile, and match in-game events.

---

## Domain-Specific Requirements

### Baseball Rules Implementation

BlipIt Legends implements a subset of MLB Official Rules. Deviations are documented in `docs/agent/baseball-rules-delta.md`. Key domain requirements:

- **Inning structure:** 9 innings regulation; extra innings with tiebreak runner on 2nd base (modern MLB rule).
- **Pitch types:** Fastball, curveball, slider, changeup — each with distinct probability profiles per pitcher.
- **Plate appearance outcomes:** Single, double, triple, home run, walk, strikeout (swing/called), ground ball double play, sacrifice fly, fielder's choice.
- **Baserunning:** Automatic advancement rules; stolen base attempts with speed-based probability.
- **Handedness matchups:** R/L/S batter vs R/L pitcher — four platoon buckets with calibrated outcome multipliers.
- **Fatigue:** Pitcher fatigue model accumulates over the game, shifting outcome probabilities.
- **Win conditions:** Walk-off wins; home team does not bat in the bottom of the 9th if leading.
- **Manager Mode decisions:** Only at moments a real manager would intervene — steal, bunt (sacrifice), IBB (7th+ inning, close game, 2 outs), pinch hitter (7th+ inning, runner in scoring position, <2 outs), defensive shift, count-based swing/take choice.

### Seeded Randomness (Critical Invariant)

- All randomness flows through `src/shared/utils/rng.ts` (mulberry32 PRNG).
- Seed + team configuration → identical play-by-play, forever.
- **Any new random call inserted into the simulation changes the sequence for all existing seeds.** This must be flagged as a risk on every implementation plan.

### Data Integrity (Critical Invariant)

- Save exports use FNV-1a signature: `sig = fnv1a(RXDB_EXPORT_KEY + JSON.stringify({ header, events }))`.
- Team/player exports use FNV-1a content fingerprints for identity tracking across imports.
- RxDB schema changes must bump `version` and add `migrationStrategies`. Same-version changes cause DB6 hash mismatch, blocking all existing users from loading the app.

---

## Innovation & Novel Patterns

### Seeded Determinism as a Feature

The seeded PRNG isn't just an implementation detail — it's a user-facing feature. Users can share seeds to let friends replay the same game. This requires that **every source of randomness is routed through a single module** and that the PRNG state is persisted in saves.

### Local-First Architecture

No server means no login friction, no data privacy concerns, and offline playability. RxDB/IndexedDB provides SQL-like query semantics locally. Export/import via signed JSON files replaces cloud sync for sharing.

### Progressive Web App as Sole Distribution

By committing to PWA-only (no native app), the product ships updates instantly without app store review. The service worker handles offline caching; the manifest enables home screen installation on Android and desktop.

### Manager Mode Decision Gating

The auto-play scheduler is **speech-gated** — it won't advance to the next pitch until the TTS announcement for the previous pitch completes. This creates natural rhythm and ensures Manager Mode decisions arrive at a human-readable pace without race conditions.

---

## PWA-Specific Requirements

_(Project type: Progressive Web App — offline-capable, installable)_

### Installability

- Web App Manifest must remain well-formed: name "Ballgame", icons (192px, 512px maskable, 180px Apple touch, 32px favicon), theme_color `#000000`.
- Service worker (`src/sw.ts`) must pass Chrome Lighthouse installability audit with score 100.
- All static assets in `public/` are served at their original paths (no content hashing by Vite).

### Offline Capability

- The service worker uses `injectManifest` strategy (network-first + cache fallback).
- All app routes must work fully offline after first load.
- RxDB/IndexedDB persistence must not depend on any network request.

### Performance

- Auto-play at Fast speed must not cause frame drops or layout jank on mid-range Android (Pixel 5).
- TTS narration must not block the UI thread; auto-play scheduler is async and speech-gated.
- First Contentful Paint target: < 2 seconds on 4G.

### Notifications

- Browser notifications are **opt-in** — triggered only in Manager Mode when a decision is ready and the tab is in the background.
- Notification click navigates the user back to the game tab.
- Service worker handles `notificationclick` and posts `{ type: 'NOTIFICATION_ACTION', action, payload }` to the page.

---

## Functional Requirements

### FR-01: Game Simulation Engine

- **FR-01.1** The system shall simulate a complete 9-inning baseball game using the seeded PRNG.
- **FR-01.2** The system shall support extra innings with a tiebreak runner placed on 2nd base at the start of each extra-inning half-inning.
- **FR-01.3** The system shall resolve each pitch using the four-pitch-type pipeline (fastball, curveball, slider, changeup) with batter/pitcher stat modifiers.
- **FR-01.4** The system shall apply handedness matchup multipliers (R/L/S batter vs R/L pitcher).
- **FR-01.5** The system shall accumulate pitcher fatigue over the game and apply it to outcome probabilities.
- **FR-01.6** The system shall handle walk-off wins and the home team no-bat rule in the bottom of the final inning.
- **FR-01.7** The system shall produce play-by-play log entries for every plate appearance outcome.

### FR-02: Auto-Play & Controls

- **FR-02.1** The system shall support three auto-play speeds: Slow, Normal, Fast.
- **FR-02.2** The system shall support step-by-step mode (one pitch per user action).
- **FR-02.3** The system shall gate auto-play advancement until the current TTS announcement completes.
- **FR-02.4** The system shall persist speed, volume, and mode settings to localStorage.

### FR-03: Scoreboard & Live Stats

- **FR-03.1** The system shall display a live line score updated after each half-inning.
- **FR-03.2** The system shall display balls/strikes/outs indicators updated after each pitch.
- **FR-03.3** The system shall display live batting stats (AB, H, HR, RBI, AVG, OBP, SLG) for all batters in both lineups.
- **FR-03.4** The system shall display an EXTRA INNINGS banner when the game extends beyond 9 innings.

### FR-04: Manager Mode

- **FR-04.1** The system shall support enabling Manager Mode for one team per game.
- **FR-04.2** The system shall support five strategy selections: Balanced, Aggressive, Patient, Contact, Power.
- **FR-04.3** The system shall pause auto-play and present a Decision Panel at these moments: steal attempt, sacrifice bunt, intentional walk (7th inning+, close game, 2 outs), pinch hitter (7th inning+, runner on 2nd or 3rd, <2 outs), defensive shift, count-based swing/take choice.
- **FR-04.4** The Decision Panel shall include a 10-second countdown bar; if no decision is made, the default action fires automatically.
- **FR-04.5** The system shall send a browser notification when a decision is ready and the tab is not focused.

### FR-05: Custom Teams

- **FR-05.1** The system shall allow users to create teams with a name, lineup (9 players), bench players, and pitchers.
- **FR-05.2** Each player shall have: name, handedness (L/R/S), contact/power/speed (batters), velocity/control/movement (pitchers).
- **FR-05.3** Stat values shall be capped at defined maxima and enforced on input.
- **FR-05.4** The system shall support drag-and-drop reordering within lineup, bench, and pitchers sections.
- **FR-05.5** The system shall support drag-and-drop transfer of players between lineup and bench sections.
- **FR-05.6** The system shall assign FNV-1a content fingerprints to all team and player records.
- **FR-05.7** The system shall support exporting a team to a signed JSON file.
- **FR-05.8** The system shall support importing a team from a signed JSON file with tamper detection.
- **FR-05.9** The system shall detect duplicate players on import and present a confirmation prompt before overwriting.

### FR-06: Saves & Persistence

- **FR-06.1** The system shall auto-save game state when the user navigates away from `/game`.
- **FR-06.2** The system shall allow users to name and manage saved game slots.
- **FR-06.3** The system shall display saves at `/saves` with name, date, team identifiers, and game status.
- **FR-06.4** The system shall support loading a save and resuming the game from the exact saved state.
- **FR-06.5** The system shall support exporting a save as a signed JSON bundle.
- **FR-06.6** The system shall support importing a save from a signed JSON bundle with tamper detection.
- **FR-06.7** All game persistence shall use RxDB v17 (IndexedDB) with no server dependency.

### FR-07: Career Stats

- **FR-07.1** The system shall accumulate per-team and per-player stats across all completed games.
- **FR-07.2** Team stats page shall display: win/loss record, run differential, batting leaders (HR, AVG, RBI), pitching leaders (ERA, SV, K).
- **FR-07.3** Player stats page shall display a full career batting and pitching breakdown.
- **FR-07.4** Stats shall exactly match the events recorded in the play-by-play log.

### FR-08: PWA & Installability

- **FR-08.1** The system shall pass Chrome Lighthouse installability audit with a score of 100.
- **FR-08.2** The system shall be fully functional offline after first load.
- **FR-08.3** The service worker shall use a network-first + cache-fallback caching strategy.
- **FR-08.4** The system shall support installation on Android and desktop Chrome via the browser's "Add to Home Screen" flow.

---

## Non-Functional Requirements

### NFR-01: Performance

- **NFR-01.1** Auto-play at Fast speed shall not cause visible frame drops (< 16 ms frame time) on mid-range Android (Pixel 5, Chrome).
- **NFR-01.2** First Contentful Paint shall be < 2 seconds on a 4G connection.
- **NFR-01.3** The auto-play scheduler shall never block the main thread; all async operations (TTS, RxDB writes) shall be non-blocking.
- **NFR-01.4** RxDB event writes during a long game (500+ events) shall not degrade auto-play speed.

### NFR-02: Reliability / Data Integrity

- **NFR-02.1** Save round-trips shall be lossless — a game loaded from a save shall produce identical play-by-play as if it had never been saved (given the same PRNG state).
- **NFR-02.2** Tampered save/team imports shall be rejected with a user-visible error.
- **NFR-02.3** RxDB schema migrations shall never throw or block app startup for existing users.
- **NFR-02.4** The FNV-1a signature on save exports shall be verified on every import.

### NFR-03: Accessibility

- **NFR-03.1** All interactive controls shall be keyboard-accessible.
- **NFR-03.2** Color contrast shall meet WCAG 2.2 AA for all text and interactive elements.
- **NFR-03.3** The Decision Panel countdown bar shall have an accessible label.
- **NFR-03.4** TTS narration shall be pausable and volume-adjustable.

### NFR-04: Compatibility

- **NFR-04.1** The app shall be fully functional on the latest two versions of Chrome, Firefox, and Safari (desktop).
- **NFR-04.2** The app shall be fully functional on Android Chrome (Pixel 5, Pixel 7) and iOS Safari (iPhone 15) in portrait orientation.
- **NFR-04.3** The app shall meet `browserslist` targets defined in `package.json` (`> 0.5%, last 2 versions, not dead`).

### NFR-05: Determinism

- **NFR-05.1** Given the same seed and team configuration, the simulation shall produce byte-for-byte identical play-by-play results across all supported browsers and devices.
- **NFR-05.2** All randomness in the simulation shall flow through `src/shared/utils/rng.ts` (mulberry32). No other source of randomness is permitted.

### NFR-06: Maintainability

- **NFR-06.1** The gameplay context module dependency order (`strategy → advanceRunners → gameOver → playerOut → hitBall → buntAttempt → playerActions → reducer`) shall remain cycle-free. CI enforces this via `yarn check:circular-deps`.
- **NFR-06.2** Unit test coverage shall meet minimum thresholds: 90% lines/functions/statements, 80% branches.
- **NFR-06.3** All E2E tests shall run inside the Playwright Docker container to guarantee font and rendering parity with CI.
