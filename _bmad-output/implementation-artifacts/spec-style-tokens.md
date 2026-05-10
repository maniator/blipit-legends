---
title: "League Mode v1 — Style Tokens: StatusPill, StatusBanner, EmptyState, ModalShell"
type: "feature"
created: "2026-05-10"
status: "ready-for-dev"
baseline_commit: "8d9318a"
context:
  - "{project-root}/docs/league-mode/style-guide-additions.md"
  - "{project-root}/docs/league-mode/ui-reuse.md"
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** League Mode v1 UI components (LeaguesHubPage, SeasonTeamPage, CustomTeamEditor lock, etc.) need shared primitive components — StatusPill, StatusBanner, EmptyState, ModalShell — that don't exist yet in `src/shared/components/`.

**Approach:** Extract and create four shared components following patterns established in `docs/league-mode/style-guide-additions.md` and `ui-reuse.md`, using only existing theme tokens. No new hex colors — all colors pulled from `src/shared/theme.ts`.

## Boundaries & Constraints

**Always:**

- Colors exclusively from `src/shared/theme.ts` tokens — no new hex strings inline
- `styled.div<{ $variant: "..." }>` transient-prop pattern for all variant-driven styles
- `import * as React from "react"` in all component files
- `import { mq } from "@shared/utils/mediaQueries"` — never raw `@media` strings
- `dvh` not `vh` for any height constraints
- `theme.radii.pill` for StatusPill border-radius (value is `20px` per theme)
- `aria-live="polite"` on StatusBanner `info`/`neutral`; `role="alert"` on `warn`
- Export from barrel index file at each component folder

**Never:**

- Introduce new colors not in `src/shared/theme.ts`
- Put league-specific business logic in shared components
- Break existing usages of exhibition modal styles or SaveSlotList

## I/O & Edge-Case Matrix

| Scenario            | Input / State                 | Expected Output / Behavior             | Error Handling |
| ------------------- | ----------------------------- | -------------------------------------- | -------------- |
| StatusPill fresh    | `variant="fresh"`             | Green pill using `statusSuccess` token | —              |
| StatusPill tired    | `variant="tired"`             | Gold pill using `textFatigueMed` token | —              |
| StatusPill spent    | `variant="spent"`             | Red pill using `textFatigueHigh` token | —              |
| StatusPill auto     | `variant="auto"`              | Blue-gray pill using `textFaint` token | —              |
| StatusBanner info   | `variant="info"`              | Blue-tinted banner, `role="status"`    | —              |
| StatusBanner warn   | `variant="warn"`              | Amber-tinted banner, `role="alert"`    | —              |
| EmptyState no CTA   | `title`, `body` only          | Renders title + body, no button        | —              |
| EmptyState with CTA | `+ onAction + actionLabel`    | Renders primary button below body      | —              |
| ModalShell          | `title`, `children`, `footer` | Header + scroll body + sticky footer   | —              |

</frozen-after-approval>

## Code Map

- `src/shared/theme.ts` -- token source: `statusSuccess`, `textFatigueHigh`, `textFatigueMed`, `textFaint`, `radii.pill`, `bgSurface`, `borderForm`, `accentPrimary`, `statusWarn`, `bgWarnSurface`
- `src/shared/components/StatusPill/index.tsx` -- **NEW** — `<StatusPill variant="fresh|tired|spent|il|auto">` + optional label override
- `src/shared/components/StatusPill/styles.ts` -- **NEW** — styled pill span with variant color map
- `src/shared/components/StatusBanner/index.tsx` -- **NEW** — `<StatusBanner variant="info|warn|neutral" title? action?>` with ARIA attributes
- `src/shared/components/StatusBanner/styles.ts` -- **NEW** — styled banner with variant background/border map
- `src/shared/components/EmptyState/index.tsx` -- **NEW** — `<EmptyState icon? title body onAction? actionLabel?>`
- `src/shared/components/EmptyState/styles.ts` -- **NEW** — centered layout with icon slot
- `src/shared/components/ModalShell/index.tsx` -- **NEW** — `<ModalShell title onClose children footer?>` — wraps `<dialog>` with header bar + scroll body + sticky footer
- `src/shared/components/ModalShell/styles.ts` -- **NEW** — extracts `Dialog` styled-component from `src/features/exhibition/styles.ts` (same `max-height: min(90dvh, 820px)` desktop / `min(96dvh, 820px)` mobile)
- `src/features/exhibition/styles.ts` -- keep existing `Dialog` (ModalShell is additive, not a replacement in v1)

