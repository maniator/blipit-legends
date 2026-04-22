/**
 * Custom error types for the custom team storage layer.
 */

/**
 * Thrown when a write is attempted on a team that is currently enrolled in an
 * active league season. Use a sanctioned write context to bypass this guard.
 */
export class CustomTeamLockedError extends Error {
  constructor(teamId: string) {
    super(
      `Team ${teamId} is locked (in an active season). Use a sanctioned write path.`,
    );
    this.name = "CustomTeamLockedError";
  }
}
