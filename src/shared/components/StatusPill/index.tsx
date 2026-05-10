import * as React from "react";

import { PillSpan, PillVariant } from "./styles";

const defaultLabels: Record<PillVariant, string> = {
  fresh: "✓ Fresh",
  tired: "! Tired",
  spent: "✕ Spent",
  il: "IL",
  auto: "Auto",
};

interface StatusPillProps {
  variant: PillVariant;
  label?: string;
  className?: string;
}

const StatusPill: React.FunctionComponent<StatusPillProps> = ({ variant, label, className }) => (
  <PillSpan $variant={variant} className={className}>
    {label ?? defaultLabels[variant]}
  </PillSpan>
);

export default StatusPill;
