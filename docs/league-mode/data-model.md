# League Mode — Data Model & RxDB Migration Plan

> See [README.md](README.md) for decisions log. See [`docs/rxdb-persistence.md`](../rxdb-persistence.md) for the global RxDB rules.

---

## Overview of Changes to the DB

League Mode touches the RxDB layer in two ways:

| Change type | What changes | Migration needed? |
|---|---|---|
| **Additive field on existing collection** | `teams` gets `activeLeagueId` | Yes — bump `teams` version, add identity migration strategy |
| **Additive field on existing collection** | `completedGames` gets `leagueSeasonId`, `scheduledGameId`, `gameType` | Yes — bump `completedGames` version, add identity migration strategy |
| **New collections (net-new)** | `leagues`, `leagueSeasons`, `scheduledGames`, `tradeRecords` | None — no old docs exist to migrate |

---

## Epoch Bump vs. RxDB Migrations — Pick One

This is the central implementation decision for the persistence layer. Both approaches work. Neither is objectively "correct" — the right choice depends on where the app is in its lifecycle when League Mode ships.

---

### Option A — Bump `BETA_SCHEMA_EPOCH`

**Current value:** `"v1.2"` (in `src/storage/db.ts`)  
**New value:** e.g. `"v1.3"`

When the app loads and detects a different epoch string in `localStorage`, it **wipes the entire `ballgame` IndexedDB** and recreates it from scratch with the new schemas. All saves, custom teams, exhibition stats, and any other user data are permanently deleted.

#### How it works

1. Change `BETA_SCHEMA_EPOCH` from `"v1.2"` to `"v1.3"` in `src/storage/db.ts`.
2. Keep all existing collection schemas at their current `version: 0` — no migration strategies needed.
3. Add the four new league collections as `version: 0` with no migration strategies.
4. Done — RxDB sees a fresh DB with no legacy documents.

#### Tradeoffs

| | |
|---|---|
| ✅ **Zero migration code** | No per-collection strategies to write or test. Simpler implementation. |
| ✅ **No schema-hash risk** | A fresh DB can never hit the DB6 (schema mismatch) error. |
| ✅ **Fastest path** | A one-line change in `db.ts` handles all collections at once. |
| ❌ **Destroys all user data** | Exhibition saves, custom teams, career stats — everything is gone. Users who invested time in their teams or game history lose it all on the next app load. |
| ❌ **Last acceptable use** | The epoch mechanism exists as a **beta-only escape hatch**. Once the app has real users with real data, another epoch bump would be a serious UX failure. This is the last time it can reasonably be used. |
| ❌ **Export/import doesn't help much** | Users have no warning before the wipe; they can't export first unless they happen to have done so already. |

**When to choose this:** League Mode ships while the app is still in closed/early beta with a small user base that is fully aware data may be wiped. The team decides user data loss is acceptable at this stage.

---

### Option B — RxDB Per-Collection Migration Strategies

Each existing collection that changes gets its `version` bumped by 1 and a corresponding migration strategy. New collections start at `version: 0` with no strategies. The epoch value **stays at `"v1.2"`** — no wipe occurs.

#### How it works

1. Leave `BETA_SCHEMA_EPOCH = "v1.2"` unchanged.
2. Bump `teams` schema from `version: 0` → `version: 1`; add `migrationStrategies: { 1: (doc) => ({ ...doc, activeLeagueId: doc.activeLeagueId ?? null }) }`.
3. Bump `completedGames` schema from `version: 0` → `version: 1`; add a strategy that backfills `leagueSeasonId: null`, `scheduledGameId: null`, `gameType: "EXHIBITION"`.
4. Add the four new league collections at `version: 0` — RxDB creates them fresh with no migration needed.
5. Write unit tests for each migration (see the test pattern at the bottom of this doc).

#### Tradeoffs

