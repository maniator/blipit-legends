import * as React from "react";

import { useGameContext } from "@feat/gameplay/context/index";
import { Hit } from "@shared/constants/hitTypes";

import { Area, EmptyState, Entry, HeadingRow, Label, Runs, Toggle } from "./styles";

const EVENT_LABEL: Record<Hit, string> = {
  [Hit.Single]: "1B",
  [Hit.Double]: "2B",
  [Hit.Triple]: "3B",
  [Hit.Homerun]: "HR",
  [Hit.Walk]: "BB",
  [Hit.HitByPitch]: "HBP",
};

const HALF_ARROW = ["▲", "▼"] as const;

const HitLog: React.FunctionComponent<{ activeTeam: 0 | 1 }> = ({ activeTeam }) => {
  const { playLog, teamLabels } = useGameContext();
  const [collapsed, setCollapsed] = React.useState(false);

  const filtered = playLog.filter((entry) => entry.team === activeTeam);

  return (
    <>
      <HeadingRow>
        <span>Hit Log</span>
        <Toggle
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Expand hit log" : "Collapse hit log"}
        >
          {collapsed ? "▶ show" : "▼ hide"}
        </Toggle>
      </HeadingRow>
      {!collapsed && (
        <Area data-testid="hit-log">
          {filtered.length === 0 ? (
            <EmptyState>No hits yet.</EmptyState>
          ) : (
            [...filtered].reverse().map((entry, idx) => {
              const key = `${entry.inning}-${entry.half}-${entry.team}-${entry.batterNum}-${idx}`;
              const batterLabel = entry.batterName ?? `#${entry.batterNum}`;
              return (
                <Entry key={key}>
                  <Label $hr={entry.event === Hit.Homerun}>{EVENT_LABEL[entry.event]}</Label>
                  <span>
                    {HALF_ARROW[entry.half]}
                    {entry.inning} — {teamLabels[entry.team]} {batterLabel}
                  </span>
                  {entry.runs > 0 && (
                    <Runs>
                      +{entry.runs} run{entry.runs !== 1 ? "s" : ""}
                    </Runs>
                  )}
                </Entry>
              );
            })
          )}
        </Area>
      )}
    </>
  );
};

export default HitLog;
