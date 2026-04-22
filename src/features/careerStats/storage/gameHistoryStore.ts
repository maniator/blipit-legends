/**
 * GameHistoryStore — persists completed-game records, batting stats, and pitcher stats.
 *
 * Critical rules:
 *   - commitCompletedGame is idempotent: calling it multiple times with the same
 *     gameInstanceId always writes exactly one CompletedGameRecord and one stat row per player/pitcher.
 *     If the CompletedGameRecord already exists (concurrent insert or prior partial write),
 *     any missing stat rows are still written so no stats are permanently lost.
 *   - Loading an already-FINAL save must NOT call this function — the caller
 *     (useGameHistorySync) is responsible for checking the save state before committing.
 *   - Export/import is idempotent: re-importing the same bundle skips existing rows.
 */
import type { BallgameDb } from "@storage/db";
import { getDb } from "@storage/db";
import { fnv1a } from "@storage/hash";
import type {
  BatterGameStatRecord,
  BattingLeader,
  CompletedGameRecord,
  ExportedGameHistory,
  ImportGameHistoryResult,
  PitcherGameStatRecord,
  PitchingLeader,
  TeamCareerBattingStatsRow,
  TeamCareerPitchingStatsRow,
  TeamCareerSummary,
} from "@storage/types";

/** Schema version written to every new CompletedGameRecord / stat row. */
const HISTORY_SCHEMA_VERSION = 1;

/** Signing key for game-history export bundles. */
export const GAME_HISTORY_EXPORT_KEY = "ballgame:gameHistory:v1";

/** Returns true when an RxDB error is a primary-key conflict (concurrent insert). */
function isConflictError(err: unknown): boolean {
  return Boolean(err && typeof err === "object" && (err as { code?: string }).code === "CONFLICT");
}

type GetDb = () => Promise<BallgameDb>;

