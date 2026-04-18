const body = (process.env.PR_BODY ?? '').replace(/\r\n/g, '\n').trim();

if (!body) {
  console.error(
    'PR description is required and must follow the pull request template.'
  );
  process.exit(1);
}

const stripHtmlComments = (input) =>
  input.replace(/<!--[\s\S]*?-->/g, '').trim();

const getSectionContent = (title) => {
  const headers = Array.from(body.matchAll(/^##\s+(.+?)\s*$/gm)).map(
    (match) => ({
      index: match.index ?? 0,
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
  const end = sectionIdx + 1 < headers.length ? headers[sectionIdx + 1].index : body.length;
  return stripHtmlComments(body.slice(start, end)).trim();
};

const requiredSections = ['Summary', 'Changes', 'Testing', 'Risks'];
const missingOrEmpty = requiredSections.filter((section) => {
  const content = getSectionContent(section);
  return content.length === 0;
});

if (missingOrEmpty.length > 0) {
  console.error(
    `PR description must include non-empty sections: ${requiredSections.join(', ')}. Missing/empty: ${missingOrEmpty.join(', ')}.`
  );
  process.exit(1);
}

const nonHeadingLines = stripHtmlComments(body)
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line.length > 0)
  .filter((line) => !line.startsWith('## '));

const checklistLineCount = nonHeadingLines.filter((line) =>
  /^-\s+\[(?: |x|X)\](?:\s+|$)/.test(line)
).length;

if (nonHeadingLines.length > 0 && checklistLineCount === nonHeadingLines.length) {
  console.error(
    'PR description cannot be checklist-only. Use the pull request template sections with prose content.'
  );
  process.exit(1);
}

console.log('PR description matches required template sections.');
