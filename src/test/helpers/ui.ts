import { expect } from "vitest";

export const expectPseudoInset = (element: HTMLElement, expectedInset: number): void => {
  const before = window.getComputedStyle(element, "::before");
  const top = Number.parseFloat(before.top);
  const left = Number.parseFloat(before.left);

  if (!Number.isNaN(top) && !Number.isNaN(left)) {
    expect(top).toBeLessThanOrEqual(expectedInset);
    expect(left).toBeLessThanOrEqual(expectedInset);
    return;
  }

  expect(document.head.textContent).toMatch(new RegExp(`inset:\\s*${expectedInset}px`));
};