| | |
|---|---|
| ✅ **User data preserved** | Saves, custom teams, exhibition career stats all survive the update. |
| ✅ **Production-safe pattern** | This is the correct long-term approach for any released app. Sets the right precedent. |
| ✅ **Proven within this codebase** | The `customTeams` collection has already gone through v0→v1→v2→v3 migrations successfully. The pattern is well-understood. |
| ❌ **More code to write** | Two migration strategies + two unit tests. Low complexity but non-zero effort. |
| ❌ **Must not change `required` fields** | Adding `activeLeagueId` as optional (`activeLeagueId?: string \| null`) is safe. Adding it to `required` at the same time would change the schema hash and cause DB6 for anyone who somehow got stuck between versions. Keep new fields optional. |
| ❌ **Migration must never throw** | Defensive coding required: always use `?? default` on every backfilled field, never assume old docs are complete. |

**When to choose this:** Any time user data has real value — or when the team wants to establish the correct migration discipline before the app leaves beta. Strongly recommended if there is any doubt about the epoch-bump approach.

---

### Recommendation

> **If League Mode ships while the app is still clearly in early beta with no meaningful user data:** use the epoch bump (Option A) — it's fast, clean, and this is genuinely the last opportunity to use it without causing harm.
>
> **If any users have invested time in custom teams or exhibition stats they would miss:** use per-collection migrations (Option B) — two strategies and two tests is a small price to pay for not destroying their work.
>
> **After League Mode ships:** the epoch mechanism must not be used again. All future schema changes — including later League Mode schema updates — must use `version` bumps and migration strategies regardless of which option was chosen here.

The schema code in this document is written for **Option B** (migrations) because it is the safer default and establishes the right long-term pattern. If Option A is chosen instead, remove all `migrationStrategies` blocks and change `version: 1` back to `version: 0` in the modified collections, then bump `BETA_SCHEMA_EPOCH`.

---

## Modified Existing Collections

### 1. `teams` — bump to version 1

**New field:** `activeLeagueId: string | null`  
**Purpose:** Enforces team exclusivity — a team may only be in one active league at a time.

#### Updated TypeScript type (`src/features/customTeams/storage/types.ts`)

```ts
export interface TeamRecord {
  // ... all existing fields unchanged ...

  /**
   * FK → LeagueRecord.id of the league this team is currently active in.
   * null = the team is not in any active league and may be freely assigned.
   * Set at league creation; cleared when the league season completes or the league is disbanded.
   */
  activeLeagueId?: string | null;
}
```

#### Updated schema (`src/features/customTeams/storage/schemaV1.ts`)

```ts
const teamsSchemaV1: RxJsonSchema<TeamRecord> = {
  version: 1,           // ← bumped from 0
  primaryKey: "id",
  type: "object",
  properties: {
    // ... all existing properties unchanged ...
    activeLeagueId: { type: ["string", "null"], maxLength: 128 },
  },
  required: ["id", "schemaVersion", "createdAt", "updatedAt", "name", "nameLowercase", "metadata"],
  indexes: ["updatedAt", "nameLowercase"],
};

export const teamsV1CollectionConfig = {
  schema: teamsSchemaV1,
  migrationStrategies: {
    1: (oldDoc: TeamRecord) => ({
      ...oldDoc,
      activeLeagueId: oldDoc.activeLeagueId ?? null,
    }),
  },
};
```

---

### 2. `completedGames` — bump to version 1

**New fields:**
- `leagueSeasonId: string | null` — FK to `LeagueSeasonRecord.id`; null for exhibition games
- `scheduledGameId: string | null` — FK to `ScheduledGameRecord.id`; null for exhibition games
- `gameType: "EXHIBITION" | "LEAGUE_REGULAR" | "LEAGUE_PLAYOFF"` — discriminator for stats filtering

#### Updated TypeScript type (`src/features/careerStats/storage/types.ts`)

```ts
export interface CompletedGameRecord {
  // ... all existing fields unchanged ...

  /**
   * FK → LeagueSeasonRecord.id. null for exhibition games.
   * Present on any game played within a league context.
   */
  leagueSeasonId?: string | null;

  /**
   * FK → ScheduledGameRecord.id. null for exhibition games.
   * Links the result back to the scheduled slot for standings computation.
   */
  scheduledGameId?: string | null;

  /**
   * Discriminator for the type of game.
   * - "EXHIBITION" = one-off game outside any league
   * - "LEAGUE_REGULAR" = regular-season game in a league
   * - "LEAGUE_PLAYOFF" = playoff game in a league
   * Absent on old records — treat as "EXHIBITION" in queries.
   */
  gameType?: "EXHIBITION" | "LEAGUE_REGULAR" | "LEAGUE_PLAYOFF";
}
```

