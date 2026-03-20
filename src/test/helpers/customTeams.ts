import { generatePlayerId, generateTeamId } from "@storage/generateId";
import type { TeamPlayer, TeamWithRoster } from "@storage/types";

/**
 * Creates a minimal `TeamPlayer` for unit tests with optional field overrides.
 * The generated `id` is random so each call produces a distinct player.
 *
 * This is an intentionally minimal fixture — it is **not** required to pass store
 * validation. Use it directly when testing logic that only needs a `TeamPlayer`
 * shape; use `makeCustomTeamStore` + `createCustomTeam` when you need a fully
 * store-validated player with `sanitizePlayer` enforced.
 *
 * Default stats (50 / 50 / 50) are within the valid range and satisfy the
 * HITTER_STAT_CAP (contact + power + speed ≤ 150).
 */
export const makePlayer = (overrides: Partial<TeamPlayer> = {}): TeamPlayer => ({
  id: generatePlayerId(),
  name: "Alice",
  role: "batter",
  batting: { contact: 50, power: 50, speed: 50, stamina: 50 },
  position: "CF",
  handedness: "R",
  ...overrides,
});

/**
 * Creates a minimal `TeamWithRoster` for unit tests with optional field overrides.
 * The generated `id` is random so each call produces a distinct team.
 *
 * This is an intentionally minimal fixture — it contains one lineup player and no
 * pitchers, which would fail store validation but is sufficient for tests that only
 * need a `TeamWithRoster` shape (export/import, fingerprint, prescan, etc.).
 * Use `makeCustomTeamStore` + `createCustomTeam` when you need a fully validated
 * team with `buildRoster`/`sanitizePlayer` enforced.
 */
export const makeTeam = (overrides: Partial<TeamWithRoster> = {}): TeamWithRoster => ({
  id: generateTeamId(),
  schemaVersion: 1,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
  name: "Test Team",
  nameLowercase: "test team",
  roster: {
    schemaVersion: 1,
    lineup: [makePlayer({ name: "Alice" })],
    bench: [],
    pitchers: [],
  },
  metadata: { archived: false },
  ...overrides,
});
