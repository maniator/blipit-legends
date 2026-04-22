import styled from "styled-components";

export { Button as SavesButton } from "@feat/gameplay/components/GameControls/styles";

export const Dialog = styled.dialog`
  background: ${({ theme }) => theme.colors.bgSurface};
  color: ${({ theme }) => theme.colors.textDialog};
  border: 2px solid ${({ theme }) => theme.colors.borderForm};
  border-radius: ${({ theme }) => theme.radii.dialog};
  padding: ${({ theme }) => theme.spacing.xxl} ${({ theme }) => theme.spacing.s28}
    ${({ theme }) => theme.spacing.xl};
  max-width: min(520px, 94vw);
  width: 100%;
  font-family: inherit;
  font-size: ${({ theme }) => theme.fontSizes.md};

  &::backdrop {
    background: ${({ theme }) => theme.colors.overlayMedDark};
  }
`;

export const DialogTitle = styled.h2`
  margin: 0 0 ${({ theme }) => theme.spacing.s14};
  font-size: ${({ theme }) => theme.fontSizes.xl};
  color: ${({ theme }) => theme.colors.accentPrimary};
`;

export const SlotList = styled.ul`
  list-style: none;
  margin: 0 0 ${({ theme }) => theme.spacing.lg};
  padding: 0;
`;

export const SlotItem = styled.li`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.s6};
  padding: ${({ theme }) => theme.spacing.s6} ${({ theme }) => theme.spacing.sm};
  border-radius: ${({ theme }) => theme.radii.lg};
  background: ${({ theme }) => theme.colors.bgNavSection};
  margin-bottom: ${({ theme }) => theme.spacing.s6};
`;

export const SlotName = styled.span`
  flex: 1;
  font-size: ${({ theme }) => theme.fontSizes.base};
  color: ${({ theme }) => theme.colors.textBody};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const SlotDate = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.textModalLink};
  flex-shrink: 0;
`;

export const SmallButton = styled.button`
  background: transparent;
  border: 1px solid ${({ theme }) => theme.colors.borderForm};
  color: ${({ theme }) => theme.colors.textLink};
  border-radius: ${({ theme }) => theme.radii.lg};
  padding: ${({ theme }) => theme.spacing.s3} ${({ theme }) => theme.spacing.sm};
  font-size: ${({ theme }) => theme.fontSizes.label};
  font-family: inherit;
  cursor: pointer;
  flex-shrink: 0;

  &:hover {
    background: ${({ theme }) => theme.colors.bgFormAlpha40};
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

export const DangerButton = styled(SmallButton)`
  border-color: ${({ theme }) => theme.colors.borderSavesDanger};
  color: ${({ theme }) => theme.colors.textError};

  &:hover {
    background: ${({ theme }) => theme.colors.bgSavesDangerHover};
  }
`;

export const SectionHeading = styled.h3`
  margin: ${({ theme }) => theme.spacing.md} 0 ${({ theme }) => theme.spacing.s6};
  font-size: ${({ theme }) => theme.fontSizes.label};
  text-transform: uppercase;
  letter-spacing: ${({ theme }) => theme.letterSpacing.wider};
  color: ${({ theme }) => theme.colors.textSecondaryLink};
`;

export const ImportArea = styled.textarea`
  width: 100%;
  background: ${({ theme }) => theme.colors.bgImport};
  border: 1px solid ${({ theme }) => theme.colors.borderForm};
  border-radius: ${({ theme }) => theme.radii.lg};
  color: ${({ theme }) => theme.colors.textBody};
  font-family: monospace;
  font-size: ${({ theme }) => theme.fontSizes.label};
  padding: ${({ theme }) => theme.spacing.s6} ${({ theme }) => theme.spacing.sm};
  resize: vertical;
  box-sizing: border-box;

  &[aria-invalid="true"] {
    border-color: ${({ theme }) => theme.colors.borderDanger};
  }
`;

export const HelperText = styled.p<{ $tone: "neutral" | "error" }>`
  margin: ${({ theme }) => theme.spacing.xs} 0 0;
  font-size: ${({ theme }) => theme.fontSizes.tiny};
  color: ${({ $tone, theme }) =>
    $tone === "error" ? theme.colors.textError : theme.colors.textMuted};
  background: ${({ theme }) => theme.colors.bgSurface};
  min-height: 1em;
`;

export const ErrorMsg = styled.p`
  color: ${({ theme }) => theme.colors.textDanger};
  font-size: ${({ theme }) => theme.fontSizes.label};
  margin: ${({ theme }) => theme.spacing.xs} 0 0;
`;

export const Row = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.s6};
  align-items: center;
  flex-wrap: wrap;
  margin-top: ${({ theme }) => theme.spacing.s6};
`;

export const CloseButton = styled.button`
  display: block;
  margin: ${({ theme }) => theme.spacing.lg} auto 0;
  background: ${({ theme }) => theme.colors.accentPrimary};
  color: ${({ theme }) => theme.colors.btnPrimaryText};
  border: none;
  border-radius: ${({ theme }) => theme.radii.pill};
  padding: ${({ theme }) => theme.spacing.s7} ${({ theme }) => theme.spacing.s22};
  font-family: inherit;
  font-size: ${({ theme }) => theme.fontSizes.md};
  font-weight: 600;
  cursor: pointer;
`;

export const EmptyMsg = styled.p`
  color: ${({ theme }) => theme.colors.textModalLink};
  font-size: ${({ theme }) => theme.fontSizes.base};
  margin: 0 0 ${({ theme }) => theme.spacing.md};
`;

export const FileInput = styled.input`
  font-family: inherit;
  font-size: ${({ theme }) => theme.fontSizes.label};
  color: ${({ theme }) => theme.colors.textLink};
`;
