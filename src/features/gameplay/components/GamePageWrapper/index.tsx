import * as React from "react";

import { useBeforeUnload, useBlocker } from "react-router";

import { SavingBanner } from "./styles";

interface GamePageWrapperProps {
  children: (onSavingStateChange: (saving: boolean) => void) => React.ReactNode;
}

/**
 * Shared wrapper for game route pages.
 * Manages the navigation blocker and saving-state banner so individual game
 * pages don't duplicate this logic.
 */
const GamePageWrapper: React.FunctionComponent<GamePageWrapperProps> = ({ children }) => {
  const [isCommitting, setIsCommitting] = React.useState(false);

  const blocker = useBlocker(isCommitting);

  React.useEffect(() => {
    if (blocker.state === "blocked" && !isCommitting) {
      blocker.proceed?.();
    }
  }, [blocker, isCommitting]);

  useBeforeUnload(
    React.useCallback(
      (event) => {
        if (isCommitting) {
          event.preventDefault();
          event.returnValue = "";
        }
      },
      [isCommitting],
    ),
  );

  return (
    <>
      {children(setIsCommitting)}
      {blocker.state === "blocked" && (
        <SavingBanner role="status" aria-live="polite" data-testid="saving-stats-banner">
          💾 Saving stats… Navigation will continue automatically.
        </SavingBanner>
      )}
    </>
  );
};

export default GamePageWrapper;
