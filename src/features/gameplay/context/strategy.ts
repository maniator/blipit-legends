import type { Strategy } from "./playerTypes";

export const stratMod = (
  strategy: Strategy,
  stat: "walk" | "strikeout" | "homerun" | "contact" | "steal" | "advance",
): number => {
  const table: Record<Strategy, Record<typeof stat, number>> = {
    balanced: { walk: 0.85, strikeout: 1.0, homerun: 1.0, contact: 1.0, steal: 1.0, advance: 1.0 },
    aggressive: {
      walk: 0.72,
      strikeout: 1.1,
      homerun: 1.1,
      contact: 1.0,
      steal: 1.3,
      advance: 1.3,
    },
    patient: { walk: 1.0, strikeout: 0.8, homerun: 0.9, contact: 1.0, steal: 0.7, advance: 0.9 },
    contact: { walk: 1.0, strikeout: 0.7, homerun: 0.7, contact: 1.4, steal: 1.0, advance: 1.1 },
    power: { walk: 0.9, strikeout: 1.3, homerun: 1.6, contact: 0.8, steal: 0.8, advance: 1.0 },
  };
  return (table[strategy] ?? table["balanced"])[stat];
};