function buildStore(getDbFn: GetDb) {
  /**
   * Writes one CompletedGameRecord + N BatterGameStatRecord rows + M PitcherGameStatRecord rows for a completed game.
   * Fully idempotent at the game, batting-stat, and pitcher-stat row level.
   */
  async function commitCompletedGame(
    gameInstanceId: string,
    gameMeta: Omit<CompletedGameRecord, "id" | "schemaVersion">,
    statRows: Omit<BatterGameStatRecord, "id" | "schemaVersion" | "createdAt">[],
    pitcherRows: Omit<PitcherGameStatRecord, "id" | "schemaVersion" | "createdAt">[] = [],
  ): Promise<void> {
    const db = await getDbFn();

    const existing = await db.completedGames.findOne(gameInstanceId).exec();

    if (!existing) {
      const gameDoc: CompletedGameRecord = {
        id: gameInstanceId,
        ...gameMeta,
        schemaVersion: HISTORY_SCHEMA_VERSION,
      };

      try {
        await db.completedGames.insert(gameDoc);
      } catch (err) {
        if (!isConflictError(err)) {
          throw err;
        }
      }
    }

    const now = Date.now();

    // Write batting stat rows.
    if (statRows.length > 0) {
      const statDocs: BatterGameStatRecord[] = statRows.map((row) => ({
        ...row,
        id: `${gameInstanceId}:${row.teamId}:${row.playerId}`,
        createdAt: now,
        schemaVersion: HISTORY_SCHEMA_VERSION,
      }));

      const statIds = statDocs.map((s) => s.id);
      const existingStatDocs = await db.batterGameStats.findByIds(statIds).exec();
      const existingStatIds = new Set(existingStatDocs.keys());
      const missingStats = statDocs.filter((s) => !existingStatIds.has(s.id));

      if (missingStats.length > 0) {
        await db.batterGameStats.bulkInsert(missingStats);
      }
    }

    // Write pitcher stat rows.
    if (pitcherRows.length > 0) {
      const pitcherDocs: PitcherGameStatRecord[] = pitcherRows.map((row) => ({
        ...row,
        id: `${gameInstanceId}:${row.teamId}:${row.playerId}`,
        createdAt: now,
        schemaVersion: HISTORY_SCHEMA_VERSION,
      }));

      const pitcherIds = pitcherDocs.map((p) => p.id);
      const existingPitcherDocs = await db.pitcherGameStats.findByIds(pitcherIds).exec();
      const existingPitcherIds = new Set(existingPitcherDocs.keys());
      const missingPitchers = pitcherDocs.filter((p) => !existingPitcherIds.has(p.id));

      if (missingPitchers.length > 0) {
        await db.pitcherGameStats.bulkInsert(missingPitchers);
      }
    }
  }

  /**
   * Returns cumulative career batting totals for a set of player IDs.
   * Performs a single bulk query and aggregates in memory.
   */
  async function getCareerStats(
    playerIds: string[],
    options?: { excludeGameId?: string },
  ): Promise<
    Record<string, BatterGameStatRecord["batting"] & { gamesPlayed: number; teamId: string }>
  > {
    if (playerIds.length === 0) return {};
    const db = await getDbFn();

    const allRows = await db.batterGameStats
      .find({ selector: { playerId: { $in: playerIds } } })
      .exec();

    const results: Record<
      string,
      BatterGameStatRecord["batting"] & { gamesPlayed: number; teamId: string }
    > = {};

    for (const row of allRows) {
      const doc = row.toJSON() as BatterGameStatRecord;
      // Exclude the current (in-progress) game so that live gameStats can be
      // merged on top without double-counting after game-over commit.
      if (options?.excludeGameId && doc.gameId === options.excludeGameId) continue;
      const existing = results[doc.playerId];
      if (!existing) {
        results[doc.playerId] = {
          atBats: doc.batting.atBats,
          hits: doc.batting.hits,
          walks: doc.batting.walks,
          strikeouts: doc.batting.strikeouts,
          rbi: doc.batting.rbi,
          singles: doc.batting.singles,
          doubles: doc.batting.doubles,
          triples: doc.batting.triples,
          homers: doc.batting.homers,
          sacFlies: doc.batting.sacFlies,
          gamesPlayed: 1,
          teamId: doc.teamId,
        };
      } else {
        existing.atBats += doc.batting.atBats;
        existing.hits += doc.batting.hits;
        existing.walks += doc.batting.walks;
        existing.strikeouts += doc.batting.strikeouts;
        existing.rbi += doc.batting.rbi;
        existing.singles += doc.batting.singles;
        existing.doubles += doc.batting.doubles;
        existing.triples += doc.batting.triples;
        existing.homers += doc.batting.homers;
        existing.sacFlies += doc.batting.sacFlies;
        existing.gamesPlayed++;
      }
    }
    return results;
  }

  /**
   * Returns all batting stat rows for a single player ID, ordered by createdAt ascending.
   * Used for the player career page game-by-game log.
   */
  async function getPlayerCareerBatting(playerId: string): Promise<BatterGameStatRecord[]> {
    const db = await getDbFn();
    const rows = await db.batterGameStats
      .find({ selector: { playerId }, sort: [{ createdAt: "asc" }] })
      .exec();
    return rows.map((r) => r.toJSON() as BatterGameStatRecord);
  }

  /**
   * Returns all pitching stat rows for a single pitcher ID, ordered by createdAt ascending.
   * Used for the player career page game-by-game log.
   */
  async function getPlayerCareerPitching(playerId: string): Promise<PitcherGameStatRecord[]> {
    const db = await getDbFn();
    const rows = await db.pitcherGameStats
      .find({ selector: { playerId }, sort: [{ createdAt: "asc" }] })
      .exec();
    return rows.map((r) => r.toJSON() as PitcherGameStatRecord);
  }

  /**
   * Returns cumulative career batting stats for all players associated with a team.
   * Queries by teamId.
   */
  async function getTeamCareerBattingStats(teamId: string): Promise<TeamCareerBattingStatsRow[]> {
    const db = await getDbFn();
    const rows = await db.batterGameStats.find({ selector: { teamId } }).exec();

    const aggregated: Record<string, TeamCareerBattingStatsRow> = {};

    for (const row of rows) {
      const doc = row.toJSON() as BatterGameStatRecord;
      const key = doc.playerId;
      if (!aggregated[key]) {
        aggregated[key] = {
          playerId: key,
          nameAtGameTime: doc.nameAtGameTime,
          gamesPlayed: 0,
          atBats: 0,
          hits: 0,
          walks: 0,
          strikeouts: 0,
          rbi: 0,
          singles: 0,
          doubles: 0,
          triples: 0,
          homers: 0,
          sacFlies: 0,
        };
      }
      const agg = aggregated[key];
      agg.gamesPlayed++;
      agg.atBats += doc.batting.atBats;
      agg.hits += doc.batting.hits;
      agg.walks += doc.batting.walks;
      agg.strikeouts += doc.batting.strikeouts;
      agg.rbi += doc.batting.rbi;
      agg.singles += doc.batting.singles;
      agg.doubles += doc.batting.doubles;
      agg.triples += doc.batting.triples;
      agg.homers += doc.batting.homers;
      agg.sacFlies += doc.batting.sacFlies;
    }

    return Object.values(aggregated);
  }

  /**
   * Returns cumulative career pitching stats for all pitchers associated with a team.
   * Queries by teamId.
   */
  async function getTeamCareerPitchingStats(teamId: string): Promise<TeamCareerPitchingStatsRow[]> {
    const db = await getDbFn();
    const rows = await db.pitcherGameStats.find({ selector: { teamId } }).exec();

    const aggregated: Record<string, TeamCareerPitchingStatsRow> = {};

    for (const row of rows) {
      const doc = row.toJSON() as PitcherGameStatRecord;
      const key = doc.playerId;
      if (!aggregated[key]) {
        aggregated[key] = {
          playerId: key,
          nameAtGameTime: doc.nameAtGameTime,
          gamesPlayed: 0,
          outsPitched: 0,
          battersFaced: 0,
          pitchesThrown: 0,
          hitsAllowed: 0,
          walksAllowed: 0,
          strikeoutsRecorded: 0,
          homersAllowed: 0,
          runsAllowed: 0,
          earnedRuns: 0,
          saves: 0,
          holds: 0,
          blownSaves: 0,
        };
      }
      const agg = aggregated[key];
      agg.gamesPlayed++;
      agg.outsPitched += doc.outsPitched;
      agg.battersFaced += doc.battersFaced;
      agg.pitchesThrown += doc.pitchesThrown;
      agg.hitsAllowed += doc.hitsAllowed;
      agg.walksAllowed += doc.walksAllowed;
      agg.strikeoutsRecorded += doc.strikeoutsRecorded;
      agg.homersAllowed += doc.homersAllowed;
      agg.runsAllowed += doc.runsAllowed;
      agg.earnedRuns += doc.earnedRuns;
      agg.saves += doc.saves;
      agg.holds += doc.holds;
      agg.blownSaves += doc.blownSaves;
    }

    return Object.values(aggregated);
  }

  /** Exports all game history (batting + pitching) as a signed portable bundle. */
  async function exportGameHistory(): Promise<string> {
    const db = await getDbFn();
    const games = await db.completedGames.find().exec();
    const stats = await db.batterGameStats.find().exec();
    const pitcherStats = await db.pitcherGameStats.find().exec();

    const teamIds = new Set<string>();
    for (const g of games) {
      teamIds.add(g.homeTeamId);
      teamIds.add(g.awayTeamId);
    }
    for (const s of stats) {
      teamIds.add(s.teamId);
      teamIds.add(s.opponentTeamId);
    }
    for (const s of pitcherStats) {
      teamIds.add(s.teamId);
      teamIds.add(s.opponentTeamId);
    }

    const payload: ExportedGameHistory["payload"] = {
      games: games.map((g) => g.toJSON() as CompletedGameRecord),
      playerGameStats: stats.map((s) => s.toJSON() as BatterGameStatRecord),
      pitcherGameStats: pitcherStats.map((s) => s.toJSON() as PitcherGameStatRecord),
      requiredTeamIds: Array.from(teamIds),
    };

    const sig = fnv1a(GAME_HISTORY_EXPORT_KEY + JSON.stringify(payload));

    const bundle: ExportedGameHistory = {
      type: "gameHistory",
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      payload,
      sig,
    };

    return JSON.stringify(bundle, null, 2);
  }

  /**
   * Imports a signed game-history bundle.
   * - Validates signature and format version (only v1 is accepted).
   * - Validates that all required team IDs exist locally.
   * - Merges idempotently: skips any game or stat row whose ID already exists.
   */
  async function importGameHistory(
    json: string,
    existingTeamIds: Set<string>,
  ): Promise<ImportGameHistoryResult> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      throw new Error("Invalid JSON in game history bundle.");
    }

    const bundle = parsed as Partial<ExportedGameHistory>;
    if (bundle.type !== "gameHistory") {
      throw new Error(`Unexpected bundle type: ${String(bundle.type ?? "(none)")}`);
    }
    if (bundle.formatVersion !== 1) {
      throw new Error(`Unsupported game history format version: ${String(bundle.formatVersion)}`);
    }
    if (!bundle.payload || typeof bundle.payload !== "object") {
      throw new Error("Game history bundle is missing payload.");
    }

    // Verify signature.
    const expectedSig = fnv1a(GAME_HISTORY_EXPORT_KEY + JSON.stringify(bundle.payload));
    if (bundle.sig !== expectedSig) {
      throw new Error(
        "Game history bundle signature is invalid. The file may have been tampered with.",
      );
    }

    // Validate that all required team IDs exist locally.
    const requiredTeamIds = bundle.payload.requiredTeamIds ?? [];
    const missingTeamIds = requiredTeamIds.filter((id) => !existingTeamIds.has(id));
    if (missingTeamIds.length > 0) {
      throw new Error(
        `Cannot import game history: the following teams are missing from your local install. ` +
          `Please import those teams first, then re-import this history bundle.\n` +
          `Missing team IDs: ${missingTeamIds.join(", ")}`,
      );
    }

    const db = await getDbFn();

    const games = bundle.payload.games ?? [];
    const stats = bundle.payload.playerGameStats ?? [];
    const pitcherStats = bundle.payload.pitcherGameStats ?? [];

    // Games.
    const gameIds = games.map((g) => g.id);
    const existingGameRecords =
      gameIds.length > 0 ? await db.completedGames.findByIds(gameIds).exec() : new Map();
    const existingGameIds = new Set(existingGameRecords.keys());
    const gamesToInsert = games.filter((g) => !existingGameIds.has(g.id));

    let gamesCreated = 0;
    const gamesSkipped = existingGameIds.size;

    if (gamesToInsert.length > 0) {
      const result = await db.completedGames.bulkInsert(
        gamesToInsert.map((g) => ({ ...g, schemaVersion: HISTORY_SCHEMA_VERSION })),
      );
      gamesCreated = result.success.length;
    }

    // Batting stats.
    const statIds = stats.map((s) => s.id);
    const existingStatDocs =
      statIds.length > 0 ? await db.batterGameStats.findByIds(statIds).exec() : new Map();
    const existingStatIds = new Set(existingStatDocs.keys());
    const statsToInsert = stats.filter((s) => !existingStatIds.has(s.id));

    let statsCreated = 0;
    const statsSkipped = existingStatIds.size;

    if (statsToInsert.length > 0) {
      const result = await db.batterGameStats.bulkInsert(
        statsToInsert.map((s) => ({
          ...s,
          schemaVersion: HISTORY_SCHEMA_VERSION,
        })),
      );
      statsCreated = result.success.length;
    }

    // Pitcher stats.
    const pitcherIds = pitcherStats.map((p) => p.id);
    const existingPitcherDocs =
      pitcherIds.length > 0 ? await db.pitcherGameStats.findByIds(pitcherIds).exec() : new Map();
    const existingPitcherIds = new Set(existingPitcherDocs.keys());
    const pitchersToInsert = pitcherStats.filter((p) => !existingPitcherIds.has(p.id));

    let pitcherStatsCreated = 0;
    const pitcherStatsSkipped = existingPitcherIds.size;

    if (pitchersToInsert.length > 0) {
      const result = await db.pitcherGameStats.bulkInsert(
        pitchersToInsert.map((p) => ({
          ...p,
          schemaVersion: HISTORY_SCHEMA_VERSION,
        })),
      );
      pitcherStatsCreated = result.success.length;
    }

    return {
      gamesCreated,
      gamesSkipped,
      statsCreated,
      statsSkipped,
      pitcherStatsCreated,
      pitcherStatsSkipped,
    };
  }

  /**
   * Returns aggregate career team stats from completed games (W/L/T, RS/RA, streak, last10).
   * Games are computed by matching teamId against homeTeamId or awayTeamId.
   * Tied games (rs === ra) are tracked separately and excluded from win-percentage calculation.
   *
   * Uses two separate indexed queries instead of $or to ensure reliable index hits on
   * RxDB v17 beta.7 / Dexie (IndexedDB) — $or is not guaranteed to use indexes in this version.
   */
  async function getTeamCareerSummary(teamId: string): Promise<TeamCareerSummary> {
    const db = await getDbFn();
    const [homeRows, awayRows] = await Promise.all([
      db.completedGames.find({ selector: { homeTeamId: teamId } }).exec(),
      db.completedGames.find({ selector: { awayTeamId: teamId } }).exec(),
    ]);

    // Merge and sort chronologically (playedAt asc) in memory.
    const docs = [
      ...homeRows.map((r) => r.toJSON() as CompletedGameRecord),
      ...awayRows.map((r) => r.toJSON() as CompletedGameRecord),
    ].sort((a, b) => a.playedAt - b.playedAt);

    let wins = 0;
    let losses = 0;
    let ties = 0;
    let runsScored = 0;
    let runsAllowed = 0;

    // Track each game's result ("W", "L", or "T") in chronological order.
    const gameResults: ("W" | "L" | "T")[] = [];

    for (const doc of docs) {
      const isHome = doc.homeTeamId === teamId;
      const rs = isHome ? doc.homeScore : doc.awayScore;
      const ra = isHome ? doc.awayScore : doc.homeScore;
      runsScored += rs;
      runsAllowed += ra;
      if (rs > ra) {
        wins++;
        gameResults.push("W");
      } else if (rs < ra) {
        losses++;
        gameResults.push("L");
      } else {
        ties++;
        gameResults.push("T");
      }
    }

    const gamesPlayed = wins + losses + ties;
    // Win % excludes tied games (standard baseball convention).
    const decidedGames = wins + losses;
    const winPct = decidedGames === 0 ? 0 : wins / decidedGames;
    const runDiff = runsScored - runsAllowed;
    const rsPerGame = gamesPlayed === 0 ? 0 : runsScored / gamesPlayed;
    const raPerGame = gamesPlayed === 0 ? 0 : runsAllowed / gamesPlayed;

    // Compute current streak from the end of the gameResults array.
    let streak = "-";
    if (gameResults.length > 0) {
      const last = gameResults[gameResults.length - 1];
      let count = 0;
      for (let i = gameResults.length - 1; i >= 0 && gameResults[i] === last; i--) count++;
      streak = last + count;
    }

    // Compute last-10 record — single pass instead of three filter() passes.
    const last10Games = gameResults.slice(-10);
    let last10Wins = 0;
    let last10Losses = 0;
    let last10Ties = 0;
    for (const r of last10Games) {
      if (r === "W") last10Wins++;
      else if (r === "L") last10Losses++;
      else last10Ties++;
    }

    return {
      gamesPlayed,
      wins,
      losses,
      ties,
      winPct,
      runsScored,
      runsAllowed,
      runDiff,
      rsPerGame,
      raPerGame,
      streak,
      last10: { wins: last10Wins, losses: last10Losses, ties: last10Ties },
    };
  }

  /**
   * Returns batting leaders (HR, AVG, RBI) for a team.
   * Players below the AB threshold are excluded from the AVG leader calculation.
   * Tie-breaking: value desc, then gamesPlayed desc, then name asc.
   *
   * Pass `options.rows` (pre-fetched from `getTeamCareerBattingStats`) to skip
   * a redundant DB query when the caller already has the rows.
   */
  async function getTeamBattingLeaders(
    teamId: string,
    options: {
      minAbForAvg?: number;
      rows?: TeamCareerBattingStatsRow[];
    } = {},
  ): Promise<{
    hrLeader: BattingLeader | null;
    avgLeader: BattingLeader | null;
    rbiLeader: BattingLeader | null;
  }> {
    const minAb = options.minAbForAvg ?? MIN_AB_FOR_AVG_LEADER;
    const rows = options.rows ?? (await getTeamCareerBattingStats(teamId));

    const pickLeader = (
      candidates: TeamCareerBattingStatsRow[],
      valueFn: (r: TeamCareerBattingStatsRow) => number,
    ): BattingLeader | null => {
      if (candidates.length === 0) return null;
      const sorted = [...candidates].sort((a, b) => {
        const diff = valueFn(b) - valueFn(a);
        if (diff !== 0) return diff;
        const gDiff = b.gamesPlayed - a.gamesPlayed;
        if (gDiff !== 0) return gDiff;
        return a.nameAtGameTime.localeCompare(b.nameAtGameTime, "en");
      });
      const top = sorted[0];
      return {
        playerId: top.playerId,
        nameAtGameTime: top.nameAtGameTime,
        value: valueFn(top),
        gamesPlayed: top.gamesPlayed,
      };
    };

    const hrLeader = pickLeader(rows, (r) => r.homers);
    const rbiLeader = pickLeader(rows, (r) => r.rbi);
    const avgCandidates = rows.filter((r) => r.atBats >= minAb);
    const avgLeader = pickLeader(avgCandidates, (r) => (r.atBats === 0 ? 0 : r.hits / r.atBats));

    return { hrLeader, avgLeader, rbiLeader };
  }

  /**
   * Returns pitching leaders (ERA, SV, K) for a team.
   * Players below the outs threshold are excluded from the ERA leader calculation.
   * Tie-breaking: value desc (ERA: asc), then gamesPlayed desc, then name asc.
   *
   * Pass `options.rows` (pre-fetched from `getTeamCareerPitchingStats`) to skip
   * a redundant DB query when the caller already has the rows.
   */
  async function getTeamPitchingLeaders(
    teamId: string,
    options: {
      minOutsForEra?: number;
      rows?: TeamCareerPitchingStatsRow[];
    } = {},
  ): Promise<{
    eraLeader: PitchingLeader | null;
    savesLeader: PitchingLeader | null;
    strikeoutsLeader: PitchingLeader | null;
  }> {
    const minOuts = options.minOutsForEra ?? MIN_OUTS_FOR_ERA_LEADER;
    const rows = options.rows ?? (await getTeamCareerPitchingStats(teamId));

    const pickPitchingLeader = (
      candidates: TeamCareerPitchingStatsRow[],
      valueFn: (r: TeamCareerPitchingStatsRow) => number,
      sortAsc = false,
    ): PitchingLeader | null => {
      if (candidates.length === 0) return null;
      const sorted = [...candidates].sort((a, b) => {
        const aVal = valueFn(a);
        const bVal = valueFn(b);
        const diff = sortAsc ? aVal - bVal : bVal - aVal;
        if (diff !== 0) return diff;
        const gDiff = b.gamesPlayed - a.gamesPlayed;
        if (gDiff !== 0) return gDiff;
        return a.nameAtGameTime.localeCompare(b.nameAtGameTime, "en");
      });
      const top = sorted[0];
      return {
        playerId: top.playerId,
        nameAtGameTime: top.nameAtGameTime,
        value: valueFn(top),
        gamesPlayed: top.gamesPlayed,
      };
    };

    const eraCandidates = rows.filter((r) => r.outsPitched >= minOuts);
    const eraLeader = pickPitchingLeader(
      eraCandidates,
      // ERA formula: (earnedRuns * 27) / outsPitched — this is equivalent to the
      // standard baseball formula (earnedRuns * 9) / IP because 3 outs = 1 IP.
      // Using outs directly avoids a division then multiplication by 3.
      // Mirrors computeERA in computePitcherGameStats.ts.
      (r) => (r.outsPitched === 0 ? Infinity : (r.earnedRuns * 27) / r.outsPitched),
      true, // lower ERA is better
    );
    const savesLeader = pickPitchingLeader(rows, (r) => r.saves);
    const strikeoutsLeader = pickPitchingLeader(rows, (r) => r.strikeoutsRecorded);

    return { eraLeader, savesLeader, strikeoutsLeader };
  }

  return {
    commitCompletedGame,
    getCareerStats,
    getPlayerCareerBatting,
    getPlayerCareerPitching,
    getTeamCareerBattingStats,
    getTeamCareerPitchingStats,
    getTeamCareerSummary,
    getTeamBattingLeaders,
    getTeamPitchingLeaders,
    exportGameHistory,
    importGameHistory,
  };
}

/** Minimum AB required for a player to qualify as the AVG leader. */
export const MIN_AB_FOR_AVG_LEADER = 20;
/** Minimum outs pitched required for a player to qualify as the ERA leader (30 outs = 10.0 IP). */
export const MIN_OUTS_FOR_ERA_LEADER = 30;

/** Default GameHistoryStore backed by the IndexedDB singleton. */
export const GameHistoryStore = buildStore(getDb);

/**
 * Factory for creating a GameHistoryStore with a custom db getter — useful for tests.
 */
export const makeGameHistoryStore = (getDbFn: GetDb) => buildStore(getDbFn);
