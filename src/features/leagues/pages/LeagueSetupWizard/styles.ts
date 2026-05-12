import { mq } from "@shared/utils/mediaQueries";
import styled, { css } from "styled-components";

export const StepContainer = styled.div`
  padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.xl};
  max-width: 560px;

  ${mq.mobile} {
    padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.sm};
  }
`;

export const StepTitle = styled.h2`
  font-size: ${({ theme }) => theme.fontSizes.h2};
  color: ${({ theme }) => theme.colors.textPrimary};
  margin: 0 0 ${({ theme }) => theme.spacing.lg};
`;

export const FieldGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
`;

export const FieldLabel = styled.label`
  font-size: ${({ theme }) => theme.fontSizes.label};
  color: ${({ theme }) => theme.colors.textHint};
  display: block;
  margin-bottom: ${({ theme }) => theme.spacing.xs};
`;

export const RadioRow = styled.div`
  display: flex;
  flex-direction: row;
  gap: ${({ theme }) => theme.spacing.md};
  align-items: center;
  flex-wrap: wrap;
`;

export const RadioOption = styled.label<{ $disabled?: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  cursor: pointer;
  font-size: ${({ theme }) => theme.fontSizes.base};
  color: ${({ theme }) => theme.colors.textBody};
  opacity: ${({ $disabled }) => ($disabled ? 0.5 : 1)};

  & input[type="radio"] {
    accent-color: ${({ theme }) => theme.colors.accentPrimary};
    cursor: pointer;
  }
`;

export const SeedRow = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
`;

export const SeedInput = styled.input<{ $fullWidth?: boolean }>`
  background: ${({ theme }) => theme.colors.bgInput};
  border: 1px solid ${({ theme }) => theme.colors.borderForm};
  color: ${({ theme }) => theme.colors.textPrimary};
  border-radius: ${({ theme }) => theme.radii.lg};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.s10};
  font-family: inherit;
  font-size: ${({ theme }) => theme.fontSizes.md};
  flex: ${({ $fullWidth }) => ($fullWidth ? "none" : "1")};
  ${({ $fullWidth }) =>
    $fullWidth &&
    css`
      width: 100%;
    `}

  ${mq.mobile} {
    padding: ${({ theme }) => theme.spacing.s6} ${({ theme }) => theme.spacing.s10};
  }
`;

export const FieldSelect = styled.select`
  width: 100%;
  background: ${({ theme }) => theme.colors.bgInput};
  border: 1px solid ${({ theme }) => theme.colors.borderForm};
  color: ${({ theme }) => theme.colors.textPrimary};
  border-radius: ${({ theme }) => theme.radii.lg};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.s10};
  font-family: inherit;
  font-size: ${({ theme }) => theme.fontSizes.md};

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accentPrimary};
    outline-offset: 1px;
  }
`;

export const FieldHint = styled.p`
  margin: ${({ theme }) => theme.spacing.xs} 0 0;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.textHint};
`;

export const ErrorList = styled.div`
  margin-top: ${({ theme }) => theme.spacing.md};
`;

export const ErrorText = styled.p`
  margin: ${({ theme }) => theme.spacing.xs} 0;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.textDanger};
`;

export const FooterActions = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  width: 100%;
  gap: ${({ theme }) => theme.spacing.md};
`;

export const DisabledBadge = styled.span`
  display: inline-block;
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textHint};
  background: ${({ theme }) => theme.colors.bgInput};
  border: 1px solid ${({ theme }) => theme.colors.borderForm};
  border-radius: ${({ theme }) => theme.radii.pill};
  padding: 2px ${({ theme }) => theme.spacing.xs};
  margin-left: ${({ theme }) => theme.spacing.xs};
  vertical-align: middle;
`;

export const CheckboxRow = styled.label`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  cursor: pointer;
  font-size: ${({ theme }) => theme.fontSizes.base};
  color: ${({ theme }) => theme.colors.textBody};
  padding: ${({ theme }) => theme.spacing.xs} 0;

  & input[type="checkbox"] {
    accent-color: ${({ theme }) => theme.colors.accentPrimary};
    cursor: pointer;
  }
`;