## Tasks & Acceptance

**Execution:**

- [ ] `src/shared/components/StatusPill/styles.ts` -- CREATE — pill `<span>` styled component; `$variant` drives bg (alpha of variant color), fg (full variant color), border (alpha of variant color); uses `theme.radii.pill`; padding `2px 8px`; `font-size: theme.fontSizes.sm`; `font-weight: 600`
- [ ] `src/shared/components/StatusPill/index.tsx` -- CREATE — `interface StatusPillProps { variant: "fresh" | "tired" | "spent" | "il" | "auto"; label?: string; }` with default labels: fresh="Fresh", tired="Tired", spent="Spent", il="IL", auto="Auto"; renders `<PillSpan $variant={variant}>{label ?? defaultLabels[variant]}</PillSpan>`
- [ ] `src/shared/components/StatusBanner/styles.ts` -- CREATE — `<BannerRoot>` div with `$variant` driving bg/border colors; uses `borderFormAlpha30` as border; bg variants: info=`bgFormAlpha15`, warn=`bgWarnSurface`, neutral=`bgFormAlpha15`; padding `spacing.sm spacing.md`; border-radius `radii.card`; display flex with optional action slot
- [ ] `src/shared/components/StatusBanner/index.tsx` -- CREATE — `interface StatusBannerProps { variant: "info" | "warn" | "neutral"; title?: string; children: React.ReactNode; action?: React.ReactNode; }` — sets `role="alert"` for warn, `role="status"` for info/neutral
- [ ] `src/shared/components/EmptyState/styles.ts` -- CREATE — centered column layout; icon slot 32×32; heading `fontSizes.h2`; body `fontSizes.body` `textHint`; CTA button reusing existing `PrimaryButton` style from `@shared/components/PageLayout/styles`
- [ ] `src/shared/components/EmptyState/index.tsx` -- CREATE — `interface EmptyStateProps { icon?: React.ReactNode; title: string; body: string; onAction?: () => void; actionLabel?: string; }` — renders icon (if provided), title, body, optional CTA button
- [ ] `src/shared/components/ModalShell/styles.ts` -- CREATE — `<ModalDialog>` styled dialog extracted from exhibition styles: `max-height: min(90dvh, 820px)` desktop / `min(96dvh, 820px)` mobile; `<ModalHeader>` flex row with title + close btn; `<ModalBody>` overflow-y auto flex-1; `<ModalFooter>` sticky bottom with border-top
- [ ] `src/shared/components/ModalShell/index.tsx` -- CREATE — `interface ModalShellProps { title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; open?: boolean; }` — wraps native `<dialog>` element; calls `dialogRef.current?.showModal()` / `close()` on `open` prop changes

**Acceptance Criteria:**

- Given `<StatusPill variant="fresh" />`, when rendered, then it shows "Fresh" text in a green-tinted pill using `statusSuccess`-derived colors (no hardcoded hex)
- Given `<StatusPill variant="tired" label="Resting" />`, when rendered, then it shows "Resting" (custom label overrides default)
- Given `<StatusBanner variant="warn">content</StatusBanner>`, when rendered, then it has `role="alert"` on the wrapper element
- Given `<StatusBanner variant="info">content</StatusBanner>`, when rendered, then it has `role="status"` on the wrapper element
- Given `<EmptyState title="No seasons" body="Start one." />`, when rendered, then no button is visible
- Given `<EmptyState title="X" body="Y" onAction={fn} actionLabel="Start" />`, when rendered, then a "Start" button is visible and calls `fn` on click
- Given `yarn typecheck`, then zero new errors introduced
- Given `yarn build`, then build succeeds

## Verification

**Commands:**

- `yarn typecheck` -- expected: zero errors
- `yarn lint` -- expected: zero new warnings
- `yarn build` -- expected: success
- `yarn test src/shared/components` -- expected: all existing tests pass (no regressions)
