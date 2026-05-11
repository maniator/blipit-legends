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
  title?: string;
}

const StatusPill: React.FunctionComponent<StatusPillProps> = ({
  variant,
  label,
  className,
  title,
}) => (
  <PillSpan $variant={variant} className={className} title={title}>
    {label ?? defaultLabels[variant]}
  </PillSpan>
);

export default StatusPill;
