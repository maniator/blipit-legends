/**
 * Public store API for League Mode v1.
 *
 * Provides `createSeason`, `quickStart`, `advanceSeason`, `recordResult`, and
 * read helpers. All writes go through RxDB collections; `customTeams.activeLeagueIds`
 * mutations are always wrapped in `withSanctionedCustomTeamWrite`.
 *
 * Follow the `buildStore(getDbFn)` / singleton pattern from saveStore and
 * customTeamStore so tests can inject an in-memory DB via `makeLeagueStore`.
 */
import { makeCustomTeamStore } from "@feat/customTeams/storage/customTeamStore";
import type { AutogenParity, AutogenTheme } from "@feat/league/autogen/generateLeagueTeams";
import { generateLeagueTeams } from "@feat/league/autogen/generateLeagueTeams";
import { generateSchedule } from "@feat/league/schedule/generateSchedule";
import { advanceToUserGame } from "@feat/league/sim/advanceToUserGame";
import { runHeadlessGame } from "@feat/league/sim/runHeadlessGame";
import { computePitcherFatigueUpdates } from "@feat/league/sim/updatePitcherFatigue";
import type {
  SeasonGameRecord,
  SeasonPlayerStateRecord,
  SeasonRecord,
  SeasonTeamRecord,
} from "@feat/league/storage/types";
import { deriveStandings } from "@feat/league/utils/deriveStandings";
import { nanoid } from "nanoid";

import type { BallgameDb } from "@storage/db";
import { getDb } from "@storage/db";
import { generateSeasonId, generateSeasonTeamId, generateTeamId } from "@storage/generateId";
import { fnv1a } from "@storage/hash";
import { SANCTIONED_WRITE_CTX, withSanctionedCustomTeamWrite } from "@storage/sanctionedWrite";

// ---------------------------------------------------------------------------
// Season constants
// ---------------------------------------------------------------------------

/**
 * Sprint season schedule parameters for the mini preset.
 * - gamesPerTeam=14, seriesLength=2:
 *     8 teams × 7 opponents → 14 % (7 × 2) === 0 ✓
 *     total games = 8 × 14 / 2 = 56 (≥ 30 acceptance threshold)
 */
const SPRINT_GAMES_PER_TEAM = 14;
const SPRINT_SERIES_LENGTH = 2;

/** Monotonic ruleset version applied to all new seasons. */
const RULESET_VERSION = 1;

// ---------------------------------------------------------------------------
// Input / Output types
// ---------------------------------------------------------------------------

export interface CreateSeasonInput {
  name: string;
  masterSeed: string;
  preset: "mini";
  seasonLength: "sprint";
  leagues: Array<{
    id: string;
    name: string;
    teamIds: string[];
    dhEnabled: boolean;
  }>;
}

export interface QuickStartInput {
  masterSeed: string;
  dhEnabled: boolean;
  /** Optional explicit seed for autogen team generation. Defaults to fnv1a(masterSeed+":autogen:qs"). */
  autogenSeed?: string;
  autogenOptions: {
    count: number;
    theme: AutogenTheme;
    parity: AutogenParity;
  };
}

export interface AdvanceSeasonInput {
  seasonId: string;
  userSeasonTeamId: string;
}

export interface AdvanceSeasonResult {
  nextGameId: string | null;
  gamesSimulated: number;
  seasonComplete: boolean;
}

export interface RecordResultInput {
  seasonGameId: string;
  boxscore: { homeScore: number; awayScore: number };
}

