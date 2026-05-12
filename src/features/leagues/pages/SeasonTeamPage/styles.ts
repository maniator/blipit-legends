import styled from "styled-components";

export const PageTitle = styled.h1`
  font-size: ${({ theme }) => theme.fontSizes.h1};
  color: ${({ theme }) => theme.colors.textPrimary};
  margin: 0 0 ${({ theme }) => theme.spacing.xs};
`;

export const RecordLine = styled.p`
  font-size: ${({ theme }) => theme.fontSizes.body};
  color: ${({ theme }) => theme.colors.textHint};
  margin: 0 0 ${({ theme }) => theme.spacing.xl};
`;

export const SectionHeading = styled.h2`
  font-size: ${({ theme }) => theme.fontSizes.h3};
  color: ${({ theme }) => theme.colors.textPrimary};
  margin: 0 0 ${({ theme }) => theme.spacing.sm};
`;

export const PitcherList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0 0 ${({ theme }) => theme.spacing.xl};
`;

export const PitcherRow = styled.li`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing.xs} 0;
  border-bottom: 1px solid ${({ theme }) => theme.colors.borderFormAlpha30};
  font-size: ${({ theme }) => theme.fontSizes.body};
  color: ${({ theme }) => theme.colors.textBody};

  &:last-child {
    border-bottom: none;
  }
`;

export const PitcherName = styled.span`
  flex: 1;
`;

export const PitcherRole = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.textHint};
  margin-right: ${({ theme }) => theme.spacing.sm};
`;

export const ResultsTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: ${({ theme }) => theme.fontSizes.body};
  margin-bottom: ${({ theme }) => theme.spacing.xl};
`;

export const ResultsTh = styled.th`
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

export const ResultsTd = styled.td`
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
  color: ${({ theme }) => theme.colors.textBody};
  border-bottom: 1px solid ${({ theme }) => theme.colors.borderFormAlpha30};

  &:not(:first-child) {
    text-align: center;
  }

  &:last-child {
    text-align: right;
  }
`;

export const ResultsTr = styled.tr`
  &:last-child td {
    border-bottom: none;
  }
`;

export const ResultChip = styled.span<{ $result: "W" | "L" | "T" }>`
  display: inline-block;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: 700;
  padding: 2px 8px;
  border-radius: ${({ theme }) => theme.radii.pill};
  background: ${({ $result, theme }) =>
    $result === "W"
      ? theme.colors.chipSuccessBg
      : $result === "L"
        ? theme.colors.chipDangerBg
        : theme.colors.chipNeutralBg};
  border: 1px solid
    ${({ $result, theme }) =>
      $result === "W"
        ? theme.colors.chipSuccessBorder
        : $result === "L"
          ? theme.colors.chipDangerBorder
          : theme.colors.chipNeutralBorder};
  color: ${({ $result, theme }) =>
    $result === "W"
      ? theme.colors.statusSuccess
      : $result === "L"
        ? theme.colors.textDanger
        : theme.colors.textHint};
`;
