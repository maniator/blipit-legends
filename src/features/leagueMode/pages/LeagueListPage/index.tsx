import * as React from "react";

import { useLeagues } from "@feat/leagueMode/hooks/useLeagues";
import { useNavigate, useOutletContext } from "react-router";

import type { AppShellOutletContext } from "@storage/types";

import {
  BackBtn,
  CreateButton,
  EmptyState,
  EmptyStateText,
  LeagueItem,
  LeagueList,
  LeagueName,
  LoadingState,
  PageContainer,
  PageHeader,
  PageTitle,
  ViewLink,
} from "./styles";

const LeagueListPage: React.FunctionComponent = () => {
  const navigate = useNavigate();
  const { onBackToHome } = useOutletContext<AppShellOutletContext>();
  const { leagues, isLoading } = useLeagues("active");

  const handleCreateLeague = React.useCallback(() => {
    navigate("/league/new");
  }, [navigate]);

  return (
    <PageContainer data-testid="league-list-page">
      <PageHeader>
        <BackBtn
          type="button"
          onClick={onBackToHome}
          data-testid="league-list-back-button"
          aria-label="Back to Home"
        >
          ← Back to Home
        </BackBtn>
      </PageHeader>

      <PageTitle>🏆 Leagues</PageTitle>

      <CreateButton type="button" onClick={handleCreateLeague} data-testid="create-league-button">
        Create New League
      </CreateButton>

      {isLoading ? (
        <LoadingState>Loading leagues…</LoadingState>
      ) : leagues.length === 0 ? (
        <EmptyState data-testid="league-list-empty">
          <EmptyStateText>No active leagues. Create your first league!</EmptyStateText>
          <CreateButton
            type="button"
            onClick={handleCreateLeague}
            data-testid="create-league-empty-button"
          >
            Create League
          </CreateButton>
        </EmptyState>
      ) : (
        <LeagueList data-testid="league-list">
          {leagues.map((league) => (
            <LeagueItem key={league.id}>
              <LeagueName>{league.name}</LeagueName>
              <ViewLink href={`/league/${league.id}`} data-testid={`league-view-link-${league.id}`}>
                View
              </ViewLink>
            </LeagueItem>
          ))}
        </LeagueList>
      )}
    </PageContainer>
  );
};

export default LeagueListPage;
