import styled, { css } from "styled-components";

export const Wrapper = styled.span`
  position: relative;
  display: inline-block;
  line-height: 1;
`;

export const Trigger = styled.button`
  background: none;
  border: 0;
  padding: 0 0.15rem;
  margin: 0;
  font: inherit;
  color: inherit;
  cursor: help;
  line-height: 1;
  /* Generous tap target on touch devices without enlarging visual size. */
  min-width: 1.75rem;
  min-height: 1.75rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accentPrimary};
    outline-offset: 2px;
    border-radius: 4px;
  }
`;

const bubbleVisible = css`
  visibility: visible;
  opacity: 1;
`;

export const Bubble = styled.span<{ $open: boolean }>`
  position: absolute;
  z-index: 50;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  white-space: normal;
  width: max-content;
  max-width: min(80vw, 22rem);
  padding: 0.5rem 0.625rem;
  background: ${({ theme }) => theme.colors.bgInput};
  color: ${({ theme }) => theme.colors.textPrimary};
  border-radius: 6px;
  font-size: ${({ theme }) => theme.fontSizes.sub};
  font-weight: 400;
  line-height: 1.35;
  text-align: left;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
  pointer-events: none;
  visibility: hidden;
  opacity: 0;
  transition:
    opacity 100ms ease-in,
    visibility 0s linear 100ms;

  ${(p) => p.$open && bubbleVisible}

  /* On devices that can hover (desktop), also show on hover regardless of
     the tap-toggle state, so existing hover UX is preserved. */
  @media (hover: hover) {
    ${Wrapper}:hover & {
      ${bubbleVisible}
    }
  }

  /* Small downward arrow */
  &::after {
    content: "";
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 5px solid transparent;
    border-top-color: ${({ theme }) => theme.colors.bgInput};
  }
`;
