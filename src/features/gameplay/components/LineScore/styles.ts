import { mq } from "@shared/utils/mediaQueries";
import styled from "styled-components";

export const Wrapper = styled.div`
  overflow-x: auto;
  margin: ${({ theme }) => theme.spacing.sm} 0 0;

  ${mq.mobile} {
    order: -1;
    background: ${({ theme }) => theme.colors.bgVoid};
    margin: 0 0 ${({ theme }) => theme.spacing.xs};
    padding-bottom: ${({ theme }) => theme.spacing.xs};
  }
`;

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

export const BsoRow = styled.div`
  display: flex;
  align-items: center;
  column-gap: ${({ theme }) => theme.spacing.s14};
  padding: ${({ theme }) => theme.spacing.s6} ${({ theme }) => theme.spacing.sm}
    ${({ theme }) => theme.spacing.xs};
  background: ${({ theme }) => theme.colors.bgGame};
  font-family: ${({ theme }) => theme.fonts.score};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.textScoreHeader};
  letter-spacing: ${({ theme }) => theme.letterSpacing.normal};

  ${mq.notMobile} {
    font-size: ${({ theme }) => theme.fontSizes.label};
  }
`;

export const BsoGroup = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.s5};
`;

export const Dot = styled.span<{ $on: boolean; $type: "ball" | "strike" | "out" }>`
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: ${({ $on, $type, theme }) => {
    if (!$on) return theme.colors.borderLineScore;
    if ($type === "ball") return theme.colors.bsoBall;
    if ($type === "strike") return theme.colors.bsoStrike;
    return theme.colors.bsoOut;
  }};
  border: 1px solid
    ${({ $on, $type, theme }) => {
      if (!$on) return theme.colors.borderLineScoreOff;
      if ($type === "ball") return theme.colors.bsoBall;
      if ($type === "strike") return theme.colors.bsoStrike;
      return theme.colors.bsoOut;
    }};
  box-shadow: ${({ $on, theme }) => ($on ? `inset 0 0 0 1px ${theme.colors.bsoDotInset}` : "none")};
`;

export const ExtraInningsBanner = styled.div`
  background: ${({ theme }) => theme.colors.bgNavActive};
  color: ${({ theme }) => theme.colors.textPrimary};
  font-weight: bold;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  padding: ${({ theme }) => theme.spacing.xxs} ${({ theme }) => theme.spacing.sm};
  letter-spacing: ${({ theme }) => theme.letterSpacing.widest};
  margin-left: auto;
`;

export const GameOverBanner = styled.div`
  background: ${({ theme }) => theme.colors.bgDanger};
  color: ${({ theme }) => theme.colors.textPrimary};
  text-align: center;
  font-weight: bold;
  font-size: ${({ theme }) => theme.fontSizes.label};
  padding: ${({ theme }) => theme.spacing.s3} ${({ theme }) => theme.spacing.sm};
  letter-spacing: ${({ theme }) => theme.letterSpacing.widest};
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
