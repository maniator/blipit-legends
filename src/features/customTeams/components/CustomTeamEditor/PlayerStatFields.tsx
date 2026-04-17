import * as React from "react";

import type { EditorPlayer } from "./editorState";
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
  onChange: (patch: Partial<EditorPlayer>) => void;
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

  const pitcherStat = (
    label: string,
    key: "velocity" | "control" | "movement",
    htmlFor: string,
  ) => {
    const val = asPitcher?.[key] ?? 0;
    return (
      <StatRow key={`stat-${key}`} $locked={isExistingPlayer}>
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
            if (!isExistingPlayer)
              onChange({ [key]: Number(e.target.value) } as Partial<EditorPlayer>);
          }}
        />
        <StatValue>{val}</StatValue>
      </StatRow>
    );
  };

  const batterStat = (label: string, key: "contact" | "power" | "speed", htmlFor: string) => {
    const val = asBatter?.[key] ?? 0;
    return (
      <StatRow key={`stat-${key}`} $locked={isExistingPlayer}>
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
            if (!isExistingPlayer)
              onChange({ [key]: Number(e.target.value) } as Partial<EditorPlayer>);
          }}
        />
        <StatValue>{val}</StatValue>
      </StatRow>
    );
  };

  return (
    <>
      <StatsGrid>
        {isPitcher ? (
          <>
            {pitcherStat("Velocity", "velocity", `velocity-${player.id}`)}
            {pitcherStat("Control", "control", `control-${player.id}`)}
            {pitcherStat("Movement", "movement", `movement-${player.id}`)}
          </>
        ) : (
          <>
            {batterStat("Contact", "contact", `contact-${player.id}`)}
            {batterStat("Power", "power", `power-${player.id}`)}
            {batterStat("Speed", "speed", `speed-${player.id}`)}
          </>
        )}
      </StatsGrid>
      <StatBudgetRow $overCap={shouldShowOverCapWarning}>
        {shouldShowOverCapWarning
          ? `⚠ ${total} / ${cap} — ${Math.abs(rem)} over cap`
          : `Total: ${total} / ${cap}`}
      </StatBudgetRow>
      {isExistingPlayer && <IdentityLockHint>Stats are locked after creation.</IdentityLockHint>}
    </>
  );
};

export default PlayerStatFields;
