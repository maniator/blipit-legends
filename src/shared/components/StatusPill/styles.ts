import styled, { css } from "styled-components";

export type PillVariant = "fresh" | "tired" | "spent" | "il" | "auto";

const variantStyles = {
  fresh: css`
    color: ${({ theme }) => theme.colors.statusSuccess};
    background: ${({ theme }) => theme.colors.chipSuccessBg};
    border: 1px solid ${({ theme }) => theme.colors.chipSuccessBorder};
  `,
  tired: css`
    color: ${({ theme }) => theme.colors.textFatigueMed};
    background: ${({ theme }) => theme.colors.chipWarnBg};
    border: 1px solid ${({ theme }) => theme.colors.chipWarnBorder};
  `,
  spent: css`
    color: ${({ theme }) => theme.colors.textFatigueHigh};
    background: ${({ theme }) => theme.colors.chipDangerBg};
    border: 1px solid ${({ theme }) => theme.colors.chipDangerBorder};
  `,
  il: css`
    color: ${({ theme }) => theme.colors.accentPrimary};
    background: ${({ theme }) => theme.colors.chipAccentBg};
    border: 1px solid ${({ theme }) => theme.colors.chipAccentBorder};
  `,
  auto: css`
    color: ${({ theme }) => theme.colors.textFaint};
    background: ${({ theme }) => theme.colors.chipNeutralBg};
    border: 1px solid ${({ theme }) => theme.colors.chipNeutralBorder};
  `,
};

export const PillSpan = styled.span<{ $variant: PillVariant }>`
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: ${({ theme }) => theme.radii.pill};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: 600;
  white-space: nowrap;
  ${({ $variant }) => variantStyles[$variant]}
`;
