> This section covers Overview, roadmap (v0–v4), version deliverables, non-negotiable contracts, and locked decisions. Part 1 of 6.

## Status & Scope Boundary
- Status: planning only; zero League Mode code shipped; docs are single source of truth
- Five phases: v0 (docs rewrite, no code), v1–v4 (shippable increments)
- Out of scope v0–v4: salaries/payroll, free agency/waivers, player aging, MLB roster import, networked multi-user, custom award definitions, doubleheaders/rainouts, skip/forfeit semantics, public share routes, trade-history-by-player, cross-season Hall of Fame, selective save-bundle import

## Version Deliverables

### v1 — Foundation + Pitcher Fatigue
- Goal: complete Mini-preset season loop (create → watch 30 games → standings → champion)
- Setup wizard: Mini preset only (8 teams); 30-game sprint season; per-league DH toggle; master seed (random default)
- Team autogeneration: all four naming themes v1 — Classic (city+animal), Sci-fi (planet+role), Whimsical (food+verb), Random mix; Mixed mode default; autogen teams promoted into customTeams at setup
- New RxDB collections (v1): seasons, seasonTeams, seasonGames, seasonPlayerState (pitcher availability only)
- Schedule: deterministic round-robin, series-based, byes for odd team counts
- Pitcher fatigue: rest-day tracking; ~12% effect cap; pill badge (🟢 Fresh / 🟡 Tired / 🔴 Spent); hover tooltip ("X days rest, availability Y%"); Spent SP ineligible to start
- Headless sim loop: sequential, RNG-deterministic, idempotent; "sim to next user game"
- Manager Mode: user team only; all other teams use existing AI strategy
- Roster minimum v1: 9 lineup + 3 bench + 5 SP + 3 RP = 20 active

### v2 — Realism: Full Rosters, Wear, Injuries
- Standard preset (16 teams, 2 leagues × 2 divisions, 60 games)
- Position-player wear added to seasonPlayerState (~5% effect); injury system: 1.5% per active-lineup player-game; IL collection; bench-fill replacement
- seasonTransactions collection (forward-compatible with v3 trade kinds)
- Roster minimum v2+: 9 lineup + 5 bench + 5 SP + 4 RP = 23 active

### v3 — Postseason & Trades
- Trade engine: manual + AI; deadline default 70%, configurable; moderate AI default (~2–3 trades/team/season)
- Playoff bracket: 4 teams/league; WC bo3 / LCS bo5 / BCS bo7; presets Short (1/3/5) and Long (5/7/7); reseed after each round
- Tiebreaker chain: head-to-head → intra-division → run diff vs tied group → full-season run diff → seeded coin flip

### v4 — Polish, Awards, Full Preset
- Full preset (24 teams, Marathon 120-game season)
- Five awards per league: MVP, Cy Young, Reliever of the Year, Rookie of the Year, Manager of the Year; formula breakdown surfaced
- Optional minor-league call-ups; optional offseason carryover toggle; "Sim full season" mode with progress bar
- Multi-team manager mode toggle (off by default); season archival (v4 only if doc count exceeds budget)
- Feature-flagged: featureFlags.shareableSeasonSeeds, featureFlags.allowReplay (both default off)

## Non-Negotiable Contracts
- One team library: all teams in existing customTeams collection; no separate "league teams" collection
- Roster-edit lock: customTeams doc locked while referenced by active season; enforced at storage layer (write guard), not just UI
- UI reuse first: no new visual language; every screen reuses existing components before building new
- Seed contract: deriveScheduledGameSeed(seasonId, seasonGameId) → fnv1a(input) → parseInt(hex,16)>>>0 → base-36; NEVER pass raw colon-joined string to reinitSeed
- Schema evolution: every change bumps version + ships migrationStrategies; same-version edits forbidden (DB6 hash mismatch)
- Single active season; determinism via mulberry32 seeded from masterSeed; no Math.random() in league code
- Feature-flag snapshot: frozen onto season doc at creation; mid-season toggle = no-op
- RxDB collection cap: 12 steady-state (v4); pinned rxdb@17.0.0-beta.7 (cap=16); seasonAwards folded into seasons.awards[]; seasonArchives lazy-opened

## Locked Decisions (key)
- #1/#2: Sizes (Mini/Standard/Full) and lengths (Sprint/Standard/Marathon) by preset only; no custom counts
- #5: DH per-league at setup; interleague uses home team's rule
- #7b: Roster-edit lock at storage layer; #8: One active season; wizard refuses if active exists
- #9: Injury rate 1.5%/game/active-lineup player (×0.5 playoffs); bench excluded; pinned to rulesetVersion
- #10: StatusPill: 🟢 Fresh / 🟡 Tired / 🔴 Spent; tooltip "X days rest, availability Y%"
- #11: Fatigue ~12% cap; wear ~5%; post-launch tuning by Buck → rulesetVersion bump
- #12: AI rest — SP ≥0.70, RP ≥0.35 (strict); position players restProb = clamp((wear−6)/4, 0, 1)
- #13: v1 min 20 (9+3+5+3); v2+ min 23 (9+5+5+4); approved by Buck
- #14: Trade deadline default 70%; configurable 50%–100%; #15: AI default moderate; #16: no user veto on AI↔AI
- #17: 4 teams/league; WC/LCS/BCS; Short/Long presets; #18: full tiebreaker chain; seeded coin flip
- #22: Archival v4 only if measured; #23: replays test-only v1–v3; v4 behind featureFlags.allowReplay
- A2: default Mixed mode; A4: all four themes v1; A7: autogen.version on every generated doc; A8: parity slider
