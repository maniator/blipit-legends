import { mq } from "@shared/utils/mediaQueries";
import styled from "styled-components";

export const SeasonTitle = styled.h1`
  font-size: ${({ theme }) => theme.fontSizes.h1};
  color: ${({ theme }) => theme.colors.textPrimary};
  margin: 0 0 ${({ theme }) => theme.spacing.md};
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  flex-wrap: wrap;
`;

export const StatusChip = styled.span<{ $status: "active" | "complete" | "abandoned" }>`
  display: inline-block;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: 600;
  padding: 2px 8px;
  border-radius: ${({ theme }) => theme.radii.pill};
  background: ${({ $status, theme }) =>
    $status === "active"
      ? theme.colors.chipSuccessBg
      : $status === "complete"
        ? theme.colors.chipAccentBg
        : theme.colors.chipNeutralBg};
  border: 1px solid
    ${({ $status, theme }) =>
      $status === "active"
        ? theme.colors.chipSuccessBorder
        : $status === "complete"
          ? theme.colors.chipAccentBorder
          : theme.colors.chipNeutralBorder};
  color: ${({ theme, $status }) =>
    $status === "active"
      ? theme.colors.statusSuccess
      : $status === "complete"
        ? theme.colors.accentPrimary
        : theme.colors.textHint};
`;

export const SeasonMeta = styled.div`
  margin-bottom: ${({ theme }) => theme.spacing.xl};
`;

export const GameDayRow = styled.p`
  font-size: ${({ theme }) => theme.fontSizes.body};
  color: ${({ theme }) => theme.colors.textHint};
  margin: 0 0 ${({ theme }) => theme.spacing.xs};
`;

export const SeasonProgress = styled.progress`
  width: 100%;
  max-width: 320px;
  height: 6px;
  appearance: none;
  border: none;
  border-radius: ${({ theme }) => theme.radii.sm};
  background: ${({ theme }) => theme.colors.bgFormAlpha15};
  display: block;

  &::-webkit-progress-bar {
    background: ${({ theme }) => theme.colors.bgFormAlpha15};
    border-radius: ${({ theme }) => theme.radii.sm};
  }

  &::-webkit-progress-value {
    background: ${({ theme }) => theme.colors.accentPrimary};
    border-radius: ${({ theme }) => theme.radii.sm};
  }

  &::-moz-progress-bar {
    background: ${({ theme }) => theme.colors.accentPrimary};
    border-radius: ${({ theme }) => theme.radii.sm};
  }
`;

export const StandingsTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  margin-bottom: ${({ theme }) => theme.spacing.xl};
  font-size: ${({ theme }) => theme.fontSizes.body};
`;

export const StandingsTh = styled.th`
  text-align: left;
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
  color: ${({ theme }) => theme.colors.textHint};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: 600;
  border-bottom: 1px solid ${({ theme }) => theme.colors.borderFormAlpha30};

  &:not(:first-child) {
    text-align: center;
  }
`;

export const StandingsTd = styled.td`
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
  color: ${({ theme }) => theme.colors.textBody};
  border-bottom: 1px solid ${({ theme }) => theme.colors.borderFormAlpha30};

  &:not(:first-child) {
    text-align: center;
  }
`;

export const StandingsRow = styled.tr<{ $rank: number }>`
  cursor: pointer;
  background: ${({ $rank, theme }) => ($rank === 0 ? theme.colors.bgFormAlpha15 : "transparent")};
  transition: background 0.1s ease;

  &:hover {
    background: ${({ theme }) => theme.colors.bgFormAlpha15};
  }

  &:last-child td {
    border-bottom: none;
  }
`;

export const StandingsTeamName = styled.span`
  font-weight: 500;
  color: ${({ theme }) => theme.colors.textPrimary};
`;

export const NavCardGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};

  ${mq.notMobile} {
    flex-direction: row;
    flex-wrap: wrap;
  }
`;

export const NavCard = styled.div`
  flex: 1;
  min-width: 160px;
  background: ${({ theme }) => theme.colors.bgFormAlpha15};
  border: 1px solid ${({ theme }) => theme.colors.borderFormAlpha30};
  border-radius: ${({ theme }) => theme.radii.card};
`;

export const NavCardLink = styled.a`
  display: block;
  padding: ${({ theme }) => theme.spacing.lg};
  text-decoration: none;
  cursor: pointer;

  &:hover {
    text-decoration: none;
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accentPrimary};
    outline-offset: 2px;
    border-radius: ${({ theme }) => theme.radii.card};
  }
`;

export const NavCardTitle = styled.p`
  font-size: ${({ theme }) => theme.fontSizes.body};
  color: ${({ theme }) => theme.colors.accentPrimary};
  font-weight: 600;
  margin: 0 0 ${({ theme }) => theme.spacing.xs};
`;

export const NavCardSub = styled.p`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.textHint};
  margin: 0;
`;
