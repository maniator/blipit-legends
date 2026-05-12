/**
 * React component test helpers for gameplay — kept in a separate .tsx file
 * because .ts files cannot contain JSX.
 *
 * Re-exported from @test/testHelpers so existing `import { GameProviderWithSession }
 * from "@test/testHelpers"` paths work without change.
 */
import * as React from "react";

import type { GameSessionContextValue } from "@feat/gameplay/context/GameSessionContext";
import { GameSessionProvider } from "@feat/gameplay/context/GameSessionContext";
import { GameProviderWrapper } from "@feat/gameplay/context/index";

import { makeGameSessionContext } from "./gameplay";

/**
 * Test wrapper that combines GameSessionProvider + GameProviderWrapper.
 *
 * Use this instead of bare <GameProviderWrapper> whenever the children include
 * GameInner or any component that calls useGameSessionContext(). GameProviderWrapper
 * no longer provides GameSessionContext — that is the route pages' responsibility.
 */
export const GameProviderWithSession: React.FunctionComponent<{
  children?: React.ReactNode;
  sessionOverrides?: Partial<GameSessionContextValue>;
}> = ({ children, sessionOverrides }) => (
  <GameSessionProvider value={makeGameSessionContext(sessionOverrides)}>
    <GameProviderWrapper>{children}</GameProviderWrapper>
  </GameSessionProvider>
);
