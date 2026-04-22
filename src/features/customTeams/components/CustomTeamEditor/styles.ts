import { mq } from "@shared/utils/mediaQueries";
import styled, { css, keyframes } from "styled-components";

export const EditorContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0;
  max-width: 680px;
  margin: 0 auto;
  width: 100%;
  padding: ${({ theme }) => theme.spacing.xxl};

  ${mq.mobile} {
    padding: ${({ theme }) => theme.spacing.lg};
  }
`;

export const EditorTitle = styled.h2`
  color: ${({ theme }) => theme.colors.accentPrimary};
  font-size: ${({ theme }) => theme.fontSizes.xxl};
  margin: 0 0 ${({ theme }) => theme.spacing.xl};
`;

export const FormSection = styled.section`
  margin-bottom: ${({ theme }) => theme.spacing.xl};
`;

export const SectionHeading = styled.h3`
  color: ${({ theme }) => theme.colors.textSecondaryLink};
  font-size: ${({ theme }) => theme.fontSizes.sub};
  text-transform: uppercase;
  letter-spacing: ${({ theme }) => theme.letterSpacing.wider};
  margin: 0 0 ${({ theme }) => theme.spacing.s10};
  border-bottom: 1px solid ${({ theme }) => theme.colors.borderDark};
  padding-bottom: ${({ theme }) => theme.spacing.s6};
`;

export const FieldRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.md};
  margin-bottom: ${({ theme }) => theme.spacing.s10};
  flex-wrap: wrap;

  ${mq.mobile} {
    gap: ${({ theme }) => theme.spacing.sm};
  }
`;

export const FieldGroup = styled.div<{ $flex?: number }>`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
  flex: ${({ $flex }) => $flex ?? 1};
  min-width: 120px;
`;

export const FieldLabel = styled.label`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  text-transform: uppercase;
  letter-spacing: ${({ theme }) => theme.letterSpacing.wide};
  color: ${({ theme }) => theme.colors.textHint};
`;

export const TextInput = styled.input`
  background: ${({ theme }) => theme.colors.bgInput};
  border: 1px solid ${({ theme }) => theme.colors.borderForm};
  color: ${({ theme }) => theme.colors.textPrimary};
  border-radius: ${({ theme }) => theme.radii.md};
  padding: ${({ theme }) => theme.spacing.s7} ${({ theme }) => theme.spacing.s10};
  font-family: inherit;
  font-size: ${({ theme }) => theme.fontSizes.md};
  width: 100%;

  &:focus {
    outline: 2px solid ${({ theme }) => theme.colors.accentPrimary};
    outline-offset: 1px;
  }

  &[aria-invalid="true"] {
    border-color: ${({ theme }) => theme.colors.dangerText};
  }
`;

export const StatsGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
  margin-top: ${({ theme }) => theme.spacing.xs};
`;

export const StatRow = styled.div<{ $locked?: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  width: 100%;
  opacity: ${({ $locked }) => ($locked ? 0.5 : 1)};
  pointer-events: ${({ $locked }) => ($locked ? "none" : "auto")};
`;

export const StatLabel = styled.label`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.textHint};
  width: ${({ theme }) => theme.spacing.s40};
  flex-shrink: 0;
`;

export const StatInput = styled.input`
  flex: 1;
  accent-color: ${({ theme }) => theme.colors.accentPrimary};
  cursor: pointer;

  &:disabled {
    cursor: not-allowed;
  }
`;

export const StatValue = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.label};
  color: ${({ theme }) => theme.colors.textLink};
  width: ${({ theme }) => theme.spacing.s28};
  text-align: right;
  flex-shrink: 0;
`;

/**
 * One-shot 1.5s highlight applied to a freshly added player row. Uses
 * `bgPlayerSelected` from the theme as the peak background and fades back to
 * the card's default surface. `prefers-reduced-motion: reduce` collapses the
 * animation to its final state (no flash).
 */
const newRowHighlight = keyframes`
  0%   { background-color: var(--player-card-highlight); }
  100% { background-color: var(--player-card-bg); }
`;

export const PlayerCard = styled.div<{ $isNewlyAdded?: boolean }>`
  background: ${({ theme }) => theme.colors.bgSurface};
  border: 1px solid ${({ theme }) => theme.colors.borderCard};
  border-radius: ${({ theme }) => theme.radii.lg};
  padding: ${({ theme }) => theme.spacing.s10} ${({ theme }) => theme.spacing.md};
  margin-bottom: ${({ theme }) => theme.spacing.sm};

  ${({ theme, $isNewlyAdded }) =>
    $isNewlyAdded &&
    css`
      --player-card-bg: ${theme.colors.bgSurface};
      --player-card-highlight: ${theme.colors.bgPlayerSelected};
      animation: ${newRowHighlight} 1500ms ease-out 1 both;

      @media (prefers-reduced-motion: reduce) {
        animation: none;
        background: ${theme.colors.bgSurface};
      }
    `}
