import * as React from "react";

import type { TeamStanding } from "@feat/leagueMode/utils/calculateStandings";

import {
  StandingsHeading,
  StandingsSection as StandingsSectionWrapper,
  StandingsTable,
} from "./styles";

interface StandingsSectionProps {
  standings: TeamStanding[];
  getTeamName: (teamId: string) => string;
}

export const StandingsSection: React.FunctionComponent<StandingsSectionProps> = ({
  standings,
  getTeamName,
}) => (
  <StandingsSectionWrapper>
    <StandingsHeading>Standings</StandingsHeading>
    <StandingsTable data-testid="standings-table">
      <thead>
        <tr>
          <th>Rank</th>
          <th>Team</th>
          <th>W</th>
          <th>L</th>
          <th>PCT</th>
          <th>R</th>
          <th>RA</th>
          <th>DIFF</th>
        </tr>
      </thead>
      <tbody>
        {standings.map((s, i) => (
          <tr key={s.teamId}>
            <td>{i + 1}</td>
            <td>{getTeamName(s.teamId)}</td>
            <td>{s.wins}</td>
            <td>{s.losses}</td>
            <td>
              {s.gamesPlayed === 0
                ? ".000"
                : `.${Math.round(s.winPct * 1000)
                    .toString()
                    .padStart(3, "0")}`}
            </td>
            <td>{s.runsScored}</td>
            <td>{s.runsAllowed}</td>
            <td>{s.runDifferential > 0 ? `+${s.runDifferential}` : s.runDifferential}</td>
          </tr>
        ))}
      </tbody>
    </StandingsTable>
  </StandingsSectionWrapper>
);
