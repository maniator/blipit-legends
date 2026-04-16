import * as React from "react";

import { customTeamToDisplayName } from "@feat/customTeams/adapters/customTeamAdapter";
import { useGameContext } from "@feat/gameplay/context/index";
import { Hit } from "@shared/constants/hitTypes";
import { useTeamWithRoster } from "@shared/hooks/useTeamWithRoster";

import {
  BsoGroup,
  BsoRow,
  DividerTd,
  Dot,
  ExtraInningsBanner,
  GameOverBanner,
  Table,
  Td,
  TeamFullLabel,
  TeamMobileLabel,
  TeamTd,
  TeamTh,
  Th,
  Wrapper,
} from "./styles";

/** Returns the run display for a given team/inning cell. */
function getCellValue(
  team: 0 | 1,
  n: number,
  inning: number,
  atBat: 0 | 1,
  gameOver: boolean,
  inningRuns: [number[], number[]],
): string | number {
  const hasStarted =
    team === 0
      ? n <= inning
      : n < inning || (n === inning && atBat === 1) || (n === inning && gameOver);
  if (!hasStarted) return "-";
  return inningRuns[team][n - 1] ?? 0;
}

const LineScore: React.FunctionComponent = () => {
  const {
    teams,
    teamLabels,
    score,
    inning,
    atBat,
    gameOver,
    inningRuns,
    playLog,
    balls,
    strikes,
    outs,
  } = useGameContext();
  const awayTeamDoc = useTeamWithRoster(teams[0]);
  const homeTeamDoc = useTeamWithRoster(teams[1]);
  const teamDocs = [awayTeamDoc, homeTeamDoc] as const;

  /**
   * Returns the full display name for a team. Always sourced from the DB-fetched doc.
   * `teamLabels` from state is used first (set at game-start and on save restore).
   * Falls back to the doc name while state is being hydrated.
   */
  const fullLabel = (team: 0 | 1): string => {
    const label = teamLabels[team];
    if (label && !label.startsWith("ct_")) return label;
    const doc = teamDocs[team];
    if (doc) return customTeamToDisplayName(doc);
    return "Unknown Team";
  };

  /** Returns the compact abbreviation for a team — always from the DB doc. */
  const compactLabel = (team: 0 | 1): string => {
    const doc = teamDocs[team];
    if (!doc) {
      const label = teamLabels[team];
      if (label && !label.startsWith("ct_")) return label.trim().toUpperCase().slice(0, 3) || "???";
      return "???";
    }
    if (doc.abbreviation) return doc.abbreviation;
    return doc.name.trim().toUpperCase().slice(0, 3) || "???";
  };

  const displayInnings = gameOver && atBat === 0 ? inning - 1 : inning;
  const totalInnings = Math.max(9, displayInnings);
  const inningCols = Array.from({ length: totalInnings }, (_, i) => i + 1);
  const hits = (team: 0 | 1) =>
    playLog.filter((e) => e.team === team && e.event !== Hit.Walk && e.event !== Hit.HitByPitch)
      .length;

  return (
    <Wrapper data-testid="scoreboard">
      <Table>
        <thead>
          <tr>
            <TeamTh>Team</TeamTh>
            {inningCols.map((n) => (
              <Th key={n} $accent={n === inning}>
                {n}
              </Th>
            ))}
            <DividerTd as="th" />
            <Th $accent>R</Th>
            <Th $accent>H</Th>
          </tr>
        </thead>
        <tbody>
          {([0, 1] as const).map((team) => (
            <tr key={team}>
              <TeamTd $active={atBat === team} title={fullLabel(team)}>
                <TeamMobileLabel>{compactLabel(team)}</TeamMobileLabel>
                <TeamFullLabel>{fullLabel(team)}</TeamFullLabel>
              </TeamTd>
              {inningCols.map((n) => {
                const val = getCellValue(team, n, inning, atBat as 0 | 1, gameOver, inningRuns);
                return (
                  <Td key={n} $active={n === inning && atBat === team} $dim={val === "-"}>
                    {val}
                  </Td>
                );
              })}
              <DividerTd />
              <Td $accent>{score[team]}</Td>
              <Td $accent>{hits(team)}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <BsoRow>
        <BsoGroup>
          B
          {[0, 1, 2].map((i) => (
            <Dot key={i} $on={i < balls} $color="#4caf50" />
          ))}
        </BsoGroup>
        <BsoGroup>
          S
          {[0, 1].map((i) => (
            <Dot key={i} $on={i < strikes} $color="#f5c842" />
          ))}
        </BsoGroup>
        <BsoGroup>
          O
          {[0, 1].map((i) => (
            <Dot key={i} $on={i < outs} $color="#e05050" />
          ))}
        </BsoGroup>
        {inning > 9 && !gameOver && <ExtraInningsBanner>EXTRA INNINGS</ExtraInningsBanner>}
        {gameOver && <GameOverBanner>FINAL</GameOverBanner>}
      </BsoRow>
    </Wrapper>
  );
};

export default LineScore;