export interface SimulateNextDayResult {
  /** Number of games that completed during this call. */
  gamesSimulated: number;
  /** True when no scheduled or in-progress games remain. */
  seasonComplete: boolean;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

type GetDb = () => Promise<BallgameDb>;

/**
 * Resolves schedule parameters from a preset + seasonLength combination.
 * Throws for unknown combinations so any new preset/length forces an explicit
 * decision here rather than silently generating a bad schedule.
 */
function resolveScheduleParams(
  preset: CreateSeasonInput["preset"],
  seasonLength: CreateSeasonInput["seasonLength"],
): { gamesPerTeam: number; seriesLength: number } {
  if (preset === "mini" && seasonLength === "sprint") {
    return { gamesPerTeam: SPRINT_GAMES_PER_TEAM, seriesLength: SPRINT_SERIES_LENGTH };
  }
  throw new Error(
    `[leagueStore] Unsupported preset/seasonLength combination: ${preset}/${seasonLength}`,
  );
}

// ---------------------------------------------------------------------------
// Store factory
// ---------------------------------------------------------------------------

function buildStore(getDbFn: GetDb) {
  /**
   * Updates a custom team's `activeLeagueIds` array by appending a season ID.
   * Must be wrapped in a sanctioned write context because these teams may
   * already be locked (enrolled in the season we are about to create).
   */
  async function appendActiveLeagueId(
    db: BallgameDb,
    customTeamId: string,
    seasonId: string,
  ): Promise<void> {
    await withSanctionedCustomTeamWrite(SANCTIONED_WRITE_CTX, async () => {
      const doc = await db.teams.findOne(customTeamId).exec();
      if (!doc) return;
      const current =
        (doc.toJSON() as unknown as { activeLeagueIds?: string[] }).activeLeagueIds ?? [];
      if (!current.includes(seasonId)) {
        await doc.patch({ activeLeagueIds: [...current, seasonId] });
      }
    });
  }

  const store = {
    /**
     * Creates a full season with schedule + team enrollments in one batch.
     *
     * Write order (minimises partial-write window):
     *   1. customTeams.activeLeagueIds (sanctioned patch per team)
     *   2. seasonTeams bulkInsert
     *   3. seasonGames bulkInsert
     *   4. seasons upsert — last, so status="active" is a reliable init signal
     */
    async createSeason(input: CreateSeasonInput): Promise<SeasonRecord> {
      const db = await getDbFn();
      const { name, masterSeed, preset, seasonLength, leagues } = input;
      const { gamesPerTeam, seriesLength } = resolveScheduleParams(preset, seasonLength);

      const seasonId = generateSeasonId();
      const now = Date.now();

      // ── 1. Build season team records and ID map ──────────────────────────
      const seasonTeamDocs: SeasonTeamRecord[] = [];

      // seasonTeamIdByCustomTeamId for schedule generation
      const seasonTeamIdByCustomTeamId: Record<string, string> = {};

      // Collect all custom team IDs across all leagues for the schedule call.
      // For multi-league seasons each league gets its own schedule; for now
      // the mini preset has a single league, so we iterate regardless.
      const leagueRecords: Array<{
        id: string;
        name: string;
        teamIds: string[];
        dhEnabled: boolean;
      }> = [];

      for (const league of leagues) {
        const leagueSeasonTeamIds: string[] = [];

        for (const customTeamId of league.teamIds) {
          // Build a roster snapshot from the stored team doc.
          const teamDoc = await db.teams.findOne(customTeamId).exec();
          const rosterSnapshot: Record<string, unknown> = teamDoc
            ? (teamDoc.toJSON() as unknown as Record<string, unknown>)
            : {};

          const seasonTeamId = generateSeasonTeamId();
          seasonTeamIdByCustomTeamId[customTeamId] = seasonTeamId;
          leagueSeasonTeamIds.push(seasonTeamId);

          seasonTeamDocs.push({
            id: seasonTeamId,
            seasonId,
            leagueId: league.id,
            customTeamId,
            rosterSnapshot,
            wins: 0,
            losses: 0,
            ties: 0,
            runDifferential: 0,
          });
        }

        leagueRecords.push({
          id: league.id,
          name: league.name,
          teamIds: league.teamIds,
          dhEnabled: league.dhEnabled,
        });
      }

      // ── 2. Generate schedule (per league) ────────────────────────────────
      const allGames: Omit<SeasonGameRecord, "claimedBy">[] = [];
      for (const league of leagues) {
        if (league.teamIds.length < 2) continue;
        const { games } = generateSchedule({
          masterSeed,
          teamIds: league.teamIds,
          gamesPerTeam,
          seriesLength,
          seasonId,
          seasonTeamIdByCustomTeamId,
        });
        allGames.push(...games);
      }

      // ── 3. Update customTeams.activeLeagueIds (sanctioned) ──────────────
      const allCustomTeamIds = leagues.flatMap((l) => l.teamIds);
      for (const customTeamId of allCustomTeamIds) {
        await appendActiveLeagueId(db, customTeamId, seasonId);
      }

      // ── 4. Persist season teams ──────────────────────────────────────────
      await db.seasonTeams.bulkInsert(seasonTeamDocs);

      // ── 5. Persist season games ──────────────────────────────────────────
      const gameDocs: SeasonGameRecord[] = allGames.map((g) => ({ ...g, claimedBy: null }));
      await db.seasonGames.bulkInsert(gameDocs);

      // ── 5b. Initialize seasonPlayerState for every pitcher on every team ──
      // Fatigue tracking in recordResult skips entirely when no player-state
      // docs exist. Pre-populate all pitchers at season-start so SP rotation
      // and RP availability progress from the very first game day.
      const playerStateDocs: SeasonPlayerStateRecord[] = [];
      for (const teamDoc of seasonTeamDocs) {
        const rosterSnap = teamDoc.rosterSnapshot as {
          pitchers?: Array<{ id: string }>;
        };
        for (const pitcher of rosterSnap.pitchers ?? []) {
          playerStateDocs.push({
            id: `${seasonId}:${teamDoc.id}:${pitcher.id}`,
            seasonId,
            seasonTeamId: teamDoc.id,
            playerId: pitcher.id,
            pitcherDaysRest: 3,
            pitcherAvailability: 1.0,
            pitcherStartsThisSeason: 0,
          });
        }
      }
      if (playerStateDocs.length > 0) {
        await db.seasonPlayerState.bulkInsert(playerStateDocs);
      }

      // ── 6. Upsert season header (last — reliable "fully initialised" signal)
      const seasonDoc: SeasonRecord = {
        id: seasonId,
        name,
        status: "active",
        createdAt: now,
        completedAt: null,
        preset,
        seasonLength,
        masterSeed,
        leagues: leagueRecords,
        currentGameDay: 0,
        rulesetVersion: RULESET_VERSION,
      };
      await db.seasons.upsert(seasonDoc);

      return seasonDoc;
    },

    /**
     * Quick-start: auto-generates `autogenOptions.count` teams, upserts them
     * into the customTeams collection, then calls createSeason with one league
     * containing all generated teams.
     */
    async quickStart(input: QuickStartInput): Promise<SeasonRecord> {
      const { masterSeed, dhEnabled, autogenOptions, autogenSeed } = input;
      const db = await getDbFn();

      // Use the caller-supplied autogenSeed when provided; otherwise derive a
      // stable sub-seed from the master seed so the same masterSeed always
      // produces the same teams when autogenSeed is omitted.
      const autogenSubSeed = autogenSeed ?? fnv1a(`${masterSeed}:autogen:qs`);

      const generated = generateLeagueTeams({
        count: autogenOptions.count,
        theme: autogenOptions.theme,
        parity: autogenOptions.parity,
        masterSeed,
        autogenSubSeed,
        rosterMinimums: {
          lineup: 9,
          bench: 3,
          startingPitchers: 5,
          reliefPitchers: 3,
        },
        idFactory: { teamId: () => generateTeamId() },
      });

      // Upsert generated teams into the customTeams collection.
      const ctStore = makeCustomTeamStore(() => Promise.resolve(db));
      const teamIds: string[] = [];

      for (const gen of generated) {
        // Use the idFactory-generated ID via the meta.id override.
        await ctStore.createCustomTeam(
          {
            name: gen.name,
            abbreviation: gen.abbreviation,
            nickname: gen.nickname,
            city: gen.city,
            slug: gen.slug,
            roster: {
              lineup: gen.roster.lineup,
              bench: gen.roster.bench,
              pitchers: gen.roster.pitchers,
            },
            metadata: gen.metadata,
            autogen: gen.autogen,
            statsProfile: gen.statsProfile,
          },
          { id: gen.id },
        );
        teamIds.push(gen.id);
      }

      // Create a single league spanning all generated teams.
      const leagueId = fnv1a(`${masterSeed}:league:0`);
      const seasonName = `Quick Start Season`;

      return store.createSeason({
        name: seasonName,
        masterSeed,
        preset: "mini",
        seasonLength: "sprint",
        leagues: [
          {
            id: leagueId,
            name: "Quick Start League",
            teamIds,
            dhEnabled,
          },
        ],
      });
    },

    /**
     * Advances the season by simulating all games up to the user's next game.
     * Delegates entirely to `advanceToUserGame` — no PRNG manipulation here.
     */
    async advanceSeason(input: AdvanceSeasonInput): Promise<AdvanceSeasonResult> {
      const { seasonId, userSeasonTeamId } = input;

      const { nextGameId, gamesSimulated } = await advanceToUserGame({
        seasonId,
        userSeasonTeamId,
      });

      const seasonComplete = nextGameId === null;

      if (seasonComplete) {
        const db = await getDbFn();
        const seasonDoc = await db.seasons.findOne(seasonId).exec();
        if (seasonDoc) {
          // Determine champion: derive standings from all completed games, pick the leader.
          // deriveStandings sorts by winPct DESC → runDifferential DESC → seasonTeamId ASC,
          // so the result is always deterministic even when two teams finish with identical
          // records — the ASCII sort on seasonTeamId acts as a final stable tiebreaker.
          // See _bmad-output/planning-artifacts/league-mode-distillate/02-data-model-routing-schedule.md
          // and decisions.md §18 for the full tiebreak chain (which operationalises in v3 playoffs).
          const completedGames = await db.seasonGames
            .find({ selector: { seasonId, status: "completed" } })
            .exec();
          const allTeamDocs = await db.seasonTeams.find({ selector: { seasonId } }).exec();
          const allSeasonTeamIds = allTeamDocs.map((d) => d.id);
          const standings = deriveStandings(
            completedGames.map((d) => d.toJSON() as unknown as SeasonGameRecord),
            allSeasonTeamIds,
          );
          const championTeamId = standings[0]?.seasonTeamId ?? null;
          await seasonDoc.patch({ status: "complete", completedAt: Date.now(), championTeamId });
        }
      }

      return { nextGameId, gamesSimulated, seasonComplete };
    },

    /**
     * Records the result of a completed game. Idempotent: if the game is
     * already "completed", returns immediately without writing.
     * Calls computePitcherFatigueUpdates after persisting the result.
     */
    async recordResult(input: RecordResultInput): Promise<void> {
      const { seasonGameId, boxscore } = input;
      const db = await getDbFn();

      const gameDoc = await db.seasonGames.findOne(seasonGameId).exec();
      if (!gameDoc) return;

      const game = gameDoc.toJSON() as unknown as SeasonGameRecord;

      // Idempotent guard — no-op if already completed.
      if (game.status === "completed") return;

      const { homeScore, awayScore } = boxscore;
      const homeWon = homeScore > awayScore;
      const winnerSeasonTeamId = homeWon ? game.homeSeasonTeamId : game.awaySeasonTeamId;
      const loserSeasonTeamId = homeWon ? game.awaySeasonTeamId : game.homeSeasonTeamId;

      // Persist game result.
      await gameDoc.patch({
        status: "completed",
        boxscore: boxscore as unknown as Record<string, unknown>,
        completedAt: Date.now(),
      });

      // Load player states for both teams.
      const allPlayerStates = (
        await db.seasonPlayerState
          .find({
            selector: {
              seasonId: game.seasonId,
              seasonTeamId: { $in: [game.homeSeasonTeamId, game.awaySeasonTeamId] },
            },
          })
          .exec()
      ).map((d) => d.toJSON() as unknown as SeasonPlayerStateRecord);

      if (allPlayerStates.length === 0) return;

      // Load roster snapshots for both teams.
      const teamDocs = await db.seasonTeams
        .find({
          selector: { id: { $in: [game.homeSeasonTeamId, game.awaySeasonTeamId] } },
        })
        .exec();

      const rosterSnapshotBySeasonTeamId: Record<string, Record<string, unknown>> = {};
      for (const td of teamDocs) {
        const t = td.toJSON() as unknown as SeasonTeamRecord;
        rosterSnapshotBySeasonTeamId[t.id] = t.rosterSnapshot;
      }

      // Extract starter pitcher IDs from the stored boxscore if present.
      const fullBoxscore = boxscore as unknown as Record<string, unknown>;
      const winnerStartingPitcherId =
        typeof fullBoxscore["winnerStartingPitcherId"] === "string"
          ? fullBoxscore["winnerStartingPitcherId"]
          : "";
      const loserStartingPitcherId =
        typeof fullBoxscore["loserStartingPitcherId"] === "string"
          ? fullBoxscore["loserStartingPitcherId"]
          : "";

      // Retrieve the stored season for rulesetVersion.
      const seasonDoc = await db.seasons.findOne(game.seasonId).exec();
      const rulesetVersion = seasonDoc
        ? ((seasonDoc.toJSON() as unknown as SeasonRecord).rulesetVersion ?? RULESET_VERSION)
        : RULESET_VERSION;

      const patches = computePitcherFatigueUpdates({
        seasonId: game.seasonId,
        rulesetVersion,
        winnerSeasonTeamId,
        loserSeasonTeamId,
        winnerStartingPitcherId,
        loserStartingPitcherId,
        allPlayerStates,
        rosterSnapshotBySeasonTeamId,
      });

      // Bulk-upsert fatigue patches.
      if (patches.length > 0) {
        await db.seasonPlayerState.bulkUpsert(
          patches.map((p) => ({
            ...(allPlayerStates.find((s) => s.id === p.id) ?? {}),
            ...p,
          })),
        );
      }
    },

    /** Returns the active season (the first one found), or null. */
    async getActiveSeason(): Promise<SeasonRecord | null> {
      const db = await getDbFn();
      const docs = await db.seasons.find({ selector: { status: "active" } }).exec();
      if (docs.length === 0) return null;
      return docs[0].toJSON() as unknown as SeasonRecord;
    },

    /**
     * Simulates all scheduled games for the current game day.
     *
     * Games are run headlessly in id-ASC order (same deterministic order as
     * advanceToUserGame). When all games for the day complete, `runHeadlessGame`
     * (step 10) automatically advances `seasons.currentGameDay`. If the final
     * day completes, champion declaration runs here and status is set to
     * "complete".
     *
     * Safe to call when the season is already complete — returns immediately
     * with `{ gamesSimulated: 0, seasonComplete: true }`.
     */
    async simulateNextDay(seasonId: string): Promise<SimulateNextDayResult> {
      const db = await getDbFn();

      const seasonDoc = await db.seasons.findOne(seasonId).exec();
      if (!seasonDoc) return { gamesSimulated: 0, seasonComplete: false };

      const season = seasonDoc.toJSON() as unknown as SeasonRecord;

      // Fast-path: season already finished.
      if (season.status !== "active") {
        return { gamesSimulated: 0, seasonComplete: season.status === "complete" };
      }

      const currentDay = season.currentGameDay;

      // All scheduled/in_progress games for today.
      const pendingOnDay = await db.seasonGames
        .find({
          selector: {
            seasonId,
            gameDay: currentDay,
            status: { $in: ["scheduled", "in_progress"] },
          },
        })
        .exec();

      if (pendingOnDay.length === 0) {
        // Today is already done — check overall completion.
        const anyPending = await db.seasonGames
          .find({ selector: { seasonId, status: { $in: ["scheduled", "in_progress"] } } })
          .exec();
        return { gamesSimulated: 0, seasonComplete: anyPending.length === 0 };
      }

      const claimToken = nanoid(12);
      let gamesSimulated = 0;

      // Sort by id ASC — deterministic, matches advanceToUserGame ordering.
      const sorted = [...pendingOnDay].sort((a, b) => a.id.localeCompare(b.id));

      for (const game of sorted) {
        const outcome = await runHeadlessGame({ seasonGameId: game.id, claimToken });
        if (outcome.status === "completed" || outcome.status === "already_complete") {
          gamesSimulated++;
        }
      }

      // Re-check whether all games are now done.
      const anyStillPending = await db.seasonGames
        .find({ selector: { seasonId, status: { $in: ["scheduled", "in_progress"] } } })
        .exec();
      const seasonComplete = anyStillPending.length === 0;

      if (seasonComplete) {
        const freshSeasonDoc = await db.seasons.findOne(seasonId).exec();
        if (freshSeasonDoc) {
          const completedGames = await db.seasonGames
            .find({ selector: { seasonId, status: "completed" } })
            .exec();
          const allTeamDocs = await db.seasonTeams.find({ selector: { seasonId } }).exec();
          const allSeasonTeamIds = allTeamDocs.map((d) => d.id);
          const standings = deriveStandings(
            completedGames.map((d) => d.toJSON() as unknown as SeasonGameRecord),
            allSeasonTeamIds,
          );
          const championTeamId = standings[0]?.seasonTeamId ?? null;
          await freshSeasonDoc.patch({
            status: "complete",
            completedAt: Date.now(),
            championTeamId,
          });
        }
      }

      return { gamesSimulated, seasonComplete };
    },

    /** Returns all season team records for a given season. */
    async getSeasonTeams(seasonId: string): Promise<SeasonTeamRecord[]> {
      const db = await getDbFn();
      const docs = await db.seasonTeams.find({ selector: { seasonId } }).exec();
      return docs.map((d) => d.toJSON() as unknown as SeasonTeamRecord);
    },

    /**
     * Returns all season game records for a season, optionally filtered by
     * status.
     */
    async getSeasonGames(
      seasonId: string,
      status?: SeasonGameRecord["status"],
    ): Promise<SeasonGameRecord[]> {
      const db = await getDbFn();
      const selector: Record<string, unknown> = { seasonId };
      if (status !== undefined) selector["status"] = status;
      const docs = await db.seasonGames.find({ selector }).exec();
      return docs.map((d) => d.toJSON() as unknown as SeasonGameRecord);
    },
  };

  return store;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

/** Default LeagueStore backed by the IndexedDB singleton. */
export const LeagueStore = buildStore(getDb);

/**
 * Factory for creating a LeagueStore with a custom db getter.
 * Use this in tests to inject a fresh in-memory database.
 */
export const makeLeagueStore = (getDbFn: () => Promise<BallgameDb>) => buildStore(getDbFn);

// Re-export named functions for direct call-site ergonomics.
export const {
  createSeason,
  quickStart,
  advanceSeason,
  recordResult,
  simulateNextDay,
  getActiveSeason,
  getSeasonTeams,
  getSeasonGames,
} = LeagueStore;
