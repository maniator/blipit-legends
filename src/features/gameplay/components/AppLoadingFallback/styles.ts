import styled from "styled-components";

export const AppFallbackMessage = styled.p`
  color: ${({ theme }) => theme.colors.textMuted};
  text-align: center;
  margin: ${({ theme }) => theme.spacing.s48} auto;
  font-family: ${({ theme }) => theme.fonts.mono};
`;
