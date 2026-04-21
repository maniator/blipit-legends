import * as React from "react";

import { DividerTd, Table, Td, TeamTd, TeamTh, Th } from "./styles";

export interface GameScoreTableProps {
  /** Full display name for the away team. */
  awayLabel: string;
  /** Full display name for the home team. */
  homeLabel: string;
  /** Per-inning run totals for the away team. */
  awayRuns: number[];
  /** Per-inning run totals for the home team. */
  homeRuns: number[];
  /** Final score for the away team. */
  awayScore: number;
  /** Final score for the home team. */
  homeScore: number;
  /** Optional hit totals — shown as an "H" column when provided. */
  awayHits?: number;
  homeHits?: number;
}

/**
 * Presentational box-score table for a completed game.
 *
 * Renders the same styled score table used by the live-game scoreboard
 * (`LineScore`) so completed games (e.g. in the league schedule view) look
 * consistent with in-progress games.
 */
const GameScoreTable: React.FunctionComponent<GameScoreTableProps> = ({
  awayLabel,
  homeLabel,
  awayRuns,
  homeRuns,
  awayScore,
  homeScore,
  awayHits,
  homeHits,
}) => {
  const innings = Math.max(awayRuns.length, homeRuns.length, 9);
  const inningCols = Array.from({ length: innings }, (_, i) => i + 1);
  const showHits = awayHits !== undefined && homeHits !== undefined;

  return (
    <Table>
      <thead>
        <tr>
          <TeamTh>Team</TeamTh>
          {inningCols.map((n) => (
            <Th key={n}>{n}</Th>
          ))}
          <DividerTd as="th" />
          <Th $accent>R</Th>
          {showHits && <Th $accent>H</Th>}
        </tr>
      </thead>
      <tbody>
        {(
          [
            { label: awayLabel, runs: awayRuns, score: awayScore, hits: awayHits },
            { label: homeLabel, runs: homeRuns, score: homeScore, hits: homeHits },
          ] as const
        ).map(({ label, runs, score, hits }) => (
          <tr key={label}>
            <TeamTd title={label}>{label}</TeamTd>
            {inningCols.map((n) => (
              <Td key={n}>{runs[n - 1] ?? 0}</Td>
            ))}
            <DividerTd />
            <Td $accent>{score}</Td>
            {showHits && <Td $accent>{hits}</Td>}
          </tr>
        ))}
      </tbody>
    </Table>
  );
};

export default GameScoreTable;
