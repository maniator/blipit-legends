import styled from "styled-components";

/** Collapsible section wrapper used by HelpContent accordion entries. */
export const SectionDetails = styled.details`
  border: 1px solid ${({ theme }) => theme.colors.borderFormAlpha35};
  border-radius: ${({ theme }) => theme.radii.lg};
  margin-bottom: ${({ theme }) => theme.spacing.s10};
  overflow: hidden;

  &[open] > summary {
    border-bottom: 1px solid ${({ theme }) => theme.colors.borderFormAlpha35};
  }
`;

export const SectionSummary = styled.summary`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.s10} ${({ theme }) => theme.spacing.s14};
  font-size: ${({ theme }) => theme.fontSizes.base};
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: ${({ theme }) => theme.letterSpacing.wider};
  color: ${({ theme }) => theme.colors.textSecondaryLink};
  cursor: pointer;
  user-select: none;
  list-style: none;

  &::-webkit-details-marker {
    display: none;
  }

  &::after {
    content: "▸";
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.borderForm};
    flex-shrink: 0;
    transition: transform 0.15s;
  }

  details[open] > &::after {
    transform: rotate(90deg);
  }

  &:hover {
    background: ${({ theme }) => theme.colors.bgFormAlpha15};
  }
`;

export const SectionBody = styled.div`
  padding: ${({ theme }) => theme.spacing.s10} ${({ theme }) => theme.spacing.s14}
    ${({ theme }) => theme.spacing.md};
`;

export const List = styled.ul`
  margin: 0;
  padding-left: ${({ theme }) => theme.spacing.s18};
  color: ${({ theme }) => theme.colors.textBody};
`;

export const Li = styled.li`
  margin-bottom: ${({ theme }) => theme.spacing.xs};
`;

/** Label that visually groups related accordion sections (e.g. "Exhibition"). */
export const GroupLabel = styled.p`
  color: ${({ theme }) => theme.colors.textAccent};
  font-size: ${({ theme }) => theme.fontSizes.sub};
  font-weight: 700;
  letter-spacing: ${({ theme }) => theme.letterSpacing.widest};
  text-transform: uppercase;
  margin: ${({ theme }) => theme.spacing.md} 0 ${({ theme }) => theme.spacing.xs};

  &:first-child {
    margin-top: 0;
  }
`;
