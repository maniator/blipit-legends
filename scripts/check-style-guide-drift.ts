import { readFileSync } from "fs";
import path from "path";

import { theme } from "../src/shared/theme";

type FlatTheme = {
  tokenPaths: Set<string>;
  literals: Set<string>;
};

const HEX_RE = /#[0-9a-fA-F]{3,8}\b/g;
const RGBA_RE = /\brgba?\([^)]+\)/g;
const TOKEN_REF_RE = /\btheme\.[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+\b/g;
const SKIP_FENCE_LANGS = new Set(["bad", "diff", "old"]);
const IGNORE_MARKER = "<!-- style-guide-ignore -->";

const flattenTheme = (input: unknown, prefix = "theme"): FlatTheme => {
  const tokenPaths = new Set<string>();
  const literals = new Set<string>();

  const visit = (value: unknown, keyPath: string): void => {
    if (value === null || value === undefined) return;
    tokenPaths.add(keyPath);

    if (typeof value === "string") {
      const normalizedHex = normalizeHex(value);
      if (normalizedHex !== null) literals.add(normalizedHex);
      const normalizedRgba = normalizeRgba(value);
      if (normalizedRgba !== null) literals.add(normalizedRgba);
      return;
    }

    if (typeof value !== "object" || Array.isArray(value)) return;
    const entries = Object.entries(value as Record<string, unknown>);
    for (const [k, v] of entries) {
      visit(v, `${keyPath}.${k}`);
    }
  };

  visit(input, prefix);
  return { tokenPaths, literals };
};

const normalizeHex = (raw: string): string | null => {
  if (!raw.startsWith("#")) return null;
  const hex = raw.toLowerCase();
  const body = hex.slice(1);
  if (!/^[0-9a-f]+$/.test(body)) return null;

  if (body.length === 3) {
    return `#${body
      .split("")
      .map((char) => `${char}${char}`)
      .join("")}`;
  }

  if (body.length === 4) {
    const expanded = body
      .split("")
      .map((char) => `${char}${char}`)
      .join("");
    return expanded.endsWith("ff") ? `#${expanded.slice(0, 6)}` : `#${expanded}`;
  }

  if (body.length === 6) return `#${body}`;
  if (body.length === 8) return body.endsWith("ff") ? `#${body.slice(0, 6)}` : `#${body}`;

  return null;
};

const normalizeRgba = (raw: string): string | null => {
  if (!/^rgba?\(/i.test(raw)) return null;
  return raw.toLowerCase().replace(/\s+/g, "");
};

const stripIgnoredSegments = (markdown: string): string => {
  const lines = markdown.split("\n");
  const kept: string[] = [];
  let skippingFence = false;

  for (const line of lines) {
    const fenceOpen = line.match(/^```([A-Za-z0-9_-]+)?\s*$/);
    if (fenceOpen) {
      const lang = (fenceOpen[1] ?? "").toLowerCase();
      if (!skippingFence && SKIP_FENCE_LANGS.has(lang)) {
        skippingFence = true;
        continue;
      }
      if (skippingFence) {
        skippingFence = false;
        continue;
      }
    }

    if (skippingFence) continue;
    if (line.includes(IGNORE_MARKER)) continue;
    kept.push(line);
  }

  return kept.join("\n");
};

const collectDocLiterals = (markdown: string): Set<string> => {
  const extracted = new Set<string>();
  for (const hit of markdown.matchAll(HEX_RE)) {
    const normalized = normalizeHex(hit[0]);
    if (normalized !== null) extracted.add(normalized);
  }
  for (const hit of markdown.matchAll(RGBA_RE)) {
    const normalized = normalizeRgba(hit[0]);
    if (normalized !== null) extracted.add(normalized);
  }
  return extracted;
};

const collectTokenRefs = (markdown: string): Set<string> => {
  return new Set(Array.from(markdown.matchAll(TOKEN_REF_RE), (match) => match[0]));
};

export const checkStyleGuideDrift = (docPath: string): { ok: boolean; errors: string[] } => {
  const markdown = readFileSync(docPath, "utf8");
  const sanitizedMarkdown = stripIgnoredSegments(markdown);

  const { tokenPaths, literals } = flattenTheme(theme);
  const docLiterals = collectDocLiterals(sanitizedMarkdown);
  const docTokenRefs = collectTokenRefs(sanitizedMarkdown);

  const errors: string[] = [];
  const unknownLiterals = Array.from(docLiterals).filter((literal) => !literals.has(literal));
  if (unknownLiterals.length > 0) {
    errors.push(`Unknown color literals in style guide: ${unknownLiterals.join(", ")}`);
  }

  const unknownTokenRefs = Array.from(docTokenRefs).filter((ref) => !tokenPaths.has(ref));
  if (unknownTokenRefs.length > 0) {
    errors.push(`Unknown theme token references in style guide: ${unknownTokenRefs.join(", ")}`);
  }

  return { ok: errors.length === 0, errors };
};

const resolveDocPath = (): string => {
  const docArgIndex = process.argv.indexOf("--doc");
  if (docArgIndex >= 0 && process.argv[docArgIndex + 1]) {
    return path.resolve(process.cwd(), process.argv[docArgIndex + 1]);
  }
  return path.resolve(process.cwd(), "docs/style-guide.md");
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const docPath = resolveDocPath();
  const result = checkStyleGuideDrift(docPath);
  if (!result.ok) {
    console.error("[check-style-guide-drift] failed");
    for (const error of result.errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }
  console.log("[check-style-guide-drift] passed");
}
