import path from "path";
import { describe, expect, it } from "vitest";

import { checkStyleGuideDrift } from "../../scripts/check-style-guide-drift";

describe("check-style-guide-drift", () => {
  it("passes on the known-good fixture", () => {
    const fixturePath = path.resolve(process.cwd(), "src/__tests__/fixtures/good-styleguide.md");
    const result = checkStyleGuideDrift(fixturePath);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("fails on the known-bad fixture", () => {
    const fixturePath = path.resolve(process.cwd(), "src/__tests__/fixtures/bad-styleguide.md");
    const result = checkStyleGuideDrift(fixturePath);
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Unknown color literals"),
        expect.stringContaining("Unknown theme token references"),
      ]),
    );
  });
});
