import type { PitcherLogEntry } from "../gameLogTypes";
import type { GameAction, State } from "../gameStateTypes";
import { createPitcherLogEntry, pushPitcherLogEntry } from "../pitcherLog";
import type { Handedness, ResolvedPlayerMods, TeamCustomPlayerOverrides } from "../playerTypes";
import { buildResolvedMods } from "../resolvePlayerMods";

/** Computes the defensive slot assignments for a lineup from player overrides. */
const computeLineupPositions = (order: string[], overrides: TeamCustomPlayerOverrides): string[] =>
  order.map((id) => overrides[id]?.position ?? "");

const buildHandednessMap = (overrides: TeamCustomPlayerOverrides): Record<string, Handedness> => {
  const handedness: Record<string, Handedness> = {};
  for (const [id, ov] of Object.entries(overrides)) {
    if (ov.handedness) handedness[id] = ov.handedness;
  }
  return handedness;
};

/**
 * Handles pre-game setup / new-game configuration actions.
 * Returns `undefined` for any action type that is not a setup action,
 * allowing the root reducer to fall through to its own branches.
 */
export const handleSetupAction = (state: State, action: GameAction): State | undefined => {
  switch (action.type) {
    case "setTeams": {
      const p = action.payload as
        | [string, string]
        | {
            teams: [string, string];
            /** Human-readable display names (matched by index). Defaults to `teams` if omitted. */
            teamLabels?: [string, string];
            playerOverrides?: [TeamCustomPlayerOverrides, TeamCustomPlayerOverrides];
            lineupOrder?: [string[], string[]];
            rosterBench?: [string[], string[]];
            rosterPitchers?: [string[], string[]];
            handednessByTeam?: [Record<string, Handedness>, Record<string, Handedness>];
            /** Override the starting pitcher index per team. null = use 0 (default). */
            startingPitcherIdx?: [number | null, number | null];
          };
      if (Array.isArray(p)) {
        return { ...state, teams: p, teamLabels: p };
      }
      let lineupPositions: [string[], string[]] = state.lineupPositions;
      if (p.lineupOrder && p.playerOverrides) {
        const computed: [string[], string[]] = [
          computeLineupPositions(p.lineupOrder[0], p.playerOverrides[0]),
          computeLineupPositions(p.lineupOrder[1], p.playerOverrides[1]),
        ];
        const hasAnyPosition =
          computed[0].some((pos) => pos !== "") || computed[1].some((pos) => pos !== "");
        if (hasAnyPosition) {
          lineupPositions = computed;
        }
      }
      const newPlayerOverrides = p.playerOverrides ?? state.playerOverrides;
      const newResolvedMods: [
        Record<string, ResolvedPlayerMods>,
        Record<string, ResolvedPlayerMods>,
      ] = [buildResolvedMods(newPlayerOverrides[0]), buildResolvedMods(newPlayerOverrides[1])];
      const newHandednessByTeam: [Record<string, Handedness>, Record<string, Handedness>] =
        p.handednessByTeam ??
        (p.playerOverrides
          ? [buildHandednessMap(newPlayerOverrides[0]), buildHandednessMap(newPlayerOverrides[1])]
          : state.handednessByTeam);
      // Apply starting pitcher index per team (clamped to valid range; default 0).
      // When rosterPitchers is provided, always re-initialize the index so stale state
      // (e.g., from a previous game) doesn't bleed through if startingPitcherIdx is omitted.
      let newActivePitcherIdx: [number, number] = state.activePitcherIdx;
      if (p.rosterPitchers) {
        const clampIdx = (idx: number | null | undefined, pitchers: string[]) => {
          if (idx === null || idx === undefined) return 0;
          return idx >= 0 && idx < pitchers.length ? idx : 0;
        };
        newActivePitcherIdx = [
          clampIdx(p.startingPitcherIdx?.[0], p.rosterPitchers[0]),
          clampIdx(p.startingPitcherIdx?.[1], p.rosterPitchers[1]),
        ];
      } else if (p.startingPitcherIdx && state.rosterPitchers) {
        // startingPitcherIdx provided but rosterPitchers not — apply against existing roster.
        const clampIdx = (idx: number | null | undefined, pitchers: string[]) => {
          if (idx === null || idx === undefined) return 0;
          return idx >= 0 && idx < pitchers.length ? idx : 0;
        };
        newActivePitcherIdx = [
          clampIdx(p.startingPitcherIdx[0], state.rosterPitchers[0]),
          clampIdx(p.startingPitcherIdx[1], state.rosterPitchers[1]),
        ];
      }
      // Compute pitcher log initial entries for each team when pitchers are provided.
      // When rosterPitchers is provided in the payload, always start fresh so repeated
      // setTeams dispatches (e.g. changing starting pitcher selection) don't accumulate
      // duplicate entries.
      // When rosterPitchers is absent from the payload, fall back to state.rosterPitchers
      // if it has entries (e.g. a subsequent setTeams that only updates labels/overrides
      // while keeping the same roster). If neither has entries, preserve the existing log.
      const effectivePitchers: [string[], string[]] | undefined = p.rosterPitchers
        ? p.rosterPitchers
        : state.rosterPitchers?.[0]?.length || state.rosterPitchers?.[1]?.length
          ? state.rosterPitchers
          : undefined;
      let newPitcherGameLog: [PitcherLogEntry[], PitcherLogEntry[]] = effectivePitchers
        ? [[], []]
        : (state.pitcherGameLog ?? [[], []]);
      if (effectivePitchers) {
        // Initialize pitcher log for each team's starting pitcher.
        for (const teamIdx of [0, 1] as const) {
          const pitchers = effectivePitchers[teamIdx];
          if (pitchers.length === 0) continue;
          // Use the already-clamped activePitcherIdx to avoid any mismatch when
          // startingPitcherIdx is omitted from the payload.
          const startingIdx = newActivePitcherIdx[teamIdx];
          const pitcherId = pitchers[startingIdx];
          // Build a temporary state snapshot for the entry (score/inning at setup time).
          // Override atBat so halfEntered reflects the correct pitching half:
          //   away pitchers (teamIdx=0) pitch when home bats (atBat=1);
          //   home pitchers (teamIdx=1) pitch when away bats (atBat=0).
          const tempState: State = {
            ...state,
            rosterPitchers: effectivePitchers,
            activePitcherIdx: newActivePitcherIdx,
            atBat: (teamIdx === 0 ? 1 : 0) as 0 | 1,
          };
          const entry = createPitcherLogEntry(teamIdx, pitcherId, tempState);
          newPitcherGameLog = pushPitcherLogEntry(newPitcherGameLog, teamIdx, entry);
        }
      }
      return {
        ...state,
        teams: p.teams,
        teamLabels: p.teamLabels ?? p.teams,
        ...(p.playerOverrides ? { playerOverrides: p.playerOverrides } : {}),
        ...(p.lineupOrder ? { lineupOrder: p.lineupOrder } : {}),
        ...(p.rosterBench ? { rosterBench: p.rosterBench } : {}),
        ...(p.rosterPitchers ? { rosterPitchers: p.rosterPitchers } : {}),
        activePitcherIdx: newActivePitcherIdx,
        lineupPositions,
        resolvedMods: newResolvedMods,
        handednessByTeam: newHandednessByTeam,
        pitcherGameLog: newPitcherGameLog,
      };
    }
    default:
      return undefined;
  }
};
