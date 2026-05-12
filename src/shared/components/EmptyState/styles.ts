import styled from "styled-components";

export const EmptyStateRoot = styled.div`
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => `${theme.spacing.s40} ${theme.spacing.xl}`};
`;

export const EmptyStateIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
`;

export const EmptyStateTitle = styled.h2`
  margin: 0;
  font-size: ${({ theme }) => theme.fontSizes.h2};
  color: ${({ theme }) => theme.colors.textPrimary};
`;

export const EmptyStateBody = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.fontSizes.body};
  color: ${({ theme }) => theme.colors.textHint};
`;

export const EmptyStateAction = styled.button`
  background: ${({ theme }) => theme.colors.accentPrimary};
  color: ${({ theme }) => theme.colors.btnPrimaryText};
  border: none;
  border-radius: ${({ theme }) => theme.radii.pill};
  padding: ${({ theme }) => `${theme.spacing.s10} ${theme.spacing.xxl}`};
  font-family: inherit;
  font-size: ${({ theme }) => theme.fontSizes.md};
  font-weight: 600;
  cursor: pointer;
  min-height: ${({ theme }) => theme.sizes.btnMd};

  &:hover {
    opacity: 0.9;
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accentPrimary};
    outline-offset: 2px;
    border-radius: ${({ theme }) => theme.radii.pill};
  }
`;
