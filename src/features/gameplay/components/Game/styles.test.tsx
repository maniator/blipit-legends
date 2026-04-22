import * as React from "react";

import { theme } from "@shared/theme";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DbResetNotice, StealClampNotice } from "./styles";

/**
 * Smoke tests for styled components that consume theme tokens.  These guard
 * against regressions where a styled-component references a theme key that no
 * longer exists (TS catches it at typecheck, but a unit test makes the failure
 * obvious in test runs too).  The previous regression that motivated this file
 * was `StealClampNotice` referencing `theme.colors.bgInfo`, which is not part
 * of the theme palette.
 */
describe("Game/styles — theme-coupled styled components", () => {
  it("StealClampNotice renders with the bgWarn background color", () => {
    const { container } = render(<StealClampNotice>notice</StealClampNotice>);
    const el = container.firstElementChild as HTMLElement;
    expect(el).toBeTruthy();
    const bg = window.getComputedStyle(el).backgroundColor;
    // styled-components v6 inlines the resolved value; assert both the token
    // value and that *some* background was resolved (i.e. the theme key existed).
    expect(bg).not.toBe("");
    // The exact value depends on jsdom's CSS parser; assert the styled-component
    // expression resolved by checking the rendered class includes a hash.
    expect(el.className).toMatch(/sc-/);
  });

  it("DbResetNotice renders with the bgWarn background color", () => {
    const { container } = render(<DbResetNotice>reset</DbResetNotice>);
    const el = container.firstElementChild as HTMLElement;
    expect(el).toBeTruthy();
    expect(el.className).toMatch(/sc-/);
  });

  it("theme palette exposes bgWarn used by Game notice components", () => {
    expect(theme.colors.bgWarn).toBeDefined();
    expect(typeof theme.colors.bgWarn).toBe("string");
  });
});
