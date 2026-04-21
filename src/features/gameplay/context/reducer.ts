/// <reference types="vite/client" />
import type { DecisionType } from "./decisionTypes";
import type { GameAction, State } from "./gameStateTypes";
import {
  buildHandednessMatchup,
  getHandednessOutcomeModifiers,
  resolvePitcherHandedness,
  resolvePlayerHandedness,
} from "./handednessMatchup";
import { handleDecisionsAction } from "./handlers/decisions";
import { handleLifecycleAction } from "./handlers/lifecycle";
import { handleSetupAction } from "./handlers/setup";
import { handleSimAction } from "./handlers/sim";
import { warnIfImpossible } from "./invariants";
import type { LogAction } from "./logReducer";
import type { ManagerDecisionValues } from "./managerDecisionValues";
import { DEFAULT_MANAGER_DECISION_VALUES } from "./managerDecisionValues";
import { computeBatterFatigueFactor } from "./pitchSimulation";
import type { Strategy } from "./playerTypes";
import { PINCH_HITTER_CONTACT_WEIGHT, PINCH_HITTER_POWER_WEIGHT } from "./playerTypes";
import { applyHandlersInOrder } from "./reducerHelpers";
import { ZERO_MODS } from "./resolvePlayerMods";
import { stratMod } from "./strategy";

// Re-export stratMod so existing consumers (e.g. tests) can import from this module.
export { stratMod } from "./strategy";

/**
 * Returns true for actions that must be processed even when the game is over.
 *
 * Lifecycle actions (restore_game, reset) and team setup always pass through
 * so that players can load a new save, start a fresh game, or re-configure
 * teams on the post-game screen.  Pure gameplay actions (pitch simulation,
 * manager decisions, etc.) remain blocked to prevent state corruption.
 */
export const canProcessActionAfterGameOver = (action: GameAction): boolean =>
  ["setTeams", "reset", "restore_game"].includes(action.type);

const createLogger = (dispatchLogger: (action: LogAction) => void) => (message: string) => {
  dispatchLogger({ type: "log", payload: message });
};

const computeStealSuccessPct = (base: 0 | 1, strategy: Strategy, state: State): number => {
  const base_pct = base === 0 ? 70 : 60;
  const runnerId = state.baseRunnerIds?.[base] ?? null;
  const runnerSpeedMod = runnerId
    ? (state.resolvedMods?.[state.atBat as 0 | 1]?.[runnerId] ?? ZERO_MODS).speedMod
    : 0;
  // speedMod: +20 → 10% better steal odds; -20 → 10% worse
  const speedFactor = 1 + runnerSpeedMod / 200;
  return Math.round(base_pct * stratMod(strategy, "steal") * speedFactor);
};

/**
 * Evaluates the current game state to determine if a manager decision should
 * be offered (human manager) or processed (AI manager).
 *
 * Decision detection order (earlier branches take priority):
 *   1. IBB / steal (with possible ibb_or_steal hybrid — see note below)
 *   2. Pinch hitter (start-of-at-bat, 0-0 count only)
 *   3. Sacrifice bunt
 *   4. Count hints (count30, count02)
 *
 * Note on ibb_or_steal: this kind is structurally unreachable. IBB requires
 * outs === 2 while steal requires outs < 2, so both conditions can never be
 * satisfied simultaneously. The type is retained for type completeness.
 *
 * @param decisionValues - Optional runtime tuning values. Defaults to
 *   DEFAULT_MANAGER_DECISION_VALUES so existing callers are unaffected.
 *
 * @internal-ai-caller
 *   The default `stealMinOfferPct` (and the `stealMinOfferPct` field in
 *   general) is the threshold at which the **human manager** is prompted —
 *   it is intentionally higher than the AI's own steal gate. AI callers
 *   (e.g. usePitchDispatch on the unmanaged team) must override
 *   `stealMinOfferPct` with `decisionValues.aiStealThreshold` before
 *   calling `detectDecision`; relying on the default would gate AI steals
 *   at the human-prompt threshold and silently change AI behavior.
 */