#### Updated schema (`src/features/careerStats/storage/schemaV1.ts`)

```ts
const completedGamesSchemaV1: RxJsonSchema<CompletedGameRecord> = {
  version: 1,           // ← bumped from 0
  primaryKey: "id",
  type: "object",
  properties: {
    // ... all existing properties unchanged ...
    leagueSeasonId:  { type: ["string", "null"], maxLength: 128 },
    scheduledGameId: { type: ["string", "null"], maxLength: 128 },
    gameType: {
      type: "string",
      enum: ["EXHIBITION", "LEAGUE_REGULAR", "LEAGUE_PLAYOFF"],
      maxLength: 32,
    },
  },
  required: [
    "id", "playedAt", "seed", "rngState",
    "homeTeamId", "awayTeamId", "homeScore", "awayScore",
    "innings", "schemaVersion",
  ],
  indexes: [
    "playedAt",
    ["homeTeamId", "playedAt"],
    ["awayTeamId", "playedAt"],
    ["leagueSeasonId", "playedAt"],  // ← new index for standings queries
  ],
};

export const completedGamesV1CollectionConfig = {
  schema: completedGamesSchemaV1,
  migrationStrategies: {
    1: (oldDoc: CompletedGameRecord) => ({
      ...oldDoc,
      leagueSeasonId:  oldDoc.leagueSeasonId  ?? null,
      scheduledGameId: oldDoc.scheduledGameId ?? null,
      gameType:        oldDoc.gameType        ?? "EXHIBITION",
    }),
  },
};
```

---

## New Collections

### 3. `leagues` — version 0 (net-new)

**Purpose:** League header — name, team membership list, division layout, season configuration defaults.

#### TypeScript type (`src/features/leagues/storage/types.ts`)

```ts
export type DivisionRecord = {
  id: string;        // e.g. "div_east", "div_west"
  name: string;
  teamIds: string[]; // ordered list of FK → TeamRecord.id
};

export interface LeagueRecord {
  /** Primary key — generated via generateLeagueId() from @storage/generateId */
  id: string;
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
  name: string;
  /** Lowercase name for O(1) indexed dedup lookup. */
  nameLowercase: string;
  /** All team IDs participating in this league (flat list; also present per-division). */
  teamIds: string[];
  /**
   * Division assignments. Length 2 or 4.
   * If the league has no divisions, this is an empty array [].
   */
  divisions: DivisionRecord[];
  /** Number of divisions (0 = no divisions, 2 or 4). */
  divisionCount: 0 | 2 | 4;
  /** Default season preset for new seasons in this league. */
  defaultSeasonPreset: "QUICK" | "SHORT" | "STANDARD" | "FULL" | "CUSTOM";
  /** Only meaningful when defaultSeasonPreset is "CUSTOM". */
  defaultCustomGameCount?: number;
  /** Default number of games per series (usually 3). */
  defaultSeriesLength: number;
  /** Default playoff format — applied to every new season unless overridden. */
  defaultPlayoffFormat: PlayoffFormat;
  /** Number of teams that advance to playoffs per season. */
  defaultPlayoffTeamCount: number;
  /** Whether to apply division-weighted scheduling (division rivals get ~1.4× matchups). */
  divisionWeightedSchedule: boolean;
  /** "ACTIVE" while at least one season is in progress; "INACTIVE" when no seasons are running. */
  status: "ACTIVE" | "INACTIVE";
}

export type PlayoffFormat = {
  seriesLength: 3 | 5 | 7;
  /** true = single-elimination bracket (default). false = double-elimination (future). */
  singleElimination: boolean;
};
```

#### RxDB Schema

