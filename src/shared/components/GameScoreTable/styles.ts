import { mq } from "@shared/utils/mediaQueries";
import styled from "styled-components";

export const Table = styled.table`
  border-collapse: collapse;
  font-family: ${({ theme }) => theme.fonts.score};
  font-size: ${({ theme }) => theme.fontSizes.base};
  background: ${({ theme }) => theme.colors.bgGame};
  color: ${({ theme }) => theme.colors.textScore};
  width: 100%;

  ${mq.notMobile} {
    font-size: ${({ theme }) => theme.fontSizes.md};
  }
`;

export const Th = styled.th<{ $accent?: boolean }>`
  padding: ${({ theme }) => theme.spacing.s3} ${({ theme }) => theme.spacing.s6};
  text-align: center;
  color: ${({ $accent, theme }) =>
    $accent ? theme.colors.accentPrimary : theme.colors.textScoreHeader};
  border-bottom: 1px solid ${({ theme }) => theme.colors.borderLineScore};
  font-weight: normal;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  letter-spacing: ${({ theme }) => theme.letterSpacing.normal};
  white-space: nowrap;

  ${mq.notMobile} {
    font-size: ${({ theme }) => theme.fontSizes.base};
    padding: ${({ theme }) => theme.spacing.s3} ${({ theme }) => theme.spacing.sm};
  }
`;

export const TeamTh = styled(Th)`
  text-align: left;
  min-width: 60px;
  max-width: 90px;
  overflow: hidden;
  text-overflow: ellipsis;

  ${mq.notMobile} {
    min-width: 90px;
    max-width: 140px;
  }
`;

export const Td = styled.td<{ $active?: boolean; $accent?: boolean; $dim?: boolean }>`
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.s6};
  text-align: center;
  font-weight: ${({ $accent }) => ($accent ? "bold" : "normal")};
  color: ${({ $active, $accent, $dim, theme }) =>
    $active
      ? theme.colors.textPrimary
      : $accent
        ? theme.colors.accentPrimary
        : $dim
          ? theme.colors.textScoreDim
          : theme.colors.textScore};
  border-right: ${({ $accent, theme }) =>
    $accent ? "none" : `1px solid ${theme.colors.borderLineScoreCell}`};
  white-space: nowrap;

  ${mq.notMobile} {
    padding: ${({ theme }) => theme.spacing.s5} ${({ theme }) => theme.spacing.sm};
  }
`;

export const TeamTd = styled(Td)`
  text-align: left;
  font-size: ${({ theme }) => theme.fontSizes.label};
  border-right: 1px solid ${({ theme }) => theme.colors.borderLineScore};
  padding-right: ${({ theme }) => theme.spacing.sm};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 90px;

  ${mq.notMobile} {
    font-size: ${({ theme }) => theme.fontSizes.base};
    max-width: 140px;
  }
`;

export const DividerTd = styled.td`
  border-left: 1px solid ${({ theme }) => theme.colors.borderLineScore};
  padding: 0;
  width: 4px;
`;

/**
 * Visible only on mobile — shows the short team abbreviation (e.g. "NYY")
 * so the narrow team-name column does not need to truncate a long full name.
 */
export const TeamMobileLabel = styled.span`
  display: none;
  ${mq.mobile} {
    display: inline;
  }
`;

/**
 * Visible on tablet and desktop — shows the full team name with ellipsis
 * truncation handled by the parent `TeamTd`.
 */
export const TeamFullLabel = styled.span`
  display: inline;
  ${mq.mobile} {
    display: none;
  }
`;
