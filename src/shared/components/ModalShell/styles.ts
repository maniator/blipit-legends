import { mq } from "@shared/utils/mediaQueries";
import styled from "styled-components";

export const ModalDialog = styled.dialog`
  background: ${({ theme }) => theme.colors.bgSurface};
  color: ${({ theme }) => theme.colors.textDialog};
  border: 2px solid ${({ theme }) => theme.colors.borderForm};
  border-radius: ${({ theme }) => theme.radii.dialog};
  padding: 0;
  max-width: min(560px, 96vw);
  width: 100%;
  max-height: min(90dvh, 820px);
  font-family: inherit;
  font-size: ${({ theme }) => theme.fontSizes.md};
  overflow: hidden;

  &[open] {
    display: flex;
    flex-direction: column;
  }

  &::backdrop {
    background: ${({ theme }) => theme.colors.overlayDark};
  }

  ${mq.mobile} {
    max-height: min(96dvh, 820px);
    border-radius: ${({ theme }) => theme.radii.card};
  }
`;

export const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${({ theme }) => `${theme.spacing.xl} ${theme.spacing.xxxl} ${theme.spacing.lg}`};
  border-bottom: 1px solid ${({ theme }) => theme.colors.borderFormAlpha30};
  flex-shrink: 0;
`;

export const ModalTitle = styled.h2`
  margin: 0;
  font-size: ${({ theme }) => theme.fontSizes.dialogTitle};
  color: ${({ theme }) => theme.colors.accentPrimary};
`;

export const ModalCloseButton = styled.button`
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

  &:hover {
    background: ${({ theme }) => theme.colors.bgFormAlpha60};
    color: ${({ theme }) => theme.colors.textPrimary};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accentPrimary};
    outline-offset: 2px;
  }
`;

export const ModalBody = styled.div`
  overflow-y: auto;
  flex: 1;
  padding: ${({ theme }) => `${theme.spacing.xl} ${theme.spacing.xxxl}`};
`;

export const ModalFooter = styled.div`
  flex-shrink: 0;
  border-top: 1px solid ${({ theme }) => theme.colors.borderFormAlpha30};
  padding: ${({ theme }) => `${theme.spacing.lg} ${theme.spacing.xxxl}`};
`;
