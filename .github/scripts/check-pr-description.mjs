const body = (process.env.PR_BODY ?? '').replace(/\r\n/g, '\n').trim();
// Matches markdown task list items:
// - [ ] text
// - [x] text
// - [X] text
const CHECKLIST_ITEM_PATTERN = /^-\s+\[(?: |x|X)\](?:\s+|$)/;

if (!body) {
  console.error(
    'PR description is required and must follow the pull request template.'
  );
  process.exit(1);
}

function stripHtmlComments(input) {
  return input.replace(/<!--[\s\S]*?-->/g, '').trim();
}

function toNonEmptyTrimmedLines(input) {
  return input
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function getSectionContent(title) {
  const headers = Array.from(body.matchAll(/^##\s+(.+?)\s*$/gm)).map(
    (match) => ({
      index: match.index,
      raw: match[0],
      title: match[1].trim()
    })
  );

  const sectionIdx = headers.findIndex(
    (header) => header.title.toLowerCase() === title.toLowerCase()
  );

  if (sectionIdx === -1) {
    return '';
  }

  const start = headers[sectionIdx].index + headers[sectionIdx].raw.length;
  const nextHeaderExists = sectionIdx + 1 < headers.length;
  const end = nextHeaderExists ? headers[sectionIdx + 1].index : body.length;
  return stripHtmlComments(body.slice(start, end)).trim();
}

const requiredSections = ['Summary', 'Changes', 'Testing', 'Risks'];
const sectionContentMap = new Map(
  requiredSections.map((section) => [section, getSectionContent(section)])
);
const missingOrEmpty = requiredSections.filter(
  (section) => (sectionContentMap.get(section) ?? '').length === 0
);

if (missingOrEmpty.length > 0) {
  console.error(
    `PR description must include non-empty sections: ${requiredSections.join(', ')}. Missing/empty: ${missingOrEmpty.join(', ')}.`
  );
  process.exit(1);
}

const nonHeadingLines = toNonEmptyTrimmedLines(stripHtmlComments(body)).filter(
  (line) => !line.startsWith('## ')
);

const checklistItemCount = nonHeadingLines.reduce(
  (count, line) => count + (CHECKLIST_ITEM_PATTERN.test(line) ? 1 : 0),
  0
);

const hasNonHeadingContent = nonHeadingLines.length > 0;
const isChecklistOnlyBody =
  hasNonHeadingContent && checklistItemCount === nonHeadingLines.length;

if (isChecklistOnlyBody) {
  console.error(
    'PR description cannot be checklist-only. Use the pull request template sections with prose content.'
  );
  process.exit(1);
}

const hasProseInRequiredSections = requiredSections.some((section) => {
  const lines = toNonEmptyTrimmedLines(sectionContentMap.get(section) ?? '');
  return lines.some((line) => !CHECKLIST_ITEM_PATTERN.test(line));
});

if (!hasProseInRequiredSections) {
  console.error(
    'At least one required section must include prose content, not only checklist items.'
  );
  process.exit(1);
}

console.log('PR description matches required template sections.');
