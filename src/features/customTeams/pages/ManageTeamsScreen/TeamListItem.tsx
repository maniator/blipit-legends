import * as React from "react";

import { customTeamToDisplayName } from "@feat/customTeams/adapters/customTeamAdapter";

import type { TeamWithRoster } from "@storage/types";

import { ActionBtn, TeamActions, TeamInfo, TeamListItemCard, TeamMeta, TeamName } from "./styles";

type Props = {
  team: TeamWithRoster;
  onCareerStats: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onExport: (id: string) => void;
};

const TeamListItem: React.FunctionComponent<Props> = ({
  team,
  onCareerStats,
  onEdit,
  onDelete,
  onExport,
}) => {
  const displayName = customTeamToDisplayName(team);
  const lineupCount = team.roster.lineup.length;
  const pitcherCount = team.roster.pitchers.length;
  const benchCount = team.roster.bench?.length ?? 0;

  const handleDelete = () => {
    if (window.confirm(`Delete "${displayName}"? This cannot be undone.`)) {
      onDelete(team.id);
    }
  };

  return (
    <TeamListItemCard data-testid="custom-team-list-item">
      <TeamInfo>
        <TeamName>{displayName}</TeamName>
        <TeamMeta>
          {lineupCount} batters · {pitcherCount} pitchers · {benchCount} bench
        </TeamMeta>
      </TeamInfo>
      <TeamActions>
        <ActionBtn
          type="button"
          onClick={() => onCareerStats(team.id)}
          data-testid="custom-team-career-stats-button"
        >
          Career Stats
        </ActionBtn>
        <ActionBtn
          type="button"
          onClick={() => onEdit(team.id)}
          data-testid="custom-team-edit-button"
        >
          Edit
        </ActionBtn>
        <ActionBtn type="button" onClick={() => onExport(team.id)} data-testid="export-team-button">
          Export
        </ActionBtn>
        <ActionBtn
          type="button"
          $danger
          onClick={handleDelete}
          data-testid="custom-team-delete-button"
        >
          Delete
        </ActionBtn>
      </TeamActions>
    </TeamListItemCard>
  );
};

export default TeamListItem;
