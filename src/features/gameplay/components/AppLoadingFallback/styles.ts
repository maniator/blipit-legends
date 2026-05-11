import styled from "styled-components";

export const AppFallbackMessage = styled.p`
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.colors.textMuted};
  text-align: center;
  margin: ${({ theme }) => theme.spacing.s48} auto;
  min-height: 50dvh;
  font-family: ${({ theme }) => theme.fonts.mono};
`;
