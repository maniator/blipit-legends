import { mq } from "@shared/utils/mediaQueries";
import styled from "styled-components";

export {
  DividerTd,
  Table,
  Td,
  TeamFullLabel,
  TeamMobileLabel,
  TeamTd,
  TeamTh,
  Th,
} from "@shared/components/GameScoreTable/styles";

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

export const BsoRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.s14};
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

export const Dot = styled.span<{ $on: boolean; $color: string }>`
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: ${({ $on, $color, theme }) => ($on ? $color : theme.colors.borderLineScore)};
  border: 1px solid ${({ $on, $color, theme }) => ($on ? $color : theme.colors.borderLineScoreOff)};
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
