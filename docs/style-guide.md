# BlipIt Legends UI Style Guide

This document is the visual source of truth for BlipIt Legends.

- Theme source: `src/shared/theme.ts`
- Type binding: `src/styled.d.ts`
- Breakpoint helpers: `src/shared/utils/mediaQueries.ts`
- Last audited: 2026-05-11 (Sprint 1, Story 1.2)

## Sprint 1 audited contrast tokens (F6 Tier 1)

These are the high-impact contrast tokens tracked in Sprint 1.
This list is updated incrementally as additional contrast tiers are audited in later sprints.

- `theme.colors.textHint` (`#6e88b1`) — audited in Sprint 1
- `theme.colors.textNavFaint` (`#5f7694`) — audited in Sprint 1
- `theme.colors.textScoreDim` (`#8fa6bf`) — audited in Sprint 1
- `theme.colors.textScore` (`#e8d5a3`) — scoreboard numerics tracked in Sprint 1
- `theme.colors.textScoreHeader` (`#8abadf`) — scoreboard heading contrast tracked in Sprint 1

Previous pre-audit values for these three tokens were darker and failed the Sprint 1 WCAG
targets; they were replaced for compliance.

## Core rules

1. Use theme tokens only (`${({ theme }) => theme.*}`).
2. Do not hardcode colors or font sizes in feature styles.
3. Use `mq` helpers only; do not write raw `@media` queries.
4. Use `dvh` for viewport-constrained modal height.
5. For non-HTML styled props, use transient `$prop` names.

## Breakpoints

From `@shared/utils/mediaQueries`:

- `mq.mobile` — `max-width: 768px`
- `mq.tablet` — `769px` to `1023px`
- `mq.desktop` — `min-width: 1024px`
- `mq.notMobile` — `min-width: 769px`
- `mq.shortNotMobile` — short, non-mobile viewport compaction

## Color tokens

Use tokens by semantic role, not by hex.

### Surfaces

| Token                    | Value     | Typical use                |
| ------------------------ | --------- | -------------------------- |
| `theme.colors.bgVoid`    | `#000000` | App shell/background       |
| `theme.colors.bgSurface` | `#0F1E34` | Cards, panels, dialogs     |
| `theme.colors.bgInput`   | `#1C2E4A` | Text input fields          |
| `theme.colors.bgInputSm` | `#1a2440` | Compact controls           |
| `theme.colors.bgGame`    | `#0a1628` | Line score and game panels |
| `theme.colors.bgDeep`    | `#0a0a1a` | Deep background sections   |

### Borders

| Token                       | Value     |
| --------------------------- | --------- |
| `theme.colors.borderPanel`  | `#2a3a5a` |
| `theme.colors.borderCard`   | `#2a3f60` |
| `theme.colors.borderForm`   | `#4a6090` |
| `theme.colors.borderSubtle` | `#2a2a3a` |
| `theme.colors.borderDark`   | `#1e3050` |
| `theme.colors.borderAccent` | `#994200` |
| `theme.colors.borderDanger` | `#883333` |

### Text

| Token                            | Value     | Typical use                  |
| -------------------------------- | --------- | ---------------------------- |
| `theme.colors.textPrimary`       | `#ffffff` | Headings and primary text    |
| `theme.colors.textBody`          | `#cce0ff` | Body copy                    |
| `theme.colors.textDialog`        | `#e0f0ff` | Dialog content               |
| `theme.colors.textMuted`         | `#BFC7CF` | Secondary copy               |
| `theme.colors.textDimmer`        | `#6B7785` | Quiet metadata               |
| `theme.colors.textHint`          | `#6e88b1` | Labels/hints                 |
| `theme.colors.textLink`          | `#aaccff` | Link and CTA secondary text  |
| `theme.colors.textSecondaryLink` | `#88bbee` | Secondary interactive labels |
| `theme.colors.textScore`         | `#e8d5a3` | Score numerics               |
| `theme.colors.textScoreHeader`   | `#8abadf` | Scoreboard headers           |
| `theme.colors.textScoreDim`      | `#8fa6bf` | Dim scoreboard text          |
| `theme.colors.textNavFaint`      | `#5f7694` | Faint nav copy               |