```ts
const leaguesSchemaV1: RxJsonSchema<LeagueRecord> = {
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    id:                         { type: "string", maxLength: 128 },
    schemaVersion:              { type: "number", minimum: 0, maximum: 999, multipleOf: 1 },
    createdAt:                  { type: "string", maxLength: 32 },
    updatedAt:                  { type: "string", maxLength: 32 },
    name:                       { type: "string", maxLength: 256 },
    nameLowercase:              { type: "string", maxLength: 256 },
    teamIds:                    { type: "array", items: { type: "string" } },
    divisions:                  { type: "array", items: { type: "object", additionalProperties: true } },
    divisionCount:              { type: "number", enum: [0, 2, 4], multipleOf: 1 },
    defaultSeasonPreset:        { type: "string", maxLength: 32 },
    defaultCustomGameCount:     { type: "number", minimum: 4, maximum: 200, multipleOf: 1 },
    defaultSeriesLength:        { type: "number", minimum: 1, maximum: 7, multipleOf: 1 },
    defaultPlayoffFormat:       { type: "object", additionalProperties: true },
    defaultPlayoffTeamCount:    { type: "number", minimum: 2, maximum: 16, multipleOf: 1 },
    divisionWeightedSchedule:   { type: "boolean" },
    status:                     { type: "string", maxLength: 16 },
  },
  required: [
    "id", "schemaVersion", "createdAt", "updatedAt",
    "name", "nameLowercase", "teamIds", "divisions", "divisionCount",
    "defaultSeasonPreset", "defaultSeriesLength", "defaultPlayoffFormat",
    "defaultPlayoffTeamCount", "divisionWeightedSchedule", "status",
  ],
  indexes: ["updatedAt", "nameLowercase", "status"],
};
```

---

### 4. `leagueSeasons` — version 0 (net-new)

**Purpose:** One document per season of a league. Tracks schedule length, trade deadline, playoff config, and current status.

#### TypeScript type

```ts
export type LeagueSeasonStatus =
  | "SCHEDULED"    // Created but no games played yet
  | "IN_PROGRESS"  // Regular season underway
  | "TRADE_DEADLINE_PASSED"  // Past the deadline game-day threshold
  | "PLAYOFFS"     // All regular-season games complete; playoffs running
  | "COMPLETE";    // Champion crowned, season over

export interface LeagueSeasonRecord {
  /** Primary key — e.g. "ls_<fnv1a>" from generateLeagueSeasonId() */
  id: string;
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
  /** FK → LeagueRecord.id */
  leagueId: string;
  /** 1-based season number within the league. */
  seasonNumber: number;
  /** Current lifecycle status. */
  status: LeagueSeasonStatus;
  /** Total regular-season games per team. */
  gamesPerTeam: number;
  /** The "game day" number (1-based) after which trades are not allowed. */
  tradeDeadlineGameDay: number;
  /** The current highest completed game day across all matchups. */
  currentGameDay: number;
  /** Playoff configuration for this season. */
  playoffFormat: PlayoffFormat;
  /** Number of teams advancing to playoffs. */
  playoffTeamCount: number;
  /** FK → TeamRecord.id — set when status = "COMPLETE". null otherwise. */
  championTeamId: string | null;
  /**
   * Snapshot of team IDs and division assignments at season start.
   * Preserved so historical browsing shows the correct rosters even after
   * league membership changes in a later season.
   */
  teamIdsAtStart: string[];
  divisionsAtStart: DivisionRecord[];
}
```

#### RxDB Schema

