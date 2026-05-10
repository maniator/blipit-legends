import { mq } from "@shared/utils/mediaQueries";
import styled from "styled-components";

export const HubGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xl};

  ${mq.notMobile} {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: ${({ theme }) => theme.spacing.xl};
    align-items: start;
  }
`;

export const ContinueCard = styled.a`
  display: block;
  background: ${({ theme }) => theme.colors.bgFormAlpha15};
  border: 1px solid ${({ theme }) => theme.colors.borderFormAlpha30};
  border-radius: ${({ theme }) => theme.radii.card};
  padding: ${({ theme }) => theme.spacing.xl};
  cursor: pointer;
  text-decoration: none;
  transition: border-color 0.15s ease;

  &:hover {
    border-color: ${({ theme }) => theme.colors.borderFormAlpha40};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accentPrimary};
    outline-offset: 2px;
    border-radius: ${({ theme }) => theme.radii.card};
  }

  ${mq.notMobile} {
    grid-row: span 2;
  }
`;

export const ContinueTitle = styled.p`
  font-size: ${({ theme }) => theme.fontSizes.h2};
  color: ${({ theme }) => theme.colors.accentPrimary};
  margin: 0 0 ${({ theme }) => theme.spacing.sm};
  font-weight: 600;
`;

export const ContinueSub = styled.p`
  font-size: ${({ theme }) => theme.fontSizes.body};
  color: ${({ theme }) => theme.colors.textHint};
  margin: 0;
`;

export const SectionCard = styled.div`
  background: ${({ theme }) => theme.colors.bgFormAlpha15};
  border: 1px solid ${({ theme }) => theme.colors.borderFormAlpha30};
  border-radius: ${({ theme }) => theme.radii.card};
  padding: ${({ theme }) => theme.spacing.lg};
`;

export const SectionActions = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
`;

export const ActionLink = styled.a`
  display: inline-block;
  color: ${({ theme }) => theme.colors.accentPrimary};
  font-size: ${({ theme }) => theme.fontSizes.body};
  text-decoration: none;
  padding: ${({ theme }) => theme.spacing.sm} 0;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accentPrimary};
    outline-offset: 2px;
    border-radius: ${({ theme }) => theme.radii.sm};
  }
`;

export const SecondaryLink = styled.a`
  display: inline-block;
  color: ${({ theme }) => theme.colors.textSecondaryLink};
  font-size: ${({ theme }) => theme.fontSizes.body};
  text-decoration: none;
  padding: ${({ theme }) => theme.spacing.sm} 0;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accentPrimary};
    outline-offset: 2px;
    border-radius: ${({ theme }) => theme.radii.sm};
  }
`;

export const PastSeasonsDetails = styled.details`
  margin-top: ${({ theme }) => theme.spacing.md};

  > summary {
    cursor: pointer;
    color: ${({ theme }) => theme.colors.textSecondaryLink};
    font-size: ${({ theme }) => theme.fontSizes.body};
    list-style: none;
    padding: ${({ theme }) => theme.spacing.sm} 0;
    user-select: none;

    &::-webkit-details-marker {
      display: none;
    }

    &:hover {
      text-decoration: underline;
    }

    &:focus-visible {
      outline: 2px solid ${({ theme }) => theme.colors.accentPrimary};
      outline-offset: 2px;
      border-radius: ${({ theme }) => theme.radii.sm};
    }
  }
`;

export const SeasonList = styled.ul`
  list-style: none;
  margin: ${({ theme }) => theme.spacing.sm} 0 0;
  padding: 0;
`;

export const SeasonListItem = styled.li`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${({ theme }) => theme.spacing.sm} 0;
  border-bottom: 1px solid ${({ theme }) => theme.colors.borderFormAlpha30};

  &:last-child {
    border-bottom: none;
  }
`;

export const SeasonItemLink = styled.a`
  color: ${({ theme }) => theme.colors.textSecondaryLink};
  text-decoration: none;
  font-size: ${({ theme }) => theme.fontSizes.body};
  flex: 1;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accentPrimary};
    outline-offset: 2px;
    border-radius: ${({ theme }) => theme.radii.sm};
  }
`;

export const SeasonItemMeta = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.textHint};
  margin-left: ${({ theme }) => theme.spacing.md};
`;

export const PageTitle = styled.h1`
  font-size: ${({ theme }) => theme.fontSizes.h1};
  color: ${({ theme }) => theme.colors.textPrimary};
  margin: 0 0 ${({ theme }) => theme.spacing.xl};
`;

export const BodyText = styled.p`
  font-size: ${({ theme }) => theme.fontSizes.body};
  color: ${({ theme }) => theme.colors.textBody};
  margin: 0 0 ${({ theme }) => theme.spacing.xl};
`;

export const LoadingState = styled.div`
  color: ${({ theme }) => theme.colors.textHint};
  font-size: ${({ theme }) => theme.fontSizes.body};
  padding: ${({ theme }) => theme.spacing.xl} 0;
`;
