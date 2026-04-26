import { mq } from "@shared/utils/mediaQueries";
import styled from "styled-components";

export {
  EmptyState,
  PlayerLink,
  StatsTable,
  TabBar,
  TabBtn,
  TableWrapper,
  Td,
  Th,
} from "../../styles";

/** Wider page container for the career stats tables (up to 900px). */
export const CareerContainer = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  padding: ${({ theme }) => theme.spacing.xxl};
  padding-bottom: calc(
    ${({ theme }) => theme.spacing.xxl} + ${({ theme }) => theme.sizes.bottomBar}
  );
  max-width: 900px;
  margin: 0 auto;
  width: 100%;

  ${mq.mobile} {
    padding: ${({ theme }) => theme.spacing.lg};
    padding-bottom: calc(
      ${({ theme }) => theme.spacing.lg} + ${({ theme }) => theme.sizes.bottomBar}
    );
    height: 100dvh;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    > * {
      flex-shrink: 0;
    }
  }
`;

/** Team selector row. */
export const TeamSelectorRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  margin-bottom: ${({ theme }) => theme.spacing.xl};
  flex-wrap: wrap;
`;

export const TeamSelectLabel = styled.label`
  color: ${({ theme }) => theme.colors.textSubdued};
  font-size: ${({ theme }) => theme.fontSizes.base};
  white-space: nowrap;
`;

export const TeamSelect = styled.select`
  background: ${({ theme }) => theme.colors.bgSurface};
  color: ${({ theme }) => theme.colors.textBody};
  border: 1px solid ${({ theme }) => theme.colors.borderPanel};
  border-radius: ${({ theme }) => theme.radii.md};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  font-size: ${({ theme }) => theme.fontSizes.md};
  font-family: inherit;
  cursor: pointer;
  min-width: 200px;

  &:focus {
    outline: 2px solid ${({ theme }) => theme.colors.accentPrimary};
    outline-offset: 2px;
  }

  option {
    background: ${({ theme }) => theme.colors.bgDeep};
    color: ${({ theme }) => theme.colors.textBody};
  }
`;

export const TeamEditorLinkBtn = styled.button`
  background: transparent;
  color: ${({ theme }) => theme.colors.textLink};
  border: 1px solid ${({ theme }) => theme.colors.borderForm};
  border-radius: ${({ theme }) => theme.radii.md};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-family: inherit;
  cursor: pointer;

  &:hover {
    background: ${({ theme }) => theme.colors.bgSurface};
    color: ${({ theme }) => theme.colors.textBody};
    border-color: ${({ theme }) => theme.colors.textSecondaryLink};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accentPrimary};
    outline-offset: 2px;
  }
`;

/** Page header title. */
export const PageTitle = styled.h1`
  color: ${({ theme }) => theme.colors.accentPrimary};
  font-size: ${({ theme }) => theme.fontSizes.h2};
  margin: 0 0 ${({ theme }) => theme.spacing.xl};

  ${mq.mobile} {
    font-size: ${({ theme }) => theme.fontSizes.h3};
  }
`;

// ── Team Summary panel ────────────────────────────────────────────────────────

/** Container for the team summary + leaders section (above tabs). */
export const TeamSummarySection = styled.div`
  margin-bottom: ${({ theme }) => theme.spacing.xl};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
`;

export const SummaryHeading = styled.h2`
  color: ${({ theme }) => theme.colors.textSubdued};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  text-transform: uppercase;
  letter-spacing: 1px;
  font-weight: 600;
  margin: 0;
`;

/** Grid of stat cells for the team summary. */
export const SummaryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: ${({ theme }) => theme.spacing.sm};

  ${mq.mobile} {
    grid-template-columns: repeat(2, 1fr);
  }
`;

/** A single stat cell in the summary grid. */
export const SummaryCell = styled.div`
  background: ${({ theme }) => theme.colors.bgSurface};
  border: 1px solid ${({ theme }) => theme.colors.borderPanel};
  border-radius: ${({ theme }) => theme.radii.md};
  padding: ${({ theme }) => theme.spacing.s10} ${({ theme }) => theme.spacing.md};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xxs};
`;

export const SummaryCellLabel = styled.span`
  color: ${({ theme }) => theme.colors.textSubdued};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  text-transform: uppercase;
  letter-spacing: 0.8px;
  font-weight: 600;
`;

export const SummaryCellValue = styled.span`
  color: ${({ theme }) => theme.colors.textBody};
  font-size: ${({ theme }) => theme.fontSizes.display};
  font-weight: 700;
  font-variant-numeric: tabular-nums;
