# Story 3.1 — F6 Tier 1 Contrast Evidence

Generated on 2026-05-11 after Sprint 1 token updates in `src/shared/theme.ts`.

## Updated tokens

- `textHint`: `#6e88b1`
- `textNavFaint`: `#5f7694`
- `textScoreDim`: `#8fa6bf`

## Measured ratios

| Foreground token  | Background              |   Ratio | Target | Status |
| ----------------- | ----------------------- | ------: | -----: | ------ |
| `textHint`        | `#0d1b2e`               |  4.80:1 |  4.5:1 | ✅     |
| `textHint`        | `bgSurface` (`#0F1E34`) |  4.63:1 |  4.5:1 | ✅     |
| `textNavFaint`    | `bgVoid` (`#000000`)    |  4.51:1 |  4.5:1 | ✅     |
| `textScoreDim`    | `bgGame` (`#0a1628`)    |  7.23:1 |  7.0:1 | ✅     |
| `textScore`       | `bgGame` (`#0a1628`)    | 12.50:1 |  7.0:1 | ✅     |
| `textScoreHeader` | `bgGame` (`#0a1628`)    |  8.78:1 |  4.5:1 | ✅     |

## Guard tests

- `src/shared/theme.contrast.test.ts` enforces the Sprint 1 thresholds in CI.