```ts
const leagueSeasonsSchemaV1: RxJsonSchema<LeagueSeasonRecord> = {
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    id:                    { type: "string", maxLength: 128 },
    schemaVersion:         { type: "number", minimum: 0, maximum: 999, multipleOf: 1 },
    createdAt:             { type: "string", maxLength: 32 },
    updatedAt:             { type: "string", maxLength: 32 },
    leagueId:              { type: "string", maxLength: 128 },
    seasonNumber:          { type: "number", minimum: 1, maximum: 9999, multipleOf: 1 },
    status:                { type: "string", maxLength: 32 },
    gamesPerTeam:          { type: "number", minimum: 4, maximum: 200, multipleOf: 1 },
    tradeDeadlineGameDay:  { type: "number", minimum: 1, maximum: 200, multipleOf: 1 },
    currentGameDay:        { type: "number", minimum: 0, maximum: 200, multipleOf: 1 },
    playoffFormat:         { type: "object", additionalProperties: true },
    playoffTeamCount:      { type: "number", minimum: 2, maximum: 16, multipleOf: 1 },
    championTeamId:        { type: ["string", "null"], maxLength: 128 },
    teamIdsAtStart:        { type: "array", items: { type: "string" } },
    divisionsAtStart:      { type: "array", items: { type: "object", additionalProperties: true } },
  },
  required: [
    "id", "schemaVersion", "createdAt", "updatedAt",
    "leagueId", "seasonNumber", "status", "gamesPerTeam",
    "tradeDeadlineGameDay", "currentGameDay", "playoffFormat",
    "playoffTeamCount", "championTeamId", "teamIdsAtStart", "divisionsAtStart",
  ],
  indexes: ["leagueId", ["leagueId", "seasonNumber"], "status"],
};
```

---

### 5. `scheduledGames` — version 0 (net-new)

**Purpose:** One document per scheduled game slot. Both regular-season and playoff slots live in this collection; `gameType` discriminates.

#### TypeScript type

```ts
export type ScheduledGameStatus = "PENDING" | "COMPLETED" | "CANCELLED";

export interface ScheduledGameRecord {
  /** Primary key — e.g. "sg_<fnv1a>" from generateScheduledGameId() */
  id: string;
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
  /** FK → LeagueSeasonRecord.id */
  leagueSeasonId: string;
  /** FK → LeagueRecord.id (denormalized for query convenience). */
  leagueId: string;
  homeTeamId: string;
  awayTeamId: string;
  /** 1-based game day number — all games with the same gameDay are the "current day". */
  gameDay: number;
  /** Series identifier — groups all games in the same series (e.g. "series_teamA_teamB_1"). */
  seriesId: string;
  /** Game number within the series (1, 2, 3, etc.). */
  seriesGameNumber: number;
  gameType: "REGULAR" | "PLAYOFF";
  /** Playoff round number (1 = first round, 2 = semifinals, etc.). Only set when gameType = PLAYOFF. */
  playoffRound?: number;
  status: ScheduledGameStatus;
  /**
   * FK → CompletedGameRecord.id. Set when status = COMPLETED.
   * null when status is PENDING or CANCELLED.
   */
  completedGameId: string | null;
  /**
   * Result summary written at completion for quick display without joining completedGames.
   * null when status is PENDING or CANCELLED.
   */
  result: {
    homeScore: number;
    awayScore: number;
    innings: number;
    notableEvents?: string[];
  } | null;
  /**
   * Whether the user flagged this game to Watch/Manage instead of sim.
   * Bulk-simulate will prompt before simming a flagged game.
   */
  flaggedForWatch: boolean;
}
```

#### RxDB Schema

```ts
const scheduledGamesSchemaV1: RxJsonSchema<ScheduledGameRecord> = {
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    id:               { type: "string", maxLength: 128 },
    schemaVersion:    { type: "number", minimum: 0, maximum: 999, multipleOf: 1 },
    createdAt:        { type: "string", maxLength: 32 },
    updatedAt:        { type: "string", maxLength: 32 },
    leagueSeasonId:   { type: "string", maxLength: 128 },
    leagueId:         { type: "string", maxLength: 128 },
    homeTeamId:       { type: "string", maxLength: 128 },
    awayTeamId:       { type: "string", maxLength: 128 },
    gameDay:          { type: "number", minimum: 1, maximum: 999, multipleOf: 1 },
    seriesId:         { type: "string", maxLength: 256 },
    seriesGameNumber: { type: "number", minimum: 1, maximum: 7, multipleOf: 1 },
    gameType:         { type: "string", maxLength: 16 },
    playoffRound:     { type: "number", minimum: 1, maximum: 8, multipleOf: 1 },
    status:           { type: "string", maxLength: 16 },
    completedGameId:  { type: ["string", "null"], maxLength: 128 },
    result:           { type: ["object", "null"], additionalProperties: true },
    flaggedForWatch:  { type: "boolean" },
  },
  required: [
    "id", "schemaVersion", "createdAt", "updatedAt",
    "leagueSeasonId", "leagueId", "homeTeamId", "awayTeamId",
    "gameDay", "seriesId", "seriesGameNumber", "gameType",
    "status", "completedGameId", "result", "flaggedForWatch",
  ],
  indexes: [
    ["leagueSeasonId", "gameDay"],
    ["leagueSeasonId", "status"],
    ["seriesId", "seriesGameNumber"],
    "status",
  ],
};
```