`;

// ── Leader cards ─────────────────────────────────────────────────────────────

/** Label above a group of leader cards. */
export const LeadersGroupLabel = styled.h3`
  color: ${({ theme }) => theme.colors.textSubdued};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  text-transform: uppercase;
  letter-spacing: 0.8px;
  font-weight: 600;
  margin: 0 0 ${({ theme }) => theme.spacing.sm};
`;

export const LeaderCardsRow = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: ${({ theme }) => theme.spacing.sm};

  ${mq.mobile} {
    grid-template-columns: repeat(1, 1fr);
  }
`;

export const LeaderCard = styled.button`
  background: ${({ theme }) => theme.colors.bgSurface};
  border: 1px solid ${({ theme }) => theme.colors.borderPanel};
  border-radius: ${({ theme }) => theme.radii.md};
  padding: ${({ theme }) => theme.spacing.s10} ${({ theme }) => theme.spacing.md};
  text-align: left;
  cursor: pointer;
  font-family: inherit;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xxs};
  transition: border-color 0.15s;

  &:hover {
    border-color: ${({ theme }) => theme.colors.borderForm};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accentPrimary};
    outline-offset: 2px;
  }
`;

export const LeaderCardPlaceholder = styled.div`
  background: ${({ theme }) => theme.colors.bgSurface};
  border: 1px dashed ${({ theme }) => theme.colors.borderPanel};
  border-radius: ${({ theme }) => theme.radii.md};
  padding: ${({ theme }) => theme.spacing.s10} ${({ theme }) => theme.spacing.md};
  display: flex;
  align-items: center;
  justify-content: center;
`;

export const LeaderStatLabel = styled.span`
  color: ${({ theme }) => theme.colors.textSubdued};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  text-transform: uppercase;
  letter-spacing: 0.8px;
  font-weight: 600;
`;

export const LeaderName = styled.span`
  color: ${({ theme }) => theme.colors.textLink};
  font-size: ${({ theme }) => theme.fontSizes.base};
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const LeaderValue = styled.span`
  color: ${({ theme }) => theme.colors.accentPrimary};
  font-size: ${({ theme }) => theme.fontSizes.dialogTitle};
  font-weight: 700;
  font-variant-numeric: tabular-nums;
`;

export const LeaderPlaceholderText = styled.span`
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.fontSizes.sm};
`;

// ── Accessible "no completed games" empty state ──────────────────────────────

/**
 * Container for the accessible empty state shown on the career stats page
 * when no games have ever been completed. Matches style-guide §12.2 token set.
 */
export const CareerEmptyStateRegion = styled.section`
  text-align: center;
  padding: ${({ theme }) => theme.spacing.s40};
  color: ${({ theme }) => theme.colors.textSubdued};
  font-size: ${({ theme }) => theme.fontSizes.md};
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
`;

export const CareerEmptyHeading = styled.h2`
  color: ${({ theme }) => theme.colors.textBody};
  font-size: ${({ theme }) => theme.fontSizes.h3};
  font-weight: 600;
  margin: 0 0 ${({ theme }) => theme.spacing.md};

  &:focus {
    outline: 2px solid ${({ theme }) => theme.colors.accentPrimary};
    outline-offset: 2px;
    border-radius: ${({ theme }) => theme.radii.sm};
  }

  &:focus:not(:focus-visible) {
    outline: none;
  }
`;

export const CareerEmptyBody = styled.p`
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.fontSizes.sub};
  line-height: 1.5;
  max-width: 38ch;
  margin: 0 auto;
`;

/**
 * Reuses the §4.4 Play Ball button visual treatment from the Exhibition Setup
 * page, sized for the empty-state CTA. Rendered as a `<button>` so a
 * navigation handler (not a raw anchor) can call `useNavigate`.
 */
export const CareerEmptyCtaBtn = styled.button`
  display: inline-block;
  background: ${({ theme }) => theme.colors.accentPrimary};
  color: ${({ theme }) => theme.colors.btnPrimaryText};
  border: none;
  border-radius: ${({ theme }) => theme.radii.pill};
  padding: ${({ theme }) => theme.spacing.s10} ${({ theme }) => theme.spacing.xxl};
  font-family: inherit;
  font-size: ${({ theme }) => theme.fontSizes.lg};
  font-weight: 700;
  cursor: pointer;
  margin-top: ${({ theme }) => theme.spacing.md};
  min-height: ${({ theme }) => theme.sizes.btnLg};

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accentPrimary};
    outline-offset: 2px;
  }
`;
