import { mq } from "@shared/utils/mediaQueries";
import styled, { css } from "styled-components";

export const Controls = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.s10};
  align-items: center;
  padding: ${({ theme }) => theme.spacing.sm} 0;

  ${mq.mobile} {
    gap: ${({ theme }) => theme.spacing.s6};
    padding: ${({ theme }) => theme.spacing.xs} 0;
  }
`;

type ButtonVariant = "default" | "new" | "saves" | "home";

const variantStyles: Record<ButtonVariant, ReturnType<typeof css>> = {
  default: css`
    background: ${({ theme }) => theme.colors.accentPrimary};
    color: ${({ theme }) => theme.colors.btnPrimaryText};
    border: none;
  `,
  new: css`
    background: ${({ theme }) => theme.colors.btnActionBg};
    color: ${({ theme }) => theme.colors.textPrimary};
    border: none;
    font-weight: bold;
  `,
  saves: css`
    background: ${({ theme }) => theme.colors.btnPrimaryBg};
    color: ${({ theme }) => theme.colors.accentPrimary};
    border: 1px solid ${({ theme }) => theme.colors.borderAccent};
    &:hover {
      background: ${({ theme }) => theme.colors.btnPrimaryBgHover};
    }
  `,
  home: css`
    background: transparent;
    color: ${({ theme }) => theme.colors.textMuted};
    border: 1px solid ${({ theme }) => theme.colors.borderMid};
    &:hover {
      background: ${({ theme }) => theme.colors.bgDropdown};
      border-color: ${({ theme }) => theme.colors.textDimmer};
      color: ${({ theme }) => theme.colors.textDropdown};
    }
  `,
};

export const Button = styled.button<{ $variant?: ButtonVariant }>`
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.s18};
  border-radius: ${({ theme }) => theme.radii.pill};
  cursor: pointer;
  font-family: inherit;
  font-size: ${({ theme }) => theme.fontSizes.md};
  ${({ $variant = "default" }) => variantStyles[$variant]}

  ${mq.desktop} {
    font-size: ${({ theme }) => theme.fontSizes.lg};
  }

  ${mq.mobile} {
    padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
    font-size: ${({ theme }) => theme.fontSizes.base};
  }
`;

export const AutoPlayGroup = styled.div`
  display: inline-flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.sm};
  align-items: center;
  background: ${({ theme }) => theme.colors.navGroupBg};
  border-radius: ${({ theme }) => theme.radii.card};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};

  ${mq.mobile} {
    padding: ${({ theme }) => theme.spacing.s5} ${({ theme }) => theme.spacing.sm};
    gap: ${({ theme }) => theme.spacing.s6};
  }
`;

export const ToggleLabel = styled.label`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.s6};
  font-size: ${({ theme }) => theme.fontSizes.base};
  cursor: pointer;

  & input[type="checkbox"] {
    accent-color: ${({ theme }) => theme.colors.accentPrimary};
    cursor: pointer;
    width: ${({ theme }) => theme.sizes.iconSm};
    height: ${({ theme }) => theme.sizes.iconSm};
  }

  ${mq.notMobile} {
    font-size: ${({ theme }) => theme.fontSizes.md};
  }
`;

export const BatterUpButton = styled(Button)`
  font-size: ${({ theme }) => theme.fontSizes.dialogTitle};
  padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.s28};
  font-weight: bold;

  ${mq.desktop} {
    font-size: ${({ theme }) => theme.fontSizes.f20};
    padding: ${({ theme }) => theme.spacing.s18} ${({ theme }) => theme.spacing.xxxl};
  }
`;

export const HelpButton = styled.button`
  background: ${({ theme }) => theme.colors.helpButtonBg};
  color: ${({ theme }) => theme.colors.textLink};
  border: 1px solid ${({ theme }) => theme.colors.borderForm};
  border-radius: 50%;
  width: ${({ theme }) => theme.sizes.icon};
  height: ${({ theme }) => theme.sizes.icon};
  font-size: ${({ theme }) => theme.fontSizes.lg};
  font-family: inherit;
  cursor: pointer;
  line-height: 1;
  padding: 0;
  flex-shrink: 0;

  &:hover {
    background: ${({ theme }) => theme.colors.helpButtonBgHover};
    color: ${({ theme }) => theme.colors.textPrimary};
  }
