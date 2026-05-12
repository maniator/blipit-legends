# QA Artifacts

This directory holds ephemeral outputs from manual QA sessions.

| Sub-directory  | Contents                                     | Git status     |
| -------------- | -------------------------------------------- | -------------- |
| `screenshots/` | PNG screenshots captured during QA sessions  | **gitignored** |
| `scripts/`     | Throwaway test scripts used during QA passes | **gitignored** |

Only `README.md` and committed `.md` session-notes files are tracked in git.

Screenshots are gitignored because they are large binary artifacts that change with
every QA pass and are not needed for CI or code review. Save any noteworthy screenshots
as an attachment on the relevant GitHub issue or PR comment instead.