---

### 6. `tradeRecords` — version 0 (net-new)

**Purpose:** Immutable audit log of every executed trade. Never updated after creation.

#### TypeScript type

```ts
export interface TradePlayerMove {
  playerId: string;
  nameAtTradeTime: string;
  fromTeamId: string;
  toTeamId: string;
}

export interface TradeRecord {
  /** Primary key — e.g. "tr_<fnv1a>" from generateTradeId() */
  id: string;
  schemaVersion: number;
  createdAt: string;
  /** FK → LeagueSeasonRecord.id */
  leagueSeasonId: string;
  /** FK → LeagueRecord.id (denormalized). */
  leagueId: string;
  /** The two team IDs involved in the trade. Always length 2. */
  teamIds: [string, string];
  /** Every player moved in the trade (can be 1-for-1 or multi-player). */
  playerMoves: TradePlayerMove[];
  /** Game day number at the time the trade was executed. */
  gameDayAtTrade: number;
}
```

#### RxDB Schema

```ts
const tradeRecordsSchemaV1: RxJsonSchema<TradeRecord> = {
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    id:              { type: "string", maxLength: 128 },
    schemaVersion:   { type: "number", minimum: 0, maximum: 999, multipleOf: 1 },
    createdAt:       { type: "string", maxLength: 32 },
    leagueSeasonId:  { type: "string", maxLength: 128 },
    leagueId:        { type: "string", maxLength: 128 },
    teamIds:         { type: "array", items: { type: "string" }, minItems: 2, maxItems: 2 },
    playerMoves:     { type: "array", items: { type: "object", additionalProperties: true } },
    gameDayAtTrade:  { type: "number", minimum: 0, maximum: 9999, multipleOf: 1 },
  },
  required: [
    "id", "schemaVersion", "createdAt",
    "leagueSeasonId", "leagueId", "teamIds", "playerMoves", "gameDayAtTrade",
  ],
  indexes: ["leagueSeasonId", ["leagueId", "createdAt"]],
};
```

---

## `db.ts` Changes Summary

The `DbCollections` type and `addCollections` call are the same regardless of which epoch/migration path is chosen. The only line that differs is whether `BETA_SCHEMA_EPOCH` is bumped.

```ts
// 1. Add to DbCollections type (same for both Option A and Option B)
export type DbCollections = {
  saves:            RxCollection<SaveRecord>;
  events:           RxCollection<EventRecord>;
  teams:            RxCollection<TeamRecord>;
  players:          RxCollection<PlayerRecord>;
  completedGames:   RxCollection<CompletedGameRecord>;
  batterGameStats:  RxCollection<BatterGameStatRecord>;
  pitcherGameStats: RxCollection<PitcherGameStatRecord>;
  // ↓ New
  leagues:          RxCollection<LeagueRecord>;
  leagueSeasons:    RxCollection<LeagueSeasonRecord>;
  scheduledGames:   RxCollection<ScheduledGameRecord>;
  tradeRecords:     RxCollection<TradeRecord>;
};

// 2a. OPTION A — epoch bump (destroys all user data, no migrations needed)
const BETA_SCHEMA_EPOCH = "v1.3";  // was "v1.2" — wipes DB on next load

// 2b. OPTION B — migrations only (user data preserved, leave epoch unchanged)
const BETA_SCHEMA_EPOCH = "v1.2";  // unchanged — migrations handle everything

// 3. Add imports for new schema configs (same for both options)
import {
  leaguesV1CollectionConfig,
  leagueSeasonsV1CollectionConfig,
  scheduledGamesV1CollectionConfig,
  tradeRecordsV1CollectionConfig,
} from "@feat/leagues/storage/schemaV1";

// 4. Add to addCollections() call inside initDb() (same for both options)
await db.addCollections({
  // ... existing collections (with updated version numbers if Option B) ...
  leagues:        leaguesV1CollectionConfig,
  leagueSeasons:  leagueSeasonsV1CollectionConfig,
  scheduledGames: scheduledGamesV1CollectionConfig,
  tradeRecords:   tradeRecordsV1CollectionConfig,
});
```

