import * as React from "react";

import CareerStatsBattingTable from "@feat/careerStats/components/CareerStatsBattingTable";
import CareerStatsPitchingTable from "@feat/careerStats/components/CareerStatsPitchingTable";
import CareerStatsSummaryPanel from "@feat/careerStats/components/CareerStatsSummaryPanel";
import type { CareerStatsTab } from "@feat/careerStats/hooks/careerStatsShared";
import { useCareerStatsData } from "@feat/careerStats/hooks/useCareerStatsData";
import { useCareerStatsSorting } from "@feat/careerStats/hooks/useCareerStatsSorting";
import { resolveTeamLabel } from "@feat/customTeams/adapters/customTeamAdapter";
import { BackBtn, PageHeader } from "@shared/components/PageLayout/styles";
import { useNavigate } from "react-router";

import {
  CareerContainer,
  CareerEmptyBody,
  CareerEmptyCtaBtn,
  CareerEmptyHeading,
  CareerEmptyStateRegion,
  EmptyState,
  PageTitle,
  TabBar,
  TabBtn,
  TeamEditorLinkBtn,
  TeamSelect,
  TeamSelectLabel,
  TeamSelectorRow,
} from "./styles";

const CareerStatsPage: React.FunctionComponent = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = React.useState<CareerStatsTab>("batting");
  const emptyHeadingRef = React.useRef<HTMLHeadingElement | null>(null);

  const {
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
  } = useCareerStatsData();

  const {
    battingSort,
    handleBattingThClick,
    handleBattingThKeyDown,
    handlePitchingThClick,
    handlePitchingThKeyDown,
    pitchingSort,
    sortedBattingRows,
    sortedPitchingRows,
  } = useCareerStatsSorting(battingRows, pitchingRows);

  const openPlayerCareer = React.useCallback(
    (playerId: string) => {
      navigate(
        `/stats/${encodeURIComponent(selectedTeamId)}/players/${encodeURIComponent(playerId)}`,
      );
    },
    [navigate, selectedTeamId],
  );

  // Move SR focus to the empty-state heading on first paint when there are
  // zero completed games — gives screen-reader users immediate context.
  React.useEffect(() => {
    if (noCompletedGames && emptyHeadingRef.current) {
      emptyHeadingRef.current.focus();
    }
  }, [noCompletedGames]);

  return (
    <CareerContainer data-testid="career-stats-page">
      <PageHeader>
        <BackBtn type="button" onClick={() => navigate("/")} aria-label="Go back to home">
          ← Back
        </BackBtn>
      </PageHeader>

      <PageTitle>📊 Career Stats</PageTitle>

      {noCompletedGames ? (
        <CareerEmptyStateRegion
          role="region"
          aria-labelledby="career-empty-heading"
          data-testid="career-stats-empty-state"
        >
          <CareerEmptyHeading id="career-empty-heading" ref={emptyHeadingRef} tabIndex={-1}>
            No games yet
          </CareerEmptyHeading>
          <CareerEmptyBody>
            Play your first game to start tracking career stats for every player and team.
          </CareerEmptyBody>
          <CareerEmptyCtaBtn
            type="button"
            data-testid="career-stats-empty-play-ball"
            onClick={() => navigate("/exhibition/new")}
          >
            Play Ball
          </CareerEmptyCtaBtn>
        </CareerEmptyStateRegion>
      ) : noTeams ? (
        <EmptyState data-testid="career-stats-no-teams">
          No teams yet. Create a team and play a completed game to see career stats.
        </EmptyState>
      ) : (
        <>
          <TeamSelectorRow>
            <TeamSelectLabel htmlFor="career-stats-team-select">Team:</TeamSelectLabel>
            <TeamSelect
              id="career-stats-team-select"
              data-testid="career-stats-team-select"
              value={selectedTeamId}
              onChange={(event) => navigate(`/stats/${encodeURIComponent(event.target.value)}`)}
            >
              {selectableTeamIds.map((id) => (
                <option key={id} value={id}>
                  {resolveTeamLabel(id, customTeams)}
                </option>
              ))}
            </TeamSelect>
            {selectedCustomTeam && (
              <TeamEditorLinkBtn
                type="button"
                data-testid="career-stats-edit-team-button"
                onClick={() => navigate(`/teams/${selectedCustomTeam.id}/edit`)}
              >
                Edit This Team
              </TeamEditorLinkBtn>
            )}
          </TeamSelectorRow>

          <CareerStatsSummaryPanel
            avgLeader={avgLeader}
            dataLoading={dataLoading}
            eraLeader={eraLeader}
            hrLeader={hrLeader}
            onOpenPlayer={openPlayerCareer}
            rbiLeader={rbiLeader}
            savesLeader={savesLeader}
            strikeoutsLeader={strikeoutsLeader}
            teamSummary={teamSummary}
          />

          <TabBar>
            <TabBtn
              type="button"
              $active={activeTab === "batting"}
              onClick={() => setActiveTab("batting")}
              data-testid="career-stats-batting-tab"
            >
              Batting
            </TabBtn>
            <TabBtn
              type="button"
              $active={activeTab === "pitching"}
              onClick={() => setActiveTab("pitching")}
              data-testid="career-stats-pitching-tab"
            >
              Pitching
            </TabBtn>
          </TabBar>

          {isEmpty && (
            <EmptyState data-testid="career-stats-empty">
              No completed games yet for this team.
            </EmptyState>
          )}

          {!isEmpty && activeTab === "batting" && sortedBattingRows.length > 0 && (
            <CareerStatsBattingTable
              rows={sortedBattingRows}
              sort={battingSort}
              onHeaderClick={handleBattingThClick}
              onHeaderKeyDown={handleBattingThKeyDown}
              onPlayerSelect={openPlayerCareer}
            />
          )}

          {!isEmpty && activeTab === "pitching" && sortedPitchingRows.length > 0 && (
            <CareerStatsPitchingTable
              rows={sortedPitchingRows}
              sort={pitchingSort}
              onHeaderClick={handlePitchingThClick}
              onHeaderKeyDown={handlePitchingThKeyDown}
              onPlayerSelect={openPlayerCareer}
            />
          )}
        </>
      )}
    </CareerContainer>
  );
};

export default CareerStatsPage;