export const detectDecision = (
  state: State,
  strategy: Strategy,
  managerMode: boolean,
  decisionValues: ManagerDecisionValues = DEFAULT_MANAGER_DECISION_VALUES,
): DecisionType | null => {
  if (!managerMode) return null;
  if (state.gameOver) return null;
  if (state.suppressNextDecision) return null;

  const { baseLayout, outs, balls, strikes } = state;
  const scoreDiff = Math.abs(state.score[0] - state.score[1]);
  // Signed run differential from the *batting* team's perspective:
  // negative = batting team trailing, 0 = tied, positive = batting team leading.
  // Used to gate tactics that only make sense when the batting team is not
  // ahead (sacrifice bunt) or when the defense is not far behind (IBB).
  const scoreDiffForBattingTeam =
    state.atBat === 0 ? state.score[0] - state.score[1] : state.score[1] - state.score[0];

  const ibbAvailable =
    decisionValues.ibbEnabled &&
    !baseLayout[0] &&
    (baseLayout[1] || baseLayout[2]) &&
    outs === 2 &&
    state.inning >= 7 &&
    scoreDiff <= 2 &&
    // Defense should not be down by more than 1 — issuing a free baserunner
    // when already trailing by 2+ stacks bad outcomes against you.
    scoreDiffForBattingTeam <= 1;

  let stealDecision: { kind: "steal"; base: 0 | 1; successPct: number } | null = null;
  if (decisionValues.stealEnabled && outs < 2) {
    if (baseLayout[0] && !baseLayout[1]) {
      const pct = computeStealSuccessPct(0, strategy, state);
      if (pct > decisionValues.stealMinOfferPct)
        stealDecision = { kind: "steal", base: 0, successPct: pct };
    }
    if (!stealDecision && baseLayout[1] && !baseLayout[2]) {
      const pct = computeStealSuccessPct(1, strategy, state);
      if (pct > decisionValues.stealMinOfferPct)
        stealDecision = { kind: "steal", base: 1, successPct: pct };
    }
  }

  if (ibbAvailable && stealDecision) {
    return { kind: "ibb_or_steal", base: stealDecision.base, successPct: stealDecision.successPct };
  }
  if (ibbAvailable) return { kind: "ibb" };
  if (stealDecision) return stealDecision;

  // pinch_hitter is checked before bunt: it's a start-of-at-bat decision (0-0 count only)
  // and runners on 2nd/3rd would otherwise always hit the bunt branch first.
  if (
    decisionValues.pinchHitterEnabled &&
    state.inning >= 7 &&
    outs < 2 &&
    (baseLayout[1] || baseLayout[2]) &&
    !state.pinchHitterStrategy &&
    balls === 0 &&
    strikes === 0
  ) {
    const teamIdx = state.atBat as 0 | 1;
    const lineupIdx = (state.batterIndex ?? [0, 0])[teamIdx];
    const subOut = (state.substitutedOut ?? [[], []])[teamIdx];
    const teamMods = state.resolvedMods?.[teamIdx] ?? {};

    const pitchingTeam = (1 - (state.atBat as number)) as 0 | 1;
    const activePitcherId =
      state.rosterPitchers?.[pitchingTeam]?.[(state.activePitcherIdx ?? [0, 0])[pitchingTeam]];
    const pitcherHandedness = activePitcherId
      ? resolvePitcherHandedness(
          state.handednessByTeam[pitchingTeam]?.[activePitcherId],
          activePitcherId,
        )
      : "R";

    const currentBatterId = state.lineupOrder[teamIdx]?.[lineupIdx];
    const plateAppearancesByTeam = (state.batterPlateAppearances ?? [{}, {}])[teamIdx] ?? {};
    const currentBatterPa = currentBatterId ? (plateAppearancesByTeam[currentBatterId] ?? 0) : 0;
    const currentBatterStaminaMod = currentBatterId
      ? (teamMods[currentBatterId]?.staminaMod ?? 0)
      : 0;
    const currentBatterFatigue = computeBatterFatigueFactor(
      currentBatterPa,
      currentBatterStaminaMod,
    );
    const currentBatterMatchupDeltaPct = currentBatterId
      ? getHandednessOutcomeModifiers(
          buildHandednessMatchup(
            resolvePlayerHandedness(
              state.handednessByTeam[teamIdx]?.[currentBatterId],
              currentBatterId,
            ),
            pitcherHandedness,
          ),
        ).promptDeltaPct
      : 0;

    const candidates = (state.rosterBench[teamIdx] ?? [])
      .filter((id) => !subOut.includes(id))
      .map((id) => {
        const batterHandedness = resolvePlayerHandedness(state.handednessByTeam[teamIdx]?.[id], id);
        const matchupDeltaPct = getHandednessOutcomeModifiers(
          buildHandednessMatchup(batterHandedness, pitcherHandedness),
        ).promptDeltaPct;
        const plateAppearances = plateAppearancesByTeam[id] ?? 0;
        const staminaMod = teamMods[id]?.staminaMod ?? 0;
        const fatigue = computeBatterFatigueFactor(plateAppearances, staminaMod);
        const effectiveContactMod = (teamMods[id]?.contactMod ?? 0) - fatigue.contactPenalty;
        const effectivePowerMod = (teamMods[id]?.powerMod ?? 0) - fatigue.powerPenalty;
        return {
          id,
          name: state.playerOverrides[teamIdx]?.[id]?.nickname ?? id.slice(0, 8),
          position: state.playerOverrides[teamIdx]?.[id]?.position,
          handedness: batterHandedness,
          contactMod: teamMods[id]?.contactMod ?? 0,
          powerMod: teamMods[id]?.powerMod ?? 0,
          plateAppearances,
          fatigueContactPenalty: fatigue.contactPenalty,
          fatiguePowerPenalty: fatigue.powerPenalty,
          effectiveContactMod,
          effectivePowerMod,
          matchupDeltaPct,
        };
      })
      .sort(
        (a, b) =>
          (b.effectiveContactMod ?? b.contactMod) * PINCH_HITTER_CONTACT_WEIGHT +
          (b.effectivePowerMod ?? b.powerMod) * PINCH_HITTER_POWER_WEIGHT +
          (b.matchupDeltaPct ?? 0) -
          ((a.effectiveContactMod ?? a.contactMod) * PINCH_HITTER_CONTACT_WEIGHT +
            (a.effectivePowerMod ?? a.powerMod) * PINCH_HITTER_POWER_WEIGHT +
            (a.matchupDeltaPct ?? 0)),
      );
    return {
      kind: "pinch_hitter",
      candidates,
      teamIdx,
      lineupIdx,
      pitcherHandedness,
      currentBatterMatchupDeltaPct,
      currentBatterPlateAppearances: currentBatterPa,
      currentBatterFatigueContactPenalty: currentBatterFatigue.contactPenalty,
      currentBatterFatiguePowerPenalty: currentBatterFatigue.powerPenalty,
    };
  }

  // Sacrifice bunt: requires situational context to avoid offering in clearly
  // non-bunt situations (e.g. inning 1 up by 4 runs, or any inning when leading).
  // The human prompt is offered when tied or trailing by 1–2 runs in inning ≥ 6
  // (one inning earlier than the AI's inning ≥ 7 trigger, for managerial
  // flexibility). Bunting while leading is omitted because giving up an out
  // for a one-base advance reduces win expectancy when already ahead.
  // With 1 out the bunt is only offered when there is already a runner in
  // scoring position (2nd base), where the advance has clearest run value.
  if (
    decisionValues.buntEnabled &&
    outs < 2 &&
    (outs === 0 || baseLayout[1]) &&
    (baseLayout[0] || baseLayout[1]) &&
    strikes < 2 &&
    balls <= 1 &&
    state.inning >= 6 &&
    scoreDiffForBattingTeam <= 0 &&
    scoreDiffForBattingTeam >= -2
  ) {
    return { kind: "bunt" };
  }

  if (balls === 3 && strikes === 0) return { kind: "count30" };
  if (balls === 0 && strikes === 2) return { kind: "count02" };
  return null;
};

const reducer = (dispatchLogger: (action: LogAction) => void) => {
  const log = createLogger(dispatchLogger);

  function apply(state: State, action: GameAction): State {
    if (state.gameOver && !canProcessActionAfterGameOver(action)) {
      return state;
    }

    // Handler precedence is intentional: sim actions are most common and checked
    // first; lifecycle (reset/restore) second; manager decisions third; setup last.
    return applyHandlersInOrder(state, action, [
      (s, a) => handleSimAction(s, a, { log }),
      handleLifecycleAction,
      (s, a) => handleDecisionsAction(s, a, { log }),
      handleSetupAction,
    ]);
  }

  return function reducer(state: State, action: GameAction): State {
    const next = apply(state, action);
    if (import.meta.env.DEV) warnIfImpossible(next, { pitchKey: next.pitchKey ?? 0 });
    return next;
  };
};

export default reducer;