`;

export const Select = styled.select`
  background: ${({ theme }) => theme.colors.bgInputSm};
  border: 1px solid ${({ theme }) => theme.colors.borderForm};
  color: ${({ theme }) => theme.colors.textPrimary};
  border-radius: ${({ theme }) => theme.radii.lg};
  padding: ${({ theme }) => theme.spacing.s3} ${({ theme }) => theme.spacing.s6};
  cursor: pointer;
  font-size: ${({ theme }) => theme.fontSizes.base};
  font-family: inherit;
`;

export const SpeedRow = styled.div`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.s6};
`;

export const PausePlayButton = styled.button`
  background: ${({ theme }) => theme.colors.bgInputSm};
  border: 1px solid ${({ theme }) => theme.colors.borderForm};
  border-radius: ${({ theme }) => theme.radii.md};
  color: ${({ theme }) => theme.colors.textPrimary};
  font-size: ${({ theme }) => theme.fontSizes.md};
  cursor: pointer;
  width: ${({ theme }) => theme.sizes.icon};
  height: ${({ theme }) => theme.sizes.icon};
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  flex-shrink: 0;

  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.colors.bgDropdown};
    border-color: ${({ theme }) => theme.colors.accentPrimary};
  }

  &:disabled {
    opacity: 0.4;
    cursor: default;
  }
`;

// ── VolumeControls ───────────────────────────────────────────────────────────

export const VolumeRow = styled.label`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.s5};
  font-size: ${({ theme }) => theme.fontSizes.label};
  color: ${({ theme }) => theme.colors.textBodyAlt};
  cursor: default;
`;

export const VolumeIcon = styled.button`
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  font-size: ${({ theme }) => theme.fontSizes.md};
  line-height: 1;
  color: inherit;
  &:hover {
    opacity: 0.75;
  }
`;

export const RangeInput = styled.input`
  accent-color: ${({ theme }) => theme.colors.accentPrimary};
  cursor: pointer;
  width: 72px;
  height: ${({ theme }) => theme.sizes.progressBar};
  vertical-align: middle;
`;

export const SpeedSlider = styled(RangeInput)`
  width: 80px;

  ${mq.mobile} {
    width: 64px;
  }
`;

export const SpeedLabel = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.label};
  color: ${({ theme }) => theme.colors.textBodyAlt};
  min-width: 44px;
  user-select: none;

  ${mq.mobile} {
    display: none;
  }
`;

// ── Manager mode controls ─────────────────────────────────────────────────────

export const NotifBadge = styled.span<{ $ok: boolean }>`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ $ok, theme }) => ($ok ? theme.colors.statusSuccess : theme.colors.statusWarn)};
  cursor: ${({ $ok }) => ($ok ? "default" : "pointer")};
  white-space: nowrap;
`;

export const SubButton = styled.button`
  background: transparent;
  color: ${({ theme }) => theme.colors.textSecondaryLink};
  border: 1px solid ${({ theme }) => theme.colors.borderForm};
  border-radius: ${({ theme }) => theme.radii.md};
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.s10};
  font-size: ${({ theme }) => theme.fontSizes.label};
  font-family: inherit;
  cursor: pointer;
  min-height: ${({ theme }) => theme.sizes.inputSm};
  flex-shrink: 0;

  &:hover {
    background: ${({ theme }) => theme.colors.bgSurface};
    border-color: ${({ theme }) => theme.colors.textSecondaryLink};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accentPrimary};
    outline-offset: 2px;
  }
`;

