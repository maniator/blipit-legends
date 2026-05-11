import { mq } from "@shared/utils/mediaQueries";
import styled from "styled-components";

export { HelpButton } from "@feat/gameplay/components/GameControls/styles";

export const Dialog = styled.dialog`
  background: ${({ theme }) => theme.colors.bgSurface};
  color: ${({ theme }) => theme.colors.textDialog};
  border: 2px solid ${({ theme }) => theme.colors.borderForm};
  border-radius: ${({ theme }) => theme.radii.dialog};
  padding: 0;
  max-width: min(680px, 96vw);
  width: 100%;
  height: min(700px, 90vh);
  font-family: inherit;
  font-size: ${({ theme }) => theme.fontSizes.md};
  line-height: 1.6;
  overflow: hidden;

  &[open] {
    display: flex;
    flex-direction: column;
  }

  &::backdrop {
    background: ${({ theme }) => theme.colors.overlayDark};
  }

  ${mq.mobile} {
    position: fixed;
    inset: 0;
    width: 100vw;
    max-width: 100vw;
    height: 100dvh;
    border-radius: 0;
    border: none;
    margin: 0;
  }
`;

export const DialogHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing.xl} ${({ theme }) => theme.spacing.xxl}
    ${({ theme }) => theme.spacing.lg};
  border-bottom: 1px solid ${({ theme }) => theme.colors.borderFormAlpha40};
  flex-shrink: 0;
`;

export const DialogTitle = styled.h2`
  margin: 0;
  font-size: ${({ theme }) => theme.fontSizes.dialogTitle};
  color: ${({ theme }) => theme.colors.accentPrimary};
`;

export const CloseXButton = styled.button`
  background: transparent;
  color: ${({ theme }) => theme.colors.textLink};
  border: 1px solid ${({ theme }) => theme.colors.borderForm};
  border-radius: ${({ theme }) => theme.radii.md};
  width: ${({ theme }) => theme.spacing.s28};
  height: ${({ theme }) => theme.spacing.s28};
  font-size: ${({ theme }) => theme.fontSizes.display};
  font-family: inherit;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  padding: 0;
  flex-shrink: 0;
  position: relative;

  &::before {
    content: "";
    position: absolute;
    inset: -8px;
  }

  &:hover {
    background: ${({ theme }) => theme.colors.bgFormAlpha60};
    color: ${({ theme }) => theme.colors.textPrimary};
  }
`;

export const ScrollBody = styled.div`
  overflow-y: auto;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.xxl}
    ${({ theme }) => theme.spacing.xl};
  flex: 1 1 0;
`;

export const CloseButton = styled.button`
  display: block;
  margin: ${({ theme }) => theme.spacing.lg} auto 0;
  background: ${({ theme }) => theme.colors.accentPrimary};
  color: ${({ theme }) => theme.colors.btnPrimaryText};
  border: none;
  border-radius: ${({ theme }) => theme.radii.pill};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.xxl};
  font-family: inherit;
  font-size: ${({ theme }) => theme.fontSizes.md};
  font-weight: 600;
  cursor: pointer;
`;
