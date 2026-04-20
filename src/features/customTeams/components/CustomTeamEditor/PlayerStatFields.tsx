import * as React from "react";

import {
  DEFAULT_BATTING_STAMINA,
  DEFAULT_PITCHING_STAMINA,
} from "@feat/customTeams/storage/customTeamSanitizers";

import type { EditorPlayer, EditorPlayerPatch } from "./editorState";
import {
  HITTER_STAT_CAP,
  hitterRemaining,
  hitterStatTotal,
  PITCHER_STAT_CAP,
  pitcherRemaining,
  pitcherStatTotal,
} from "./statBudget";
import {
  IdentityLockHint,
  StatBudgetRow,
  StatInput,
  StatLabel,
  StatRow,
  StatsGrid,
  StatValue,
} from "./styles";

type Props = {
  player: EditorPlayer;
  /** When true, stat sliders are disabled — stats are immutable after player creation. */
  isExistingPlayer?: boolean;
  onChange: (patch: EditorPlayerPatch) => void;
};

const PlayerStatFields: React.FunctionComponent<Props> = ({
  player,
  isExistingPlayer = false,
  onChange,
}) => {
  const isPitcher = player.role === "pitcher";
  const asPitcher = player.role === "pitcher" ? player : null;
  const asBatter = player.role === "batter" ? player : null;

  const vel = asPitcher?.velocity ?? 0;
  const ctrl = asPitcher?.control ?? 0;
  const mov = asPitcher?.movement ?? 0;
  const pitcherTotal = pitcherStatTotal(vel, ctrl, mov);
  const pitcherRem = pitcherRemaining(vel, ctrl, mov);
  const pitcherOverCap = pitcherRem < 0;

  const hitterTotal = hitterStatTotal(
    asBatter?.contact ?? 0,
    asBatter?.power ?? 0,
    asBatter?.speed ?? 0,
  );
  const hitterRem = hitterRemaining(
    asBatter?.contact ?? 0,
    asBatter?.power ?? 0,
    asBatter?.speed ?? 0,
  );
  const hitterOverCap = hitterRem < 0;

  const overCap = isPitcher ? pitcherOverCap : hitterOverCap;
  const total = isPitcher ? pitcherTotal : hitterTotal;
  const rem = isPitcher ? pitcherRem : hitterRem;
  const cap = isPitcher ? PITCHER_STAT_CAP : HITTER_STAT_CAP;
  const shouldShowOverCapWarning = !isExistingPlayer && overCap;

  const statRow = (
    label: string,
    val: number,
    htmlFor: string,
    toPatch: (n: number) => EditorPlayerPatch,
  ) => (
    <StatRow key={`stat-${htmlFor}`} $locked={isExistingPlayer}>
      <StatLabel htmlFor={htmlFor}>{label}</StatLabel>
      <StatInput
        id={htmlFor}
        type="range"
        min={0}
        max={100}
        value={val}
        disabled={isExistingPlayer}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          // Guard in addition to `disabled` — jsdom fires change events on disabled
          // elements via fireEvent, so the explicit check keeps tests meaningful.
          if (!isExistingPlayer) onChange(toPatch(Number(e.target.value)));
        }}
      />
      <StatValue>{val}</StatValue>
    </StatRow>
  );

  return (
    <>
      <StatsGrid>
        {isPitcher ? (
          <>
            {statRow("Velocity", vel, `velocity-${player.id}`, (n) => ({ velocity: n }))}
            {statRow("Control", ctrl, `control-${player.id}`, (n) => ({ control: n }))}
            {statRow("Movement", mov, `movement-${player.id}`, (n) => ({ movement: n }))}
          </>
        ) : (
          <>
            {statRow("Contact", asBatter?.contact ?? 0, `contact-${player.id}`, (n) => ({
              contact: n,
            }))}
            {statRow("Power", asBatter?.power ?? 0, `power-${player.id}`, (n) => ({ power: n }))}
            {statRow("Speed", asBatter?.speed ?? 0, `speed-${player.id}`, (n) => ({ speed: n }))}
          </>
        )}
      </StatsGrid>
      <StatBudgetRow $overCap={shouldShowOverCapWarning}>
        {shouldShowOverCapWarning
          ? `⚠ ${total} / ${cap} — ${Math.abs(rem)} over cap`
          : `Total: ${total} / ${cap}`}
      </StatBudgetRow>
      {isExistingPlayer && <IdentityLockHint>Stats are locked after creation.</IdentityLockHint>}
      {isPitcher
        ? statRow(
            "Pitching Stamina",
            asPitcher?.stamina ?? DEFAULT_PITCHING_STAMINA,
            `pitching-stamina-${player.id}`,
            (n) => ({ stamina: n }),
          )
        : statRow(
            "Batting Stamina",
            asBatter?.stamina ?? DEFAULT_BATTING_STAMINA,
            `batting-stamina-${player.id}`,
            (n) => ({ stamina: n }),
          )}
    </>
  );
};

export default PlayerStatFields;
