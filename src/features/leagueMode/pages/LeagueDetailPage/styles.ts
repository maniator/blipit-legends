import { mq } from "@shared/utils/mediaQueries";
import { Link } from "react-router";
import styled from "styled-components";

export { BackBtn, PageContainer, PageHeader } from "@shared/components/PageLayout/styles";

export const PageTitle = styled.h1`
  color: ${({ theme }) => theme.colors.textPrimary};
  font-size: ${({ theme }) => theme.fontSizes.h1};
  margin: 0 0 ${({ theme }) => theme.spacing.sm};

  ${mq.mobile} {
    font-size: ${({ theme }) => theme.fontSizes.xxl};
  }
`;

export const SeasonInfo = styled.p`
  color: ${({ theme }) => theme.colors.textHint};
  font-size: ${({ theme }) => theme.fontSizes.body};
  margin: 0 0 ${({ theme }) => theme.spacing.xl};
`;

export const LoadingState = styled.p`
  color: ${({ theme }) => theme.colors.textHint};
  font-size: ${({ theme }) => theme.fontSizes.body};
  margin: ${({ theme }) => theme.spacing.xxl} 0;
`;

export const EmptyState = styled.div`
  color: ${({ theme }) => theme.colors.textHint};
  font-size: ${({ theme }) => theme.fontSizes.body};
  text-align: center;
  margin: ${({ theme }) => theme.spacing.s40} 0 ${({ theme }) => theme.spacing.xl};
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
`;

export const ErrorMessage = styled.p`
  color: ${({ theme }) => theme.colors.dangerText};
  background: ${({ theme }) => theme.colors.errorBgTransparent};
  border: 1px solid ${({ theme }) => theme.colors.borderDanger};
  border-radius: ${({ theme }) => theme.radii.md};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  font-size: ${({ theme }) => theme.fontSizes.base};
  margin-top: ${({ theme }) => theme.spacing.s10};
`;

export const StartSeasonButton = styled.button`
  background: ${({ theme }) => theme.colors.accentPrimary};
  color: ${({ theme }) => theme.colors.btnPrimaryText};
  border: none;
  border-radius: ${({ theme }) => theme.radii.pill};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.xxl};
  font-family: inherit;
  font-size: ${({ theme }) => theme.fontSizes.body};
  font-weight: 700;
  cursor: pointer;
  margin-bottom: ${({ theme }) => theme.spacing.lg};

  &:hover {
    opacity: 0.88;
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accentPrimary};
    outline-offset: 2px;
  }
`;

export const SeasonNotStarted = styled.p`
  color: ${({ theme }) => theme.colors.textHint};
  font-size: ${({ theme }) => theme.fontSizes.body};
  margin: 0 0 ${({ theme }) => theme.spacing.xl};
`;

export const SeasonStats = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.lg};
  flex-wrap: wrap;
  margin-bottom: ${({ theme }) => theme.spacing.xl};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  background: ${({ theme }) => theme.colors.bgSurface};
  border: 1px solid ${({ theme }) => theme.colors.borderPanel};
  border-radius: ${({ theme }) => theme.radii.card};

  ${mq.mobile} {
    gap: ${({ theme }) => theme.spacing.md};
    padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  }
`;

export const StatItem = styled.span`
  color: ${({ theme }) => theme.colors.textBody};
  font-size: ${({ theme }) => theme.fontSizes.base};
`;

export const ScheduleTable = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xl};
`;

export const GameDaySection = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
`;

export const GameDayHeading = styled.h2`
  color: ${({ theme }) => theme.colors.textSecondaryLink};
  font-size: ${({ theme }) => theme.fontSizes.sub};
  font-weight: 600;
  letter-spacing: ${({ theme }) => theme.letterSpacing.tight};
  text-transform: uppercase;
  margin: 0 0 ${({ theme }) => theme.spacing.xs};
`;

export const GameRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  background: ${({ theme }) => theme.colors.bgSurface};
  border: 1px solid ${({ theme }) => theme.colors.borderPanel};
  border-radius: ${({ theme }) => theme.radii.md};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};

  ${mq.mobile} {
    padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
    flex-wrap: wrap;
  }
`;

export const TeamName = styled.span`
  color: ${({ theme }) => theme.colors.textBody};
  font-size: ${({ theme }) => theme.fontSizes.base};
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const VsSeparator = styled.span`
  color: ${({ theme }) => theme.colors.textHint};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  flex-shrink: 0;
`;

export const ByeLabel = styled.span`
  color: ${({ theme }) => theme.colors.textHint};
  font-size: ${({ theme }) => theme.fontSizes.base};
  font-style: italic;
  flex: 1;
`;

type StatusBadgeProps = {
  $status: "scheduled" | "completed" | "bye";
};

export const StatusBadge = styled.span<StatusBadgeProps>`
  flex-shrink: 0;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: 600;
  letter-spacing: ${({ theme }) => theme.letterSpacing.tight};
  text-transform: uppercase;
  padding: 2px ${({ theme }) => theme.spacing.xs};
  border-radius: ${({ theme }) => theme.radii.sm};

  ${({ $status, theme }) => {
    switch ($status) {
      case "completed":
        return `
          color: ${theme.colors.bsoBall};
          background: rgba(68, 204, 136, 0.12);
          border: 1px solid rgba(68, 204, 136, 0.3);
        `;
      case "bye":
        return `
          color: ${theme.colors.textHint};
          background: transparent;
          border: 1px solid ${theme.colors.borderSubtle};
        `;
      default:
        // scheduled
        return `
          color: ${theme.colors.textSubdued};
          background: transparent;
          border: 1px solid ${theme.colors.borderSubtle};
        `;
    }
  }}
`;

export const PlayButton = styled.button`
  background: ${({ theme }) => theme.colors.accentPrimary};
  color: ${({ theme }) => theme.colors.btnPrimaryText};
  border: none;
  border-radius: ${({ theme }) => theme.radii.pill};
  padding: 2px ${({ theme }) => theme.spacing.sm};
  font-family: inherit;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: 700;
  cursor: pointer;
  flex-shrink: 0;
  min-height: ${({ theme }) => theme.sizes.btnMd};

  &:hover {
    opacity: 0.88;
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accentPrimary};
    outline-offset: 2px;
  }

  ${mq.mobile} {
    font-size: ${({ theme }) => theme.fontSizes.xs};
    padding: 1px ${({ theme }) => theme.spacing.xs};
  }
`;

export const BackLink = styled(Link)`
  color: ${({ theme }) => theme.colors.textHint};
  border: none;
  background: transparent;
  font-size: ${({ theme }) => theme.fontSizes.base};
  font-family: inherit;
  cursor: pointer;
  padding: ${({ theme }) => theme.spacing.xs} 0;
  min-height: ${({ theme }) => theme.sizes.btnMd};
  text-decoration: none;
  display: inline-flex;
  align-items: center;

  &:hover {
    color: ${({ theme }) => theme.colors.textLink};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accentPrimary};
    outline-offset: 2px;
    border-radius: ${({ theme }) => theme.radii.sm};
  }
`;
