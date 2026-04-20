import { mq } from "@shared/utils/mediaQueries";
import { Link } from "react-router";
import styled from "styled-components";

export { BackBtn, PageContainer, PageHeader } from "@shared/components/PageLayout/styles";

export const PageTitle = styled.h1`
  color: ${({ theme }) => theme.colors.textPrimary};
  font-size: ${({ theme }) => theme.fontSizes.h1};
  margin: 0 0 ${({ theme }) => theme.spacing.xl};

  ${mq.mobile} {
    font-size: ${({ theme }) => theme.fontSizes.xxl};
  }
`;

export const LeagueList = styled.ul`
  list-style: none;
  margin: 0 0 ${({ theme }) => theme.spacing.xl};
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`;

export const LeagueItem = styled.li`
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: ${({ theme }) => theme.colors.bgSurface};
  border: 1px solid ${({ theme }) => theme.colors.borderPanel};
  border-radius: ${({ theme }) => theme.radii.card};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  gap: ${({ theme }) => theme.spacing.md};

  ${mq.mobile} {
    padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
    flex-wrap: wrap;
  }
`;

export const LeagueName = styled.span`
  color: ${({ theme }) => theme.colors.textBody};
  font-size: ${({ theme }) => theme.fontSizes.body};
  font-weight: 600;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const ViewLink = styled(Link)`
  color: ${({ theme }) => theme.colors.textLink};
  font-size: ${({ theme }) => theme.fontSizes.base};
  font-family: inherit;
  text-decoration: none;
  border: 1px solid ${({ theme }) => theme.colors.borderForm};
  border-radius: ${({ theme }) => theme.radii.md};
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
  flex-shrink: 0;

  &:hover {
    background: ${({ theme }) => theme.colors.bgSurface};
    border-color: ${({ theme }) => theme.colors.textSecondaryLink};
    color: ${({ theme }) => theme.colors.textBody};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accentPrimary};
    outline-offset: 2px;
  }
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

export const EmptyStateText = styled.p`
  margin: 0;
`;

export const CreateButton = styled.button`
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

export const LoadingState = styled.p`
  color: ${({ theme }) => theme.colors.textHint};
  font-size: ${({ theme }) => theme.fontSizes.body};
  margin: ${({ theme }) => theme.spacing.xxl} 0;
`;
