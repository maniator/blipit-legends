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
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = body.match(
    new RegExp(`^##\\s+${escaped}\\s*$\\n([\\s\\S]*?)(?=^##\\s+|\\Z)`, 'im')
  );

  if (!match) {
    return '';
  }

  return stripHtmlComments(match[1]).trim();
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
  /^-\s+\[(?: |x|X)\]\s+/.test(line)
).length;

if (nonHeadingLines.length > 0 && checklistLineCount === nonHeadingLines.length) {
  console.error(
    'PR description cannot be checklist-only. Use the pull request template sections with prose content.'
  );
  process.exit(1);
}

console.log('PR description matches required template sections.');