---

## `generateId.ts` Changes

Add three new ID generators to `src/storage/generateId.ts` (alongside existing `generateTeamId`, `generateSaveId`, etc.):

```ts
export const generateLeagueId        = () => `lg_${generateId()}`;
export const generateLeagueSeasonId  = () => `ls_${generateId()}`;
export const generateScheduledGameId = () => `sg_${generateId()}`;
export const generateTradeId         = () => `tr_${generateId()}`;
```

---

## ER Diagram

```mermaid
erDiagram
    TeamRecord {
        string id PK
        string name
        string nameLowercase
        string activeLeagueId FK "null if not in a league"
    }

    LeagueRecord {
        string id PK
        string name
        string[] teamIds FK
        DivisionRecord[] divisions
        string status
        PlayoffFormat defaultPlayoffFormat
    }

    LeagueSeasonRecord {
        string id PK
        string leagueId FK
        number seasonNumber
        string status
        number gamesPerTeam
        number tradeDeadlineGameDay
        number currentGameDay
        string championTeamId FK "null until complete"
    }

    ScheduledGameRecord {
        string id PK
        string leagueSeasonId FK
        string leagueId FK
        string homeTeamId FK
        string awayTeamId FK
        number gameDay
        string seriesId
        string status
        string completedGameId FK "null until played"
        boolean flaggedForWatch
    }

    CompletedGameRecord {
        string id PK
        string leagueSeasonId FK "null for exhibition"
        string scheduledGameId FK "null for exhibition"
        string gameType
        string homeTeamId FK
        string awayTeamId FK
        number homeScore
        number awayScore
    }

    TradeRecord {
        string id PK
        string leagueSeasonId FK
        string leagueId FK
        string[] teamIds FK
        TradePlayerMove[] playerMoves
    }

    BatterGameStatRecord {
        string id PK
        string gameId FK
        string teamId FK
        string playerId FK
    }

    PitcherGameStatRecord {
        string id PK
        string gameId FK
        string teamId FK
        string playerId FK
    }

    LeagueRecord ||--o{ LeagueSeasonRecord : "has seasons"
    LeagueRecord }o--o{ TeamRecord : "contains teams"
    TeamRecord }o--o| LeagueRecord : "activeLeagueId"
    LeagueSeasonRecord ||--o{ ScheduledGameRecord : "has game slots"
    ScheduledGameRecord ||--o| CompletedGameRecord : "result"
    CompletedGameRecord ||--o{ BatterGameStatRecord : "batter stats"
    CompletedGameRecord ||--o{ PitcherGameStatRecord : "pitcher stats"
    LeagueSeasonRecord ||--o{ TradeRecord : "trade history"
```

---

## Migration Test Pattern

For each modified existing collection, a migration test must be written. Follow the existing pattern in `src/storage/db.test.ts`:

```ts
describe("schema migration: teams v0 → v1", () => {
  it("backfills activeLeagueId = null on old team documents", async () => {
    // 1. Create DB with v0 teams schema
    const db = await createTestDbAtVersion("teams", 0);

    // 2. Insert a v0 team doc without activeLeagueId
    await db.teams.insert({ id: "ct_abc", schemaVersion: 0, /* ... */ });

    // 3. Close and reopen with v1 schema (which has the migration strategy)
    await db.destroy();
    const db2 = await createTestDb(getRxStorageMemory());

    // 4. Assert the migrated doc has activeLeagueId: null
    const team = await db2.teams.findOne("ct_abc").exec();
    expect(team?.activeLeagueId).toBe(null);
  });
});
```

Apply the same pattern for `completedGames` v0 → v1, verifying:
- `leagueSeasonId` defaults to `null`
- `scheduledGameId` defaults to `null`
- `gameType` defaults to `"EXHIBITION"`
