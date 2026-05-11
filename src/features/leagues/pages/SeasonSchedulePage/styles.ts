import styled from "styled-components";

export const PageTitle = styled.h1`
  font-size: ${({ theme }) => theme.fontSizes.h1};
  color: ${({ theme }) => theme.colors.textPrimary};
  margin: 0 0 ${({ theme }) => theme.spacing.xl};
`;

export const ScheduleList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xl};
`;

export const DaySection = styled.section``;

export const DayHeader = styled.h2`
  font-size: ${({ theme }) => theme.fontSizes.subLg};
  color: ${({ theme }) => theme.colors.textHint};
  font-weight: 600;
  margin: 0 0 ${({ theme }) => theme.spacing.sm};
  text-transform: uppercase;
  letter-spacing: 0.06em;
`;

export const GameRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.sm} 0;
  border-bottom: 1px solid ${({ theme }) => theme.colors.borderFormAlpha30};
  font-size: ${({ theme }) => theme.fontSizes.body};
  color: ${({ theme }) => theme.colors.textBody};

  &:last-child {
    border-bottom: none;
  }
`;

export const GameRowAway = styled.span`
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textPrimary};
  min-width: 48px;
  text-align: right;
`;

export const GameRowHome = styled.span`
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textPrimary};
  min-width: 48px;
`;

export const GameRowResult = styled.span`
  margin-left: auto;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.accentPrimary};
  font-variant-numeric: tabular-nums;
`;

export const GameRowStatus = styled.span<{ $status: "scheduled" | "in_progress" | "completed" }>`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme, $status }) =>
    $status === "in_progress" ? theme.colors.statusSuccess : theme.colors.textFaint};
`;

export const GameRowActions = styled.div`
  margin-left: auto;
  display: flex;
  gap: ${({ theme }) => theme.spacing.xs};
`;

export const LaunchErrorMsg = styled.p`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.textDanger};
  margin: ${({ theme }) => theme.spacing.xs} 0 0;
`;
