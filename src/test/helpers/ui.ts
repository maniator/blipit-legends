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

  // Fallback for jsdom/happy-dom where ::before computed styles return NaN.
  // Scope the search to a CSS rule that references one of this element's own class
  // names to avoid false positives when another component injects the same inset value.
  const classes = element.className.split(/\s+/).filter(Boolean);
  const insetPx = `-${Math.abs(insetMagnitude)}px`;
  const headText = document.head.textContent ?? "";

  const matched = classes.some((cls) => {
    // Escape the class name so that any regex metacharacters (e.g., from
    // styled-components generated hashes) are treated as literals.
    const escapedCls = cls.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Match a rule containing this class name that also contains the expected inset
    // within the same ::before block.  [^{]* / [^}]* safely skip other properties
    // without crossing block boundaries.
    const pattern = new RegExp(
      `\\.${escapedCls}[^{]*::before[^{]*\\{[^}]*inset:\\s*${insetPx}`,
      "s",
    );
    return pattern.test(headText);
  });

  expect(matched, `Expected ::before on .${classes.join("/.")} to have inset: ${insetPx}`).toBe(true);
};
