import { describe, expect, it } from "vitest";

import { theme } from "./theme";

const hexToRgb = (hex: string): [number, number, number] => {
  const clean = hex.replace("#", "");
  return [
    Number.parseInt(clean.slice(0, 2), 16),
    Number.parseInt(clean.slice(2, 4), 16),
    Number.parseInt(clean.slice(4, 6), 16),
  ];
};

const toLinear = (channel: number): number => {
  const value = channel / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
};

const luminance = (hex: string): number => {
  const [r, g, b] = hexToRgb(hex);
  const red = toLinear(r);
  const green = toLinear(g);
  const blue = toLinear(b);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
};

const contrast = (foreground: string, background: string): number => {
  const fg = luminance(foreground);
  const bg = luminance(background);
  const lighter = Math.max(fg, bg);
  const darker = Math.min(fg, bg);
  return (lighter + 0.05) / (darker + 0.05);
};

describe("Sprint 1 contrast guardrails (Story 3.1)", () => {
  it("keeps textHint at WCAG AA contrast on key dark surfaces", () => {
    expect(contrast(theme.colors.textHint, theme.colors.bgDeep)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(theme.colors.textHint, theme.colors.bgSurface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(theme.colors.textHint, theme.colors.bgGame)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps textNavFaint at WCAG AA contrast on black surfaces", () => {
    expect(contrast(theme.colors.textNavFaint, theme.colors.bgVoid)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps textScoreDim and scoreboard numerics at WCAG AAA in game scoreboard", () => {
    expect(contrast(theme.colors.textScoreDim, theme.colors.bgGame)).toBeGreaterThanOrEqual(7);
    expect(contrast(theme.colors.textScore, theme.colors.bgGame)).toBeGreaterThanOrEqual(7);
  });
});

describe("Sprint 2 Tier-2 contrast guardrails (Story 9.1)", () => {
  it("textDimmer meets WCAG AA (≥4.5:1) on all primary dark surfaces", () => {
    expect(contrast(theme.colors.textDimmer, theme.colors.bgSurface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(theme.colors.textDimmer, theme.colors.bgGame)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(theme.colors.textDimmer, theme.colors.bgDeep)).toBeGreaterThanOrEqual(4.5);
  });

  it("textNavMid meets WCAG AA (≥4.5:1) on all primary dark surfaces", () => {
    expect(contrast(theme.colors.textNavMid, theme.colors.bgSurface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(theme.colors.textNavMid, theme.colors.bgGame)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(theme.colors.textNavMid, theme.colors.bgDeep)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("Sprint 2 font-size minimum guardrails (Story 8.1)", () => {
  const MIN_PX = 12;
  const ROOT_FONT_PX = 16;

  const toPx = (value: string): number => {
    if (value.endsWith("px")) return parseFloat(value);
    if (value.endsWith("rem")) return parseFloat(value) * ROOT_FONT_PX;
    return NaN;
  };

  it("fontSizes.xs is at least 12px", () => {
    expect(toPx(theme.fontSizes.xs)).toBeGreaterThanOrEqual(MIN_PX);
  });

  it("fontSizes.sm is at least 12px", () => {
    expect(toPx(theme.fontSizes.sm)).toBeGreaterThanOrEqual(MIN_PX);
  });

  it("fontSizes.tiny resolves to at least 12px at 16px root", () => {
    expect(toPx(theme.fontSizes.tiny)).toBeGreaterThanOrEqual(MIN_PX);
  });
});