export const DecisionTuningToggle = styled.button`
  background: transparent;
  color: ${({ theme }) => theme.colors.textSecondaryLink};
  border: 1px solid ${({ theme }) => theme.colors.borderForm};
  border-radius: ${({ theme }) => theme.radii.md};
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.s10};
  font-size: ${({ theme }) => theme.fontSizes.label};
  font-family: inherit;
  cursor: pointer;
  min-height: ${({ theme }) => theme.sizes.inputSm};
  white-space: nowrap;

  &:hover {
    background: ${({ theme }) => theme.colors.bgSurface};
    border-color: ${({ theme }) => theme.colors.textSecondaryLink};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accentPrimary};
    outline-offset: 2px;
  }
`;

export const DecisionTuningBackdrop = styled.div`
  ${mq.mobile} {
    position: fixed;
    inset: 0;
    z-index: 200;
    background: rgba(0, 0, 0, 0.4);
  }

  ${mq.notMobile} {
    display: none;
  }
`;

export const DecisionTuningPanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  background: ${({ theme }) => theme.colors.navGroupBg};
  border: 1px solid ${({ theme }) => theme.colors.borderForm};
  border-radius: ${({ theme }) => theme.radii.card};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  min-width: 260px;
  max-width: 340px;

  ${mq.mobile} {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 201;
    min-width: 0;
    max-width: 100%;
    max-height: 75dvh;
    overflow-y: auto;
    border-radius: 12px 12px 0 0;
    padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.md};
  }
`;

export const DecisionPanelTitle = styled.div`
  font-size: ${({ theme }) => theme.fontSizes.base};
  font-weight: bold;
  color: ${({ theme }) => theme.colors.textPrimary};
  border-bottom: 1px solid ${({ theme }) => theme.colors.borderForm};
  padding-bottom: ${({ theme }) => theme.spacing.xs};
`;

export const DecisionPanelSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
`;

export const DecisionRow = styled.div`
  display: grid;
  grid-template-columns: 1fr auto auto;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.s6};

  input[type="range"] {
    accent-color: ${({ theme }) => theme.colors.accentPrimary};
    cursor: pointer;
    width: 80px;

    ${mq.mobile} {
      width: 60px;
    }
  }
`;

export const DecisionRowLabel = styled.label`
  font-size: ${({ theme }) => theme.fontSizes.label};
  color: ${({ theme }) => theme.colors.textBodyAlt};
  cursor: default;
  user-select: none;

  span {
    color: ${({ theme }) => theme.colors.textMuted};
    cursor: help;
    font-size: ${({ theme }) => theme.fontSizes.sm};
  }
`;

export const DecisionRowValue = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.label};
  color: ${({ theme }) => theme.colors.textBodyAlt};
  min-width: 52px;
  text-align: right;
  user-select: none;

  ${mq.mobile} {
    min-width: 40px;
  }
`;

export const DecisionToggleRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.s6};

  label {
    font-size: ${({ theme }) => theme.fontSizes.label};
    color: ${({ theme }) => theme.colors.textBodyAlt};
    cursor: pointer;
    user-select: none;

    span {
      color: ${({ theme }) => theme.colors.textMuted};
      cursor: help;
      font-size: ${({ theme }) => theme.fontSizes.sm};
    }
  }

  input[type="checkbox"] {
    accent-color: ${({ theme }) => theme.colors.accentPrimary};
    cursor: pointer;
    width: ${({ theme }) => theme.sizes.iconSm};
    height: ${({ theme }) => theme.sizes.iconSm};
    flex-shrink: 0;
  }
`;

export const DecisionResetButton = styled.button`
  align-self: flex-start;
  background: transparent;
  color: ${({ theme }) => theme.colors.textMuted};
  border: 1px solid ${({ theme }) => theme.colors.borderMid};
  border-radius: ${({ theme }) => theme.radii.md};
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-family: inherit;
  cursor: pointer;

  &:hover {
    background: ${({ theme }) => theme.colors.bgSurface};
    color: ${({ theme }) => theme.colors.textPrimary};
    border-color: ${({ theme }) => theme.colors.borderAccent};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accentPrimary};
    outline-offset: 2px;
  }
`;
