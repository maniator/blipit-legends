import { css } from "styled-components";
import styled from "styled-components";

export type BannerVariant = "info" | "warn" | "neutral";

const variantStyles = {
  info: css`
    background: ${({ theme }) => theme.colors.bgFormAlpha15};
    border-color: ${({ theme }) => theme.colors.borderFormAlpha30};
  `,
  warn: css`
    background: ${({ theme }) => theme.colors.bgWarnSurface};
    border-color: ${({ theme }) => theme.colors.borderDanger};
  `,
  neutral: css`
    background: ${({ theme }) => theme.colors.bgFormAlpha15};
    border-color: ${({ theme }) => theme.colors.borderFormAlpha30};
  `,
};

export const BannerRoot = styled.div<{ $variant: BannerVariant }>`
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => `${theme.spacing.sm} ${theme.spacing.md}`};
  border-radius: ${({ theme }) => theme.radii.card};
  border: 1px solid;
  ${({ $variant }) => variantStyles[$variant]}
`;

export const BannerContent = styled.div`
  flex: 1;
  min-width: 0;
`;

export const BannerTitle = styled.p`
  margin: 0 0 ${({ theme }) => theme.spacing.xs};
  font-size: ${({ theme }) => theme.fontSizes.base};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textPrimary};
`;

export const BannerBody = styled.div`
  font-size: ${({ theme }) => theme.fontSizes.base};
  color: ${({ theme }) => theme.colors.textBody};
`;

export const BannerAction = styled.div`
  flex-shrink: 0;
`;
