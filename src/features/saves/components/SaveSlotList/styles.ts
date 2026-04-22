import type { AppTheme } from "@shared/theme";
import { mq } from "@shared/utils/mediaQueries";
import styled, { css } from "styled-components";

type ActionBtnVariant = "primary" | "secondary" | "danger";

const actionBtnVariants: Record<
  ActionBtnVariant,
  {
    color: keyof AppTheme["colors"];
    border: keyof AppTheme["colors"];
    hoverBg: keyof AppTheme["colors"];
  }
> = {
  primary: { color: "accentPrimary", border: "borderAccent", hoverBg: "btnPrimaryBg" },
  secondary: { color: "textSecondaryLink", border: "borderForm", hoverBg: "bgSurface" },
  danger: { color: "dangerText", border: "borderDanger", hoverBg: "dangerHoverBg" },
};

export const SaveList = styled.ul`
  list-style: none;
  margin: 0 0 ${({ theme }) => theme.spacing.xxl};
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.s10};
`;

export const SaveCard = styled.li`
  background: ${({ theme }) => theme.colors.bgSurface};
  border: 1px solid ${({ theme }) => theme.colors.borderForm};
  border-radius: ${({ theme }) => theme.radii.card};
  padding: ${({ theme }) => theme.spacing.s14} ${({ theme }) => theme.spacing.lg};
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};

  ${mq.mobile} {
    flex-wrap: wrap;
    gap: ${({ theme }) => theme.spacing.sm};
  }
`;

export const SaveInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

export const SaveName = styled.div`
  color: ${({ theme }) => theme.colors.textPrimary};
  font-size: ${({ theme }) => theme.fontSizes.bodyLg};
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const SaveDate = styled.div`
  color: ${({ theme }) => theme.colors.textHint};
  font-size: ${({ theme }) => theme.fontSizes.label};
  margin-top: ${({ theme }) => theme.spacing.xxs};
`;

export const SaveActions = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
  flex-shrink: 0;

  ${mq.mobile} {
    width: 100%;
    justify-content: flex-end;
  }
`;

export const ActionBtn = styled.button<{ $variant?: ActionBtnVariant }>`
  background: transparent;
  ${({ $variant = "secondary", theme }) => {
    const v = actionBtnVariants[$variant];
    return css`
      color: ${theme.colors[v.color]};
      border: 1px solid ${theme.colors[v.border]};
      &:hover {
        background: ${theme.colors[v.hoverBg]};
      }
    `;
  }}
  border-radius: ${({ theme }) => theme.radii.md};
  padding: ${({ theme }) => theme.spacing.s6} ${({ theme }) => theme.spacing.md};
  font-size: ${({ theme }) => theme.fontSizes.label};
  font-family: inherit;
  cursor: pointer;
  min-height: ${({ theme }) => theme.sizes.inputMd};

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accentPrimary};
    outline-offset: 2px;
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;
