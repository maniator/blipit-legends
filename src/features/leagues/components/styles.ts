import styled from "styled-components";

/** Compact action button used on league season pages (Watch / Play in Manager Mode). */
export const GameActionBtn = styled.button<{ $variant?: "primary" | "secondary" }>`
  background: transparent;
  color: ${({ theme, $variant }) =>
    $variant === "primary" ? theme.colors.accentPrimary : theme.colors.textSecondaryLink};
  border: 1px solid
    ${({ theme, $variant }) =>
      $variant === "primary" ? theme.colors.borderAccent : theme.colors.borderForm};
  border-radius: 6px;
  padding: 4px 10px;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: 600;
  min-height: 28px;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s;

  &:hover:not(:disabled) {
    background: ${({ theme, $variant }) =>
      $variant === "primary" ? theme.colors.btnPrimaryBg : theme.colors.bgSurface};
  }

  &:active:not(:disabled) {
    background: ${({ theme, $variant }) =>
      $variant === "primary" ? theme.colors.btnPrimaryBgActive : theme.colors.bgInput};
  }

  &:focus-visible {
    outline: 2px solid aquamarine;
    outline-offset: 2px;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;