### Accent and status

| Token                         | Value     |
| ----------------------------- | --------- |
| `theme.colors.accentPrimary`  | `#FF9A1F` |
| `theme.colors.accentBright`   | `#F2C14E` |
| `theme.colors.btnPrimaryText` | `#0b1a38` |
| `theme.colors.statusSuccess`  | `#4ade80` |
| `theme.colors.statusWarn`     | `#FF9A1F` |
| `theme.colors.textDanger`     | `#ff7070` |
| `theme.colors.bgDanger`       | `#b30000` |

## Typography tokens

### Fonts

| Token               | Purpose                |
| ------------------- | ---------------------- |
| `theme.fonts.sans`  | Primary UI typeface    |
| `theme.fonts.mono`  | Numeric/stat alignment |
| `theme.fonts.score` | Line-score display     |

### Font sizes

Use token names instead of raw sizes.

- UI micro/label: `xs`, `sm`, `label`, `base`, `md`, `lg`, `display`, `xl`
- UI headings: `dialogTitle`, `f20`
- Body scale: `tiny`, `sub`, `subLg`, `body`, `bodyLg`, `bodyXl`
- Heading scale: `h3`, `xxl`, `h2`, `heading`, `h1`, `displaySm`, `displayMd`, `title`, `logo`

### Letter spacing

| Token                        |
| ---------------------------- |
| `theme.letterSpacing.tight`  |
| `theme.letterSpacing.normal` |
| `theme.letterSpacing.wide`   |
| `theme.letterSpacing.wider`  |
| `theme.letterSpacing.widest` |

## Sizing, spacing, and radii tokens

### Interaction sizes

| Token                 | Value  |
| --------------------- | ------ |
| `theme.sizes.inputSm` | `30px` |
| `theme.sizes.inputMd` | `32px` |
| `theme.sizes.inputLg` | `36px` |
| `theme.sizes.btnLg`   | `44px` |
| `theme.sizes.btnXl`   | `48px` |
| `theme.sizes.btnXxl`  | `52px` |
| `theme.sizes.icon`    | `25px` |

### Border radii

Use `theme.radii.*` (`xxs`, `s3`, `sm`, `md`, `lg`, `xl`, `card`, `dialog`, `pill`, `full`).

### Spacing

Use `theme.spacing.*` values (`xxs` through `s48`) instead of raw px values.

## Component patterns

### Buttons

- Primary CTA: use `theme.colors.btnPrimaryBg` + `theme.colors.accentPrimary`.
- Secondary/quiet: use tokenized border/background from component style files.
- Danger actions: use `theme.colors.dangerText` + `theme.colors.borderDanger`.
- Focus state: use tokenized focus outlines (typically `accentPrimary`).

### Form elements

- Inputs/selects use `bgInput` or `bgInputSm`.
- Borders use `borderForm`.
- Text uses `textPrimary`/`textBody`.
- Placeholders and hints use `textHint` or `textMuted`.

### Modals and dialogs

- Surfaces use `bgSurface`.
- Borders use `borderForm` or `borderCard`.
- Backdrop uses overlay tokens (`overlayDark`, `overlayMedDark`, `overlayLight`).
- Height-constrained dialogs use `dvh`.

### Cards/panels

- Card background: `bgSurface`.
- Card border: `borderCard` or `borderPanel`.
- Subtle separators: `borderSubtle` / `borderDark`.

### Game surfaces

- Scoreboard and line score: `bgGame`, `textScore`, `textScoreHeader`, `textScoreDim`.
- BSO colors: `bsoBall`, `bsoStrike`, `bsoOut`.
- Decision panels: `bgDecisionOverlay`, `bgDecisionSection`, `bgDecisionButton`.

## Verification checklist for UI changes

Before merging UI/token changes:

- [ ] No hardcoded visual hex/color literals were added in feature styles.
- [ ] New spacing/sizing uses `theme.spacing`, `theme.sizes`, `theme.radii`.
- [ ] Responsive changes use `mq` helpers only.
- [ ] Modal sizing uses `dvh` where viewport constrained.
- [ ] Any touched contrast-sensitive token updates are reflected in this guide.
