import styled from "styled-components";

// ── PlayerDetails styled-components ────────────────────────────────────────

export const DetailContainer = styled.div`
  margin-top: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.s10};
  background: ${({ theme }) => theme.colors.bgPlayerDetail};
  border: 1px solid ${({ theme }) => theme.colors.borderDarkest};
  border-radius: ${({ theme }) => theme.radii.sm};
`;

export const DetailHeadingRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  text-transform: uppercase;
  letter-spacing: ${({ theme }) => theme.letterSpacing.widest};
  color: ${({ theme }) => theme.colors.textSubdued};
  margin-bottom: ${({ theme }) => theme.spacing.sm};
  padding-bottom: ${({ theme }) => theme.spacing.xs};
  border-bottom: 1px solid ${({ theme }) => theme.colors.borderLog};
`;

export const DetailToggle = styled.button`
  background: none;
  border: none;
  color: ${({ theme }) => theme.colors.textDisabled};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  cursor: pointer;
  padding: 0 ${({ theme }) => theme.spacing.xxs};
  &:hover {
    color: ${({ theme }) => theme.colors.textMuted};
  }
`;

export const DetailEmptyState = styled.div`
  color: ${({ theme }) => theme.colors.textDisabled};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  padding: ${({ theme }) => theme.spacing.sm} 0;
  text-align: center;
`;

export const DetailPlayerName = styled.div`
  color: ${({ theme }) => theme.colors.textNav};
  font-weight: 700;
  font-size: ${({ theme }) => theme.fontSizes.label};
  margin-bottom: ${({ theme }) => theme.spacing.xxs};
`;

export const DetailSubLabel = styled.div`
  color: ${({ theme }) => theme.colors.textDisabled};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  margin-bottom: ${({ theme }) => theme.spacing.s10};
`;

export const StatsGrid = styled.div<{ $cols: number }>`
  display: grid;
  grid-template-columns: repeat(${({ $cols }) => $cols}, 1fr);
  gap: ${({ theme }) => theme.spacing.s6};
  margin-bottom: ${({ theme }) => theme.spacing.sm};
`;

export const StatCell = styled.div`
  text-align: center;
`;

export const StatLabel = styled.div`
  color: ${({ theme }) => theme.colors.textDisabled};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  text-transform: uppercase;
  margin-bottom: ${({ theme }) => theme.spacing.xxs};
`;

export const StatValue = styled.div`
  color: ${({ theme }) => theme.colors.textDialog};
  font-size: ${({ theme }) => theme.fontSizes.label};
  font-weight: 600;
`;

// ── PlayerStatsPanel (index.tsx) styled-components ─────────────────────────

export const PanelHeadingRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: ${({ theme }) => theme.fontSizes.label};
  text-transform: uppercase;
  letter-spacing: ${({ theme }) => theme.letterSpacing.widest};
  color: ${({ theme }) => theme.colors.textSubdued};
  margin-bottom: ${({ theme }) => theme.spacing.s6};
  padding-bottom: ${({ theme }) => theme.spacing.xs};
  border-bottom: 1px solid ${({ theme }) => theme.colors.borderLog};
`;

export const PanelToggle = styled.button`
  background: none;
  border: none;
  color: ${({ theme }) => theme.colors.textDisabled};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  cursor: pointer;
  padding: 0 ${({ theme }) => theme.spacing.xxs};
  &:hover {
    color: ${({ theme }) => theme.colors.textMuted};
  }
`;

export const ModeToggle = styled.button<{ $active?: boolean }>`
  background: none;
  border: 1px solid
    ${({ $active, theme }) => ($active ? theme.colors.textNav : theme.colors.borderLog)};
  color: ${({ $active, theme }) => ($active ? theme.colors.textNav : theme.colors.textDisabled)};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  cursor: pointer;
  padding: 1px ${({ theme }) => theme.spacing.s6};
  border-radius: ${({ theme }) => theme.radii.s3};
  margin-left: ${({ theme }) => theme.spacing.xs};
  &:hover {
    color: ${({ theme }) => theme.colors.textMuted};
    border-color: ${({ theme }) => theme.colors.textMuted};
  }
`;

export const StatsTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: ${({ theme }) => theme.fontSizes.sm};
`;

export const StatsTableTh = styled.th`
  color: ${({ theme }) => theme.colors.textHint};
  font-weight: 600;
  text-align: right;
  padding: ${({ theme }) => theme.spacing.xxs} ${({ theme }) => theme.spacing.xs};
  border-bottom: 1px solid ${({ theme }) => theme.colors.borderDarkest};
  &:first-child {
    text-align: left;
    width: auto;
  }
`;

export const StatsTableTd = styled.td<{ $highlight?: boolean }>`
  text-align: right;
  padding: ${({ theme }) => theme.spacing.xxs} ${({ theme }) => theme.spacing.xs};
  color: ${({ $highlight, theme }) =>
    $highlight ? theme.colors.textDialog : theme.colors.textSubdued};
  &:first-child {
    text-align: left;
    color: ${({ theme }) => theme.colors.textNav};
    font-weight: 700;
  }
`;

export const StatsTableTr = styled.tr<{ $selected?: boolean }>`
  cursor: pointer;
  background: ${({ $selected, theme }) =>
    $selected ? theme.colors.bgPlayerSelected : "transparent"};
  &:hover {
    background: ${({ $selected, theme }) =>
      $selected ? theme.colors.bgPlayerHover : theme.colors.bgSubtle};
  }
  &:focus-visible {
    outline: 1px solid ${({ theme }) => theme.colors.textNav};
    outline-offset: -1px;
  }
`;
