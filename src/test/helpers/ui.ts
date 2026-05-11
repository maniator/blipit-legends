import { expect } from "vitest";

/**
 * Asserts that an element's `::before` pseudo-element has a negative inset of at
 * least `insetMagnitude` pixels (i.e. the hit-area expansion is active).
 *
 * Pass a **positive** pixel magnitude. The helper internally asserts `top <= -insetMagnitude`
 * to avoid a false-positive when `top === 0` (no expansion).
 */
export const expectPseudoInset = (element: HTMLElement, insetMagnitude: number): void => {
  const expectedNegative = -Math.abs(insetMagnitude);
  const before = window.getComputedStyle(element, "::before");
  const top = Number.parseFloat(before.top);
  const left = Number.parseFloat(before.left);

  if (!Number.isNaN(top) && !Number.isNaN(left)) {
    expect(top).toBeLessThanOrEqual(expectedNegative);
    expect(left).toBeLessThanOrEqual(expectedNegative);
    return;
  }

  expect(document.head.textContent).toMatch(new RegExp(`inset:\\s*-${Math.abs(insetMagnitude)}px`));
};