`;

export const PlayerHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  margin-bottom: ${({ theme }) => theme.spacing.sm};
`;

export const SmallIconBtn = styled.button`
  background: transparent;
  border: 1px solid ${({ theme }) => theme.colors.borderForm};
  color: ${({ theme }) => theme.colors.textSecondaryLink};
  border-radius: ${({ theme }) => theme.radii.sm};
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
  font-size: ${({ theme }) => theme.fontSizes.label};
  font-family: inherit;
  cursor: pointer;
  min-height: ${({ theme }) => theme.spacing.s28};
  flex-shrink: 0;

  &:hover {
    background: ${({ theme }) => theme.colors.bgSurface};
    border-color: ${({ theme }) => theme.colors.textSecondaryLink};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accentPrimary};
    outline-offset: 2px;
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

export const RemoveBtn = styled(SmallIconBtn)`
  color: ${({ theme }) => theme.colors.dangerText};
  border-color: ${({ theme }) => theme.colors.borderDanger};

  &:hover {
    background: ${({ theme }) => theme.colors.dangerHoverBg};
    border-color: ${({ theme }) => theme.colors.dangerHoverBorder};
  }
`;

export const AddPlayerBtn = styled.button`
  background: transparent;
  color: ${({ theme }) => theme.colors.accentPrimary};
  border: 1px dashed ${({ theme }) => theme.colors.borderAccent};
  border-radius: ${({ theme }) => theme.radii.md};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.lg};
  font-size: ${({ theme }) => theme.fontSizes.base};
  font-family: inherit;
  cursor: pointer;
  width: 100%;
  margin-top: ${({ theme }) => theme.spacing.xs};

  &:hover {
    background: ${({ theme }) => theme.colors.bgSurface};
    border-color: ${({ theme }) => theme.colors.accentPrimary};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accentPrimary};
    outline-offset: 2px;
  }
`;

export const ErrorMsg = styled.p`
  color: ${({ theme }) => theme.colors.textWarn};
  font-size: ${({ theme }) => theme.fontSizes.base};
  margin: 0 0 ${({ theme }) => theme.spacing.md};
  background: ${({ theme }) => theme.colors.errorBg};
  border: 1px solid ${({ theme }) => theme.colors.borderDanger};
  border-radius: ${({ theme }) => theme.radii.md};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
`;

export const SelectInput = styled.select`
  background: ${({ theme }) => theme.colors.bgInput};
  border: 1px solid ${({ theme }) => theme.colors.borderForm};
  color: ${({ theme }) => theme.colors.textPrimary};
  border-radius: ${({ theme }) => theme.radii.md};
  padding: ${({ theme }) => theme.spacing.s6} ${({ theme }) => theme.spacing.sm};
  font-family: inherit;
  font-size: ${({ theme }) => theme.fontSizes.base};
  cursor: pointer;
  min-height: ${({ theme }) => theme.sizes.inputMd};

  &:focus {
    outline: 2px solid ${({ theme }) => theme.colors.accentPrimary};
    outline-offset: 1px;
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accentPrimary};
    outline-offset: 1px;
  }
`;

/** Two-row Team Info layout: Name (full width) then Abbrev + City. Stacks cleanly on mobile. */
export const TeamInfoGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${({ theme }) => theme.spacing.s10};
  margin-bottom: ${({ theme }) => theme.spacing.s10};
`;

export const TeamInfoSecondRow = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${({ theme }) => theme.spacing.sm};

  ${mq.desktop} {
    grid-template-columns: 150px 1fr;
    gap: ${({ theme }) => theme.spacing.md};
  }
`;

/** Row for position + handedness selects, below the name input. */
export const PlayerMeta = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
  margin-bottom: ${({ theme }) => theme.spacing.s6};
  flex-wrap: wrap;
`;

export const MetaGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xxs};
  min-width: 0;
`;

export const ButtonRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.md};
  margin-top: ${({ theme }) => theme.spacing.xxl};
  flex-wrap: wrap;
`;

export const SaveBtn = styled.button`
  background: ${({ theme }) => theme.colors.accentPrimary};
  color: ${({ theme }) => theme.colors.btnPrimaryText};
  border: none;
  border-radius: ${({ theme }) => theme.radii.pill};
  padding: ${({ theme }) => theme.spacing.s10} ${({ theme }) => theme.spacing.s28};
  font-size: ${({ theme }) => theme.fontSizes.lg};
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  min-height: ${({ theme }) => theme.sizes.btnLg};

  &:hover {
    background: ${({ theme }) => theme.colors.accentBright};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.textPrimary};
    outline-offset: 2px;
  }
`;

