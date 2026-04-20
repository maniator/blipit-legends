import { mq } from "@shared/utils/mediaQueries";
import styled from "styled-components";

export { BackBtn, PageContainer, PageHeader } from "@shared/components/PageLayout/styles";

export const PageTitle = styled.h1`
  color: ${({ theme }) => theme.colors.accentPrimary};
  font-size: ${({ theme }) => theme.fontSizes.heading};
  margin: 0 0 ${({ theme }) => theme.spacing.xl};

  ${mq.mobile} {
    font-size: ${({ theme }) => theme.fontSizes.xxl};
    margin-bottom: ${({ theme }) => theme.spacing.lg};
  }
`;

export const FieldGroup = styled.div`
  margin-bottom: ${({ theme }) => theme.spacing.lg};

  ${mq.mobile} {
    margin-bottom: ${({ theme }) => theme.spacing.sm};
  }
`;

export const FieldLabel = styled.label`
  display: block;
  font-size: ${({ theme }) => theme.fontSizes.label};
  text-transform: uppercase;
  letter-spacing: ${({ theme }) => theme.letterSpacing.wider};
  color: ${({ theme }) => theme.colors.textSecondaryLink};
  margin-bottom: ${({ theme }) => theme.spacing.s6};

  ${mq.mobile} {
    margin-bottom: ${({ theme }) => theme.spacing.xs};
    letter-spacing: ${({ theme }) => theme.letterSpacing.normal};
  }
`;

export const Input = styled.input`
  background: ${({ theme }) => theme.colors.bgInput};
  border: 1px solid ${({ theme }) => theme.colors.borderForm};
  color: ${({ theme }) => theme.colors.textPrimary};
  border-radius: ${({ theme }) => theme.radii.lg};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.s10};
  font-family: inherit;
  font-size: ${({ theme }) => theme.fontSizes.md};
  width: 100%;
  box-sizing: border-box;

  &:focus {
    outline: 2px solid ${({ theme }) => theme.colors.accentPrimary};
    outline-offset: 2px;
    border-color: transparent;
  }

  ${mq.mobile} {
    padding: ${({ theme }) => theme.spacing.s6} ${({ theme }) => theme.spacing.s10};
  }
`;

export const MultiSelect = styled.select`
  background: ${({ theme }) => theme.colors.bgInput};
  border: 1px solid ${({ theme }) => theme.colors.borderForm};
  color: ${({ theme }) => theme.colors.textPrimary};
  border-radius: ${({ theme }) => theme.radii.lg};
  padding: ${({ theme }) => theme.spacing.s6} ${({ theme }) => theme.spacing.s10};
  font-family: inherit;
  font-size: ${({ theme }) => theme.fontSizes.md};
  width: 100%;
  min-height: 120px;
  box-sizing: border-box;

  &:focus {
    outline: 2px solid ${({ theme }) => theme.colors.accentPrimary};
    outline-offset: 2px;
    border-color: transparent;
  }

  option {
    padding: ${({ theme }) => theme.spacing.xs};
    background: ${({ theme }) => theme.colors.bgInput};
    color: ${({ theme }) => theme.colors.textPrimary};
  }
`;

export const FieldHint = styled.p`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.textHint};
  margin: ${({ theme }) => theme.spacing.s5} 0 0;

  ${mq.mobile} {
    font-size: ${({ theme }) => theme.fontSizes.xs};
    line-height: 1.3;
    margin-top: ${({ theme }) => theme.spacing.s3};
  }
`;

export const ValidationError = styled.p`
  background: ${({ theme }) => theme.colors.bgExhibitionError};
  border: 1px solid ${({ theme }) => theme.colors.borderExhibitionError};
  border-radius: ${({ theme }) => theme.radii.md};
  color: ${({ theme }) => theme.colors.textError};
  font-size: ${({ theme }) => theme.fontSizes.label};
  margin: ${({ theme }) => theme.spacing.s6} 0 0;
  padding: ${({ theme }) => theme.spacing.s7} ${({ theme }) => theme.spacing.s10};
  line-height: 1.4;
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

export const SubmitButton = styled.button`
  display: block;
  width: 100%;
  background: ${({ theme }) => theme.colors.accentPrimary};
  color: ${({ theme }) => theme.colors.btnPrimaryText};
  border: none;
  border-radius: ${({ theme }) => theme.radii.pill};
  padding: ${({ theme }) => theme.spacing.s10} ${({ theme }) => theme.spacing.xxl};
  font-family: inherit;
  font-size: ${({ theme }) => theme.fontSizes.lg};
  font-weight: 700;
  cursor: pointer;
  margin-top: ${({ theme }) => theme.spacing.sm};

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  ${mq.mobile} {
    margin-top: ${({ theme }) => theme.spacing.s6};
  }
`;

export const EmptyTeamsMessage = styled.p`
  color: ${({ theme }) => theme.colors.textHint};
  font-size: ${({ theme }) => theme.fontSizes.base};
  margin: ${({ theme }) => theme.spacing.sm} 0 0;
`;
