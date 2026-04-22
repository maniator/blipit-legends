import * as React from "react";

import { GameHistoryStore } from "@feat/careerStats/storage/gameHistoryStore";
import { useCustomTeams } from "@shared/hooks/useCustomTeams";
import { useNavigate, useParams } from "react-router";

import { getDb } from "@storage/db";
import type { TeamCareerSummary } from "@storage/types";

import type { BattingRow, PitchingRow } from "./careerStatsShared";

export function useCareerStatsData() {
  const { teamId: routeTeamId } = useParams<{ teamId?: string }>();
  const navigate = useNavigate();
  const { teams: customTeams, loading: teamsLoading } = useCustomTeams();

  const selectedTeamId = routeTeamId ?? "";

  const [teamsWithHistory, setTeamsWithHistory] = React.useState<string[]>([]);
  const [historyLoaded, setHistoryLoaded] = React.useState(false);
  const [battingRows, setBattingRows] = React.useState<BattingRow[]>([]);
  const [pitchingRows, setPitchingRows] = React.useState<PitchingRow[]>([]);
  const [dataLoading, setDataLoading] = React.useState(false);
  const [teamSummary, setTeamSummary] = React.useState<TeamCareerSummary | null>(null);
  const [hrLeader, setHrLeader] =
    React.useState<Awaited<ReturnType<typeof GameHistoryStore.getTeamBattingLeaders>>["hrLeader"]>(
      null,
    );
  const [avgLeader, setAvgLeader] =
    React.useState<Awaited<ReturnType<typeof GameHistoryStore.getTeamBattingLeaders>>["avgLeader"]>(
      null,
    );
  const [rbiLeader, setRbiLeader] =
    React.useState<Awaited<ReturnType<typeof GameHistoryStore.getTeamBattingLeaders>>["rbiLeader"]>(
      null,
    );
  const [eraLeader, setEraLeader] =
    React.useState<
      Awaited<ReturnType<typeof GameHistoryStore.getTeamPitchingLeaders>>["eraLeader"]
    >(null);
  const [savesLeader, setSavesLeader] =
    React.useState<
      Awaited<ReturnType<typeof GameHistoryStore.getTeamPitchingLeaders>>["savesLeader"]
    >(null);
  const [strikeoutsLeader, setStrikeoutsLeader] =
    React.useState<
      Awaited<ReturnType<typeof GameHistoryStore.getTeamPitchingLeaders>>["strikeoutsLeader"]
    >(null);

  const selectableTeamIds = React.useMemo<string[]>(() => {
    const customIds = customTeams.map((team) => team.id).sort((a, b) => a.localeCompare(b));
    const historyIds = [...teamsWithHistory].sort((a, b) => a.localeCompare(b));
    return Array.from(new Set([...customIds, ...historyIds]));
  }, [customTeams, teamsWithHistory]);

  React.useEffect(() => {
    let cancelled = false;

    async function loadTeamIds() {
      try {
        const db = await getDb();
        const completedGames = await db.completedGames.find().exec();
        if (cancelled) return;

        const ids = new Set<string>();
        for (const game of completedGames) {
          const row = game.toJSON();
          ids.add(row.homeTeamId);
          ids.add(row.awayTeamId);
        }
        setTeamsWithHistory(Array.from(ids));
        setHistoryLoaded(true);
      } catch {
        // Silently degrade — history just won't include non-custom teams.
        if (!cancelled) setHistoryLoaded(true);
      }
    }

    void loadTeamIds();
    return () => {
      cancelled = true;
    };
  }, []);

  // When there's no teamId in the URL yet and teams are available, redirect to the first team.
  React.useEffect(() => {
    if (teamsLoading || selectableTeamIds.length === 0 || selectedTeamId) return;
    navigate(`/stats/${selectableTeamIds[0]}`, { replace: true });
  }, [teamsLoading, selectableTeamIds, selectedTeamId, navigate]);

  React.useEffect(() => {
    if (!selectedTeamId) {
      setBattingRows([]);
      setPitchingRows([]);
      setTeamSummary(null);
      setHrLeader(null);
      setAvgLeader(null);
      setRbiLeader(null);
      setEraLeader(null);
      setSavesLeader(null);
      setStrikeoutsLeader(null);
      return;
    }

    let cancelled = false;
    setDataLoading(true);

    async function loadStats() {
      try {
        const [batting, pitching, summary] = await Promise.all([
          GameHistoryStore.getTeamCareerBattingStats(selectedTeamId),
          GameHistoryStore.getTeamCareerPitchingStats(selectedTeamId),
          GameHistoryStore.getTeamCareerSummary(selectedTeamId),
        ]);
        const [battingLeaders, pitchingLeaders] = await Promise.all([
          GameHistoryStore.getTeamBattingLeaders(selectedTeamId, { rows: batting }),
          GameHistoryStore.getTeamPitchingLeaders(selectedTeamId, { rows: pitching }),
        ]);
        if (cancelled) return;

        setBattingRows(batting);
        setPitchingRows(pitching);
        setTeamSummary(summary);
        setHrLeader(battingLeaders.hrLeader);
        setAvgLeader(battingLeaders.avgLeader);
        setRbiLeader(battingLeaders.rbiLeader);
        setEraLeader(pitchingLeaders.eraLeader);
        setSavesLeader(pitchingLeaders.savesLeader);
        setStrikeoutsLeader(pitchingLeaders.strikeoutsLeader);
      } catch {
        if (!cancelled) {
          setBattingRows([]);
          setPitchingRows([]);
          setTeamSummary(null);
        }
      } finally {
        if (!cancelled) {
          setDataLoading(false);
        }
      }
    }

    void loadStats();
    return () => {
      cancelled = true;
    };
  }, [selectedTeamId]);

  const isEmpty =
    !dataLoading && selectedTeamId !== "" && battingRows.length === 0 && pitchingRows.length === 0;

  const selectedCustomTeam = React.useMemo(
    () => customTeams.find((team) => team.id === selectedTeamId),
    [customTeams, selectedTeamId],
  );

  const noTeams = !teamsLoading && selectableTeamIds.length === 0;

  /**
   * True when the user has played zero completed games globally — the destination
   * for the always-visible Home → "Career stats" entry should render an
   * accessible empty state in this case rather than empty tables.
   */
  const noCompletedGames = historyLoaded && teamsWithHistory.length === 0;

  return {
    avgLeader,
    battingRows,
    customTeams,
    dataLoading,
    eraLeader,
    hrLeader,
    isEmpty,
    noCompletedGames,
    noTeams,
    pitchingRows,
    rbiLeader,
    savesLeader,
    selectableTeamIds,
    selectedCustomTeam,
    selectedTeamId,
    strikeoutsLeader,
    teamSummary,
  };
}