export const CancelBtn = styled.button`
  background: transparent;
  color: ${({ theme }) => theme.colors.textSemiLight};
  border: 1px solid ${({ theme }) => theme.colors.borderMid};
  border-radius: ${({ theme }) => theme.radii.pill};
  padding: ${({ theme }) => theme.spacing.s10} ${({ theme }) => theme.spacing.xxl};
  font-size: ${({ theme }) => theme.fontSizes.md};
  font-family: inherit;
  cursor: pointer;
  min-height: ${({ theme }) => theme.sizes.btnLg};

  &:hover {
    background: ${({ theme }) => theme.colors.bgDropdown};
    border-color: ${({ theme }) => theme.colors.textDimmer};
    color: ${({ theme }) => theme.colors.textDropdown};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accentPrimary};
    outline-offset: 2px;
  }
`;

export const GenerateBtn = styled.button`
  background: transparent;
  color: ${({ theme }) => theme.colors.textSecondaryLink};
  border: 1px solid ${({ theme }) => theme.colors.borderForm};
  border-radius: ${({ theme }) => theme.radii.md};
  padding: ${({ theme }) => theme.spacing.s7} ${({ theme }) => theme.spacing.s14};
  font-size: ${({ theme }) => theme.fontSizes.base};
  font-family: inherit;
  cursor: pointer;
  min-height: ${({ theme }) => theme.sizes.btnMd};

  &:hover {
    background: ${({ theme }) => theme.colors.bgSurface};
    border-color: ${({ theme }) => theme.colors.textSecondaryLink};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accentPrimary};
    outline-offset: 2px;
  }
`;

export const StatBudgetRow = styled.div<{ $overCap: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.s6};
  margin-top: ${({ theme }) => theme.spacing.s6};
  font-size: ${({ theme }) => theme.fontSizes.label};
  color: ${({ $overCap, theme }) => ($overCap ? theme.colors.textWarn : theme.colors.textHint)};
`;

export const ReadOnlyInput = styled(TextInput)`
  opacity: 0.7;
  cursor: default;
  background: ${({ theme }) => theme.colors.bgSubtle};
  color: ${({ theme }) => theme.colors.textReadOnly};
  border-color: ${({ theme }) => theme.colors.borderPanel};

  &[readonly] {
    cursor: default;
    opacity: 0.7;
  }
`;

export const IdentityLockHint = styled.p`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.textNavMid};
  margin: ${({ theme }) => theme.spacing.xxs} 0 ${({ theme }) => theme.spacing.sm};
`;

export const FieldHint = styled.p`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.textHint};
  margin: ${({ theme }) => theme.spacing.s3} 0 0;
  line-height: 1.3;
`;

/** Thin rule that separates the stat-budget section from the Durability section. */
export const StaminaSectionDivider = styled.hr`
  border: none;
  border-top: 1px solid ${({ theme }) => theme.colors.borderPanel};
  margin: ${({ theme }) => theme.spacing.sm} 0 ${({ theme }) => theme.spacing.xs};
`;

/** Small label above the stamina slider ("DURABILITY"). */
export const StaminaSectionLabel = styled.p`
  font-size: ${({ theme }) => theme.fontSizes.label};
  color: ${({ theme }) => theme.colors.textHint};
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin: 0 0 ${({ theme }) => theme.spacing.xxs};
`;

/** Import-player button — ghost blue style, mirrors AddPlayerBtn. */
export const ImportPlayerBtn = styled(AddPlayerBtn)`
  color: ${({ theme }) => theme.colors.textSecondaryLink};
  border-color: ${({ theme }) => theme.colors.borderForm};
  margin-top: ${({ theme }) => theme.spacing.xs};

  &:hover {
    border-color: ${({ theme }) => theme.colors.textSecondaryLink};
    color: ${({ theme }) => theme.colors.textLink};
  }
`;

/** Warning banner shown when an imported player matches an existing one. */
export const PlayerDuplicateBanner = styled.div`
  background: ${({ theme }) => theme.colors.bgWarnSurface};
  border: 1px solid ${({ theme }) => theme.colors.borderWarn};
  border-radius: ${({ theme }) => theme.radii.md};
  padding: 10px ${({ theme }) => theme.spacing.md};
  margin-top: ${({ theme }) => theme.spacing.xs};
  font-size: ${({ theme }) => theme.fontSizes.label};
  color: ${({ theme }) => theme.colors.textWarnSubtle};
`;

export const PlayerDuplicateActions = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
  margin-top: ${({ theme }) => theme.spacing.sm};
  flex-wrap: wrap;
`;

/**
 * Visually-hidden polite live region used to announce roster mutations
 * (e.g. "New batter added — New batter 3") to assistive tech without
 * affecting layout. Uses the standard SR-only clip pattern.
 */
export const LiveRegion = styled.div`
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
`;