export const ActionButton = styled.button`
  background: ${({ theme }) => theme.colors.accentPrimary};
  color: ${({ theme }) => theme.colors.btnPrimaryText};
  border: none;
  border-radius: ${({ theme }) => theme.radii.pill};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.xl};
  font-family: inherit;
  font-size: ${({ theme }) => theme.fontSizes.md};
  font-weight: 700;
  cursor: pointer;

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  &:hover:not(:disabled) {
    opacity: 0.9;
  }
`;

export const SecondaryButton = styled.button`
  background: none;
  border: 1px solid ${({ theme }) => theme.colors.borderForm};
  color: ${({ theme }) => theme.colors.textBody};
  border-radius: ${({ theme }) => theme.radii.pill};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.xl};
  font-family: inherit;
  font-size: ${({ theme }) => theme.fontSizes.md};
  cursor: pointer;

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  &:hover:not(:disabled) {
    border-color: ${({ theme }) => theme.colors.accentPrimary};
    color: ${({ theme }) => theme.colors.textLink};
  }
`;

export const DangerButton = styled.button`
  background: none;
  border: 1px solid ${({ theme }) => theme.colors.borderDanger};
  color: ${({ theme }) => theme.colors.dangerText};
  border-radius: ${({ theme }) => theme.radii.pill};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.xl};
  font-family: inherit;
  font-size: ${({ theme }) => theme.fontSizes.md};
  cursor: pointer;

  &:hover {
    background: ${({ theme }) => theme.colors.dangerHoverBg};
    border-color: ${({ theme }) => theme.colors.dangerHoverBorder};
  }
`;

export const SummaryTable = styled.dl`
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.lg};
  font-size: ${({ theme }) => theme.fontSizes.base};
  margin: 0;
`;

export const SummaryKey = styled.dt`
  color: ${({ theme }) => theme.colors.textHint};
  font-size: ${({ theme }) => theme.fontSizes.label};
  text-transform: uppercase;
`;

export const SummaryValue = styled.dd`
  color: ${({ theme }) => theme.colors.textBody};
  margin: 0;
`;

export const RangeInput = styled.input`
  flex: 1;
  accent-color: ${({ theme }) => theme.colors.accentPrimary};
`;

export const AbandonDialog = styled.dialog`
  background: ${({ theme }) => theme.colors.bgSurface};
  color: ${({ theme }) => theme.colors.textDialog};
  border: 1px solid ${({ theme }) => theme.colors.borderDanger};
  border-radius: ${({ theme }) => theme.radii.dialog};
  padding: ${({ theme }) => theme.spacing.xl};
  max-width: min(400px, 92vw);
  width: 100%;

  &::backdrop {
    background: ${({ theme }) => theme.colors.overlayDark};
  }
`;

export const AbandonDialogActions = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.md};
  justify-content: flex-end;
  margin-top: ${({ theme }) => theme.spacing.lg};
`;

/** Small hint text below form fields — uses the minimum 12px token (xs). */
export const HintText = styled.p`
  margin: ${({ theme }) => theme.spacing.sm} 0 0;
  font-size: ${({ theme }) => theme.fontSizes.xs};
  opacity: 0.7;
`;

export const PageTitle = styled.h1`
  font-size: ${({ theme }) => theme.fontSizes.h1};
  color: ${({ theme }) => theme.colors.textPrimary};
  margin: 0 0 ${({ theme }) => theme.spacing.xl};
`;

export const BlockedActions = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  margin-top: ${({ theme }) => theme.spacing.lg};
`;

/** Wrapper for a step's primary action button with top spacing. */
export const ActionRow = styled.div`
  margin-top: ${({ theme }) => theme.spacing.xl};
`;

/** Sub-section within a FieldGroup — adds top spacing between related field clusters. */
export const SubSection = styled.div`
  margin-top: ${({ theme }) => theme.spacing.md};
`;

/** Small flanking label for range inputs (e.g. "Lopsided" / "Balanced"). */
export const RangeLabel = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  opacity: 0.7;
`;
