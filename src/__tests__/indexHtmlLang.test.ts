import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("src/index.html", () => {
  it("keeps html lang set to en", () => {
    const indexHtmlPath = path.resolve(process.cwd(), "src/index.html");
    const html = readFileSync(indexHtmlPath, "utf8");
    expect(html).toMatch(/<html[^>]*\slang="en"/i);
  });
});
