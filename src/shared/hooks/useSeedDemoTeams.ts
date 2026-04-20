import * as React from "react";

import { DEMO_TEAMS, type DemoPlayerDef } from "@feat/customTeams/generation/demoTeams";
import { DEFAULT_PITCHING_STAMINA } from "@feat/customTeams/storage/customTeamSanitizers";
import { CustomTeamStore } from "@feat/customTeams/storage/customTeamStore";
import { appLog } from "@shared/utils/logger";

import { generatePlayerId } from "@storage/generateId";
import type { TeamPlayer } from "@storage/types";

/**
 * localStorage key used to record that demo teams have been seeded (or should
 * be skipped) in this browser context.  Set after a successful first-launch
 * seed, and pre-populated by E2E test helpers so test contexts never receive
 * the demo teams.
 */
export const DEMO_SEED_DONE_KEY = "ballgame:demoSeedDone";

/** Map a demo player definition to a TeamPlayer ready for store insertion. */
function mapDemoPlayer(p: DemoPlayerDef): TeamPlayer {
  if (p.role === "pitcher") {
    return {
      id: generatePlayerId(),
      name: p.name,
      role: "pitcher",
      pitching: p.pitching ?? {
        velocity: 50,
        control: 50,
        movement: 50,
        stamina: DEFAULT_PITCHING_STAMINA,
      },
      position: p.position,
      handedness: p.handedness,
      ...(p.pitchingRole !== undefined && { pitchingRole: p.pitchingRole }),
    };
  }

  return {
    id: generatePlayerId(),
    name: p.name,
    role: "batter",
    batting: p.batting ?? { contact: 50, power: 50, speed: 50, stamina: 50 },
    position: p.position,
    handedness: p.handedness,
  };
}

async function seedIfEmpty(): Promise<void> {
  // Skip if already seeded (or suppressed by the test helper).  The flag
  // persists within the same browser context so refreshing the page after the
  // first launch is a no-op.
  try {
    if (localStorage.getItem(DEMO_SEED_DONE_KEY)) return;
  } catch {
    // localStorage unavailable (e.g. private browsing with storage blocked) — treat
    // this as "no done-flag set" and continue to the DB emptiness check so
    // first-launch users still get the demo teams when IndexedDB is available.
  }

  // includeArchived: true so installs with only archived teams are not
  // mistakenly treated as "empty" and seeded again.
  const existing = await CustomTeamStore.listCustomTeams({
    withRoster: false,
    includeArchived: true,
  });

  if (existing.length > 0) {
    // Teams already exist — mark as done so we never check again.
    try {
      localStorage.setItem(DEMO_SEED_DONE_KEY, "1");
    } catch {
      /* ignore */
    }
    return;
  }

  let anyInserted = false;
  let lastError: unknown = null;

  for (const def of DEMO_TEAMS) {
    try {
      await CustomTeamStore.createCustomTeam(
        {
          name: def.name,
          city: def.city,
          abbreviation: def.abbreviation,
          roster: {
            lineup: def.lineup.map(mapDemoPlayer),
            bench: def.bench.map(mapDemoPlayer),
            pitchers: def.pitchers.map(mapDemoPlayer),
          },
        },
        // Deterministic ID so a concurrent tab's attempt to insert the same
        // team produces a predictable RxDB duplicate-primary-key error rather
        // than silently creating two teams with the same name.  The per-team
        // try/catch below handles that error as a graceful skip.
        { id: def.demoId },
      );
      anyInserted = true;
    } catch (err) {
      // Another tab may have already inserted this team during the same
      // first-launch. Treat any per-team failure as a graceful skip so the
      // remaining teams still get inserted.
      appLog.warn(`useSeedDemoTeams: skipped "${def.name}" (already exists or DB error)`, err);
      lastError = err;
    }
  }

  // Only mark seeding as done when at least one team was freshly inserted.
  // If every insert failed (all duplicate-key = concurrent tab already seeded,
  // or a transient DB error), skip setting the flag so the next mount can
  // either find the teams via listCustomTeams (concurrent-tab case) or retry
  // the inserts (transient-error case).  Each individual error is already
  // logged by appLog.warn in the loop above.  Rethrowing clears _seedPromise
  // so the next getSeedPromise() call re-runs seedIfEmpty.
  if (anyInserted) {
    try {
      localStorage.setItem(DEMO_SEED_DONE_KEY, "1");
    } catch {
      /* ignore */
    }
  } else if (lastError !== null) {
    throw lastError;
  }
}

/**
 * Module-level in-flight promise — prevents duplicate seeding attempts even
 * when React strict-mode or concurrent rendering mounts RootLayout more than
 * once in the same page load. On rejection the promise is cleared so a
 * subsequent mount can retry the seeding.
 */
let _seedPromise: Promise<void> | null = null;

function getSeedPromise(): Promise<void> {
  if (_seedPromise) return _seedPromise;

  _seedPromise = seedIfEmpty().catch((err) => {
    // Clear so the next mount can attempt a retry after a transient failure.
    _seedPromise = null;
    appLog.warn("useSeedDemoTeams: failed to seed demo teams", err);
  });

  return _seedPromise;
}

/**
 * Seeds the demo teams from `DEMO_TEAMS` into the custom-teams collection the
 * first time a brand-new user opens the app (empty IndexedDB). Subsequent calls
 * within the same page load return the same in-flight promise so seeding runs at
 * most once, and the DB count check ensures nothing is written when teams already
 * exist. On a transient failure the promise is cleared so the next mount can
 * retry.
 *
 * E2E test helpers suppress seeding by setting the `DEMO_SEED_DONE_KEY`
 * localStorage key via `page.addInitScript` before the page loads, so test
 * contexts always start with an empty teams collection.
 */
export function useSeedDemoTeams(): void {
  React.useEffect(() => {
    getSeedPromise();
  }, []);
}
