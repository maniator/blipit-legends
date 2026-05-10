import styled, { css } from "styled-components";

export type PillVariant = "fresh" | "tired" | "spent" | "il" | "auto";

const variantStyles = {
  fresh: css`
    color: ${({ theme }) => theme.colors.statusSuccess};
    background: rgba(74, 222, 128, 0.15);
    border: 1px solid rgba(74, 222, 128, 0.3);
  `,
  tired: css`
    color: ${({ theme }) => theme.colors.textFatigueMed};
    background: rgba(242, 193, 78, 0.15);
    border: 1px solid rgba(242, 193, 78, 0.3);
  `,
  spent: css`
    color: ${({ theme }) => theme.colors.textFatigueHigh};
    background: rgba(255, 107, 107, 0.15);
    border: 1px solid rgba(255, 107, 107, 0.3);
  `,
  il: css`
    color: ${({ theme }) => theme.colors.accentPrimary};
    background: rgba(255, 154, 31, 0.15);
    border: 1px solid rgba(255, 154, 31, 0.3);
  `,
  auto: css`
    color: ${({ theme }) => theme.colors.textFaint};
    background: rgba(160, 180, 208, 0.15);
    border: 1px solid rgba(160, 180, 208, 0.3);
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
