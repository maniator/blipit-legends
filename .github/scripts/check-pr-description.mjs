#!/usr/bin/env node
/**
 * check-pr-description.mjs
 *
 * Analyzes a GitHub PR description and flags it if it looks like an
 * AI-generated progress checklist rather than a reviewer-readable description.
 *
 * Heuristics applied:
 *   1. Empty or trivially short body.
 *   2. Checkbox ratio: >50% of non-empty content lines are task checkboxes
 *      (- [ ] / - [x] / * [ ] / * [x]).
 *   3. No prose: fewer than 2 lines of plain narrative text (non-list,
 *      non-heading, non-code-fence, length > 20 chars).
 *
 * Usage:
 *   PR_BODY="..." node .github/scripts/check-pr-description.mjs
 *
 * Exit codes:
 *   0 — description is reviewer-friendly
 *   1 — description needs improvement (warning; does not block merge)
 */

const body = process.env.PR_BODY ?? "";
const trimmed = body.trim();

if (trimmed.length < 30) {
  console.log("PR description is empty or too short to be useful to reviewers.");
  process.exit(1);
}

const lines = trimmed.split("\n");
const nonEmptyLines = lines.filter((l) => l.trim().length > 0);

if (nonEmptyLines.length === 0) {
  console.log("PR description has no content.");
  process.exit(1);
}

let inCodeBlock = false;
let checkboxCount = 0;
let proseCount = 0;

for (const line of nonEmptyLines) {
  const t = line.trim();

  // Toggle code-fence tracking so we don't classify code as prose or checkboxes.
  if (t.startsWith("```")) {
    inCodeBlock = !inCodeBlock;
    continue;
  }
  if (inCodeBlock) continue;

  if (/^[-*]\s+\[[ x]\]/.test(t)) {
    checkboxCount++;
  } else if (/^#{1,6}\s/.test(t)) {
    // Headings are structural — neutral; don't count toward prose or checkbox.
  } else if (/^[-*+]\s/.test(t) || /^\d+\.\s/.test(t)) {
    // Plain list items — neutral for the prose check.
  } else if (t.length > 20) {
    proseCount++;
  }
}

const total = nonEmptyLines.length;
const checkboxRatio = checkboxCount / total;
const issues = [];

if (checkboxRatio > 0.5) {
  issues.push(
    `${checkboxCount} of ${total} non-empty lines are task checkboxes ` +
      `(${Math.round(checkboxRatio * 100)}%). This looks like an AI progress log, ` +
      "not a reviewer-readable description.",
  );
}

if (proseCount < 2) {
  issues.push(
    "No prose summary found. The description needs at least a sentence or two " +
      "explaining what changed and why so reviewers have context.",
  );
}

if (issues.length > 0) {
  for (const issue of issues) {
    console.log(`⚠️  ${issue}`);
  }
  process.exit(1);
}

console.log("✅ PR description looks reviewer-friendly.");
process.exit(0);
