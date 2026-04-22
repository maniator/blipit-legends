import { mq } from "@shared/utils/mediaQueries";
import styled from "styled-components";

export {
  ActionBtn,
  SaveActions,
  SaveCard,
  SaveDate,
  SaveInfo,
  SaveList,
  SaveName,
} from "@feat/saves/components/SaveSlotList/styles";
export { BackBtn, PageContainer, PageHeader } from "@shared/components/PageLayout/styles";

export const PageTitle = styled.h1`
  color: ${({ theme }) => theme.colors.textPrimary};
  font-size: ${({ theme }) => theme.fontSizes.h1};
  margin: 0 0 ${({ theme }) => theme.spacing.xl};

  ${mq.mobile} {
    font-size: ${({ theme }) => theme.fontSizes.xxl};
  }
`;

export const EmptyState = styled.p`
  color: ${({ theme }) => theme.colors.textHint};
  font-size: ${({ theme }) => theme.fontSizes.body};
  text-align: center;
  margin: ${({ theme }) => theme.spacing.s40} 0;
`;

export const LoadingState = styled.p`
  color: ${({ theme }) => theme.colors.textHint};
  font-size: ${({ theme }) => theme.fontSizes.body};
  margin: ${({ theme }) => theme.spacing.xxl} 0;
`;

export const ImportSection = styled.div`
  border-top: 1px solid ${({ theme }) => theme.colors.borderFormAlpha30};
  padding-top: ${({ theme }) => theme.spacing.xl};
  margin-top: ${({ theme }) => theme.spacing.sm};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};
`;

export const ImportSectionTitle = styled.h2`
  color: ${({ theme }) => theme.colors.textSecondaryLink};
  font-size: ${({ theme }) => theme.fontSizes.sub};
  font-weight: 600;
  letter-spacing: ${({ theme }) => theme.letterSpacing.tight};
  text-transform: uppercase;
  margin: 0 0 ${({ theme }) => theme.spacing.sm};
`;

export const PasteTextarea = styled.textarea`
  width: 100%;
  min-height: ${({ theme }) => theme.sizes.pasteTextarea};
  background: ${({ theme }) => theme.colors.bgImport};
  border: 1px solid ${({ theme }) => theme.colors.borderForm};
  border-radius: ${({ theme }) => theme.radii.md};
  color: ${({ theme }) => theme.colors.textBody};
  font-family: monospace;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.s10};
  resize: vertical;
  box-sizing: border-box;

  &::placeholder {
    color: ${({ theme }) => theme.colors.textNavFaint};
  }

  &:focus {
    outline: 2px solid ${({ theme }) => theme.colors.accentPrimary};
    outline-offset: 2px;
    border-color: transparent;
  }

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

export const PasteActions = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
  flex-wrap: wrap;
  align-items: center;
`;

export const ImportLabel = styled.label`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.s10};
  color: ${({ theme }) => theme.colors.textSecondaryLink};
  font-size: ${({ theme }) => theme.fontSizes.base};
  cursor: pointer;
`;

export const FileInput = styled.input`
  font-family: inherit;
  font-size: ${({ theme }) => theme.fontSizes.label};
  color: ${({ theme }) => theme.colors.textSecondaryLink};

  &::file-selector-button {
    background: transparent;
    color: ${({ theme }) => theme.colors.textSecondaryLink};
    border: 1px solid ${({ theme }) => theme.colors.borderForm};
    border-radius: ${({ theme }) => theme.radii.md};
    padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.s10};
    font-size: ${({ theme }) => theme.fontSizes.label};
    font-family: inherit;
    cursor: pointer;
    margin-right: ${({ theme }) => theme.spacing.sm};

    &:hover {
      background: ${({ theme }) => theme.colors.bgSurface};
    }
  }
`;

export const ErrorMessage = styled.p`
  color: ${({ theme }) => theme.colors.dangerText};
  background: ${({ theme }) => theme.colors.errorBgTransparent};
  border: 1px solid ${({ theme }) => theme.colors.borderDanger};
  border-radius: ${({ theme }) => theme.radii.md};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  font-size: ${({ theme }) => theme.fontSizes.base};
  margin-top: ${({ theme }) => theme.spacing.s10};
`;
