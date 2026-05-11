import { expect } from "vitest";

/** Escapes regex metacharacters in `s` so it can be safely used inside `new RegExp(…)`. */
const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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

  // Fallback for happy-dom (our test environment), which returns NaN for
  // pseudo-element computed styles. Scope the search to a CSS rule that references
  // one of this element's own class names to avoid false positives when another
  // component injects the same inset value.
  const classes = element.className.split(/\s+/).filter(Boolean);
  const insetPx = `-${Math.abs(insetMagnitude)}px`;
  const headText = document.head.textContent ?? "";

  const matched = classes.some((cls) => {
    // Matches: .<className> (optional extras) ::before { ... inset: -Npx ... }
    // [^{]* skips extras before the opening brace; [^}]* skips other CSS properties
    // inside the rule without crossing the closing brace boundary.
    const pattern = new RegExp(
      `\\.${escapeRegExp(cls)}[^{]*::before[^{]*\\{[^}]*inset:\\s*${insetPx}`,
      "s",
    );
    return pattern.test(headText);
  });

  expect(matched, `Expected ::before on .${classes.join("/.")} to have inset: ${insetPx}`).toBe(
    true,
  );
};
