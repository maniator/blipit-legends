import { Link } from "react-router";
import styled from "styled-components";

/** Fixed frosted-glass navigation bar shown on all non-game routes. */
export const AppNavBar = styled.nav`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 20;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.lg}
    ${({ theme }) => theme.spacing.xs}
    calc(${({ theme }) => theme.spacing.lg} + env(safe-area-inset-left));
  background: ${({ theme }) => theme.colors.overlayLight};
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
`;

/** Navigation link for top-level nav entries inside AppNavBar. */
export const NavLinkItem = styled(Link)`
  background: transparent;
  color: ${({ theme }) => theme.colors.textNav};
  font-size: ${({ theme }) => theme.fontSizes.base};
  font-family: inherit;
  cursor: pointer;
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
  text-decoration: none;
  min-height: ${({ theme }) => theme.sizes.btnMd};
  display: inline-flex;
  align-items: center;
  border-radius: ${({ theme }) => theme.radii.sm};

  &:hover {
    color: ${({ theme }) => theme.colors.textPrimary};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accentPrimary};
    outline-offset: 2px;
  }
`;

/** Fixed frosted-glass volume bar shown on all non-game routes. */
export const AppVolumeBar = styled.div`
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 20;
  display: flex;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing.lg};
  flex-wrap: wrap;
  padding: ${({ theme }) => theme.spacing.s10} ${({ theme }) => theme.spacing.lg}
    calc(${({ theme }) => theme.spacing.s10} + env(safe-area-inset-bottom))
    ${({ theme }) => theme.spacing.lg};
  background: ${({ theme }) => theme.colors.overlayLight};
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
`;
