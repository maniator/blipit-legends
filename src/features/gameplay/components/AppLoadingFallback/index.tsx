import * as React from "react";

import { AppFallbackMessage } from "./styles";

interface AppLoadingFallbackProps {
  label?: string;
}

const AppLoadingFallback: React.FunctionComponent<AppLoadingFallbackProps> = ({
  label = "Loading app…",
}) => (
  <AppFallbackMessage data-testid="app-loading-fallback" role="status">
    {label}
  </AppFallbackMessage>
);

export default AppLoadingFallback;
