/**
 * Centralised responsive breakpoints.
 *
 * NOTE: CSS custom properties cannot be used inside @media queries (the spec
 * evaluates media conditions before the cascade resolves variables).  We
 * therefore expose these as plain TypeScript values and interpolate them
 * directly into styled-components template literals.
 *
 * Keep the SCSS mirror in src/index.scss ($bp-mobile / $bp-desktop) in sync
 * whenever these values change.
 */
export const breakpoints = {
  /** Max width (inclusive) for the mobile layout. */
  mobile: 768,
  /** Min width (inclusive) for the desktop layout. */
  desktop: 1024,
} as const;

/**
 * Ready-made media-query strings for use inside styled-components template
 * literals:
 *
 * ```ts
 * const Foo = styled.div`
 *   ${mq.mobile} { font-size: 11px; }
 *   ${mq.desktop} { display: grid; }
 * `;
 * ```
 */
export const mq = {
  mobile: `@media (max-width: ${breakpoints.mobile}px)`,
  desktop: `@media (min-width: ${breakpoints.desktop}px)`,
  tablet: `@media (min-width: ${breakpoints.mobile + 1}px) and (max-width: ${breakpoints.desktop - 1}px)`,
  /** Applies to tablet + desktop (everything above the mobile breakpoint). */
  notMobile: `@media (min-width: ${breakpoints.mobile + 1}px)`,
  /**
   * Short non-mobile viewports (e.g. 1280×720 laptop screens).
   * Used to compact vertical spacing so nothing is pushed below the fold.
   * "Short" = viewport height ≤ 760 px; "not-mobile" = width > 768 px.
   */
  shortNotMobile: `@media (max-height: 760px) and (min-width: ${breakpoints.mobile + 1}px)`,
  /**
   * Devices that support a fine pointer / hover (desktop, mouse/trackpad).
   * Use instead of raw `@media (hover: hover)` strings.
   */
  canHover: `@media (hover: hover)`,
  /**
   * Touch-primary devices where hover is not available.
   * Use instead of raw `@media (hover: none)` strings.
   */
  noHover: `@media (hover: none)`,
} as const;
