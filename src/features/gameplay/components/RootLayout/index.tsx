import * as React from "react";

import { ErrorBoundary } from "@feat/gameplay/components/Game/ErrorBoundary";
import UpdateBanner from "@shared/components/UpdateBanner";
import { AppSessionProvider } from "@shared/context/AppSessionContext";
import { useSeedDemoTeams } from "@shared/hooks/useSeedDemoTeams";
import { useServiceWorkerUpdate } from "@shared/hooks/useServiceWorkerUpdate";
import { Outlet } from "react-router";

/**
 * Thin root layout that wraps all routes with the application's ErrorBoundary
 * and renders the matched child route via <Outlet />.
 *
 * Also mounts the SW update banner: when a new SW version is waiting,
 * `useServiceWorkerUpdate` (backed by vite-plugin-pwa's `useRegisterSW`) sets
 * `updateAvailable`, and the banner prompts the user to reload.  The reload
 * sends SKIP_WAITING to the SW before refreshing so the updated assets are
 * guaranteed to be served.
 */
const RootLayout: React.FunctionComponent = () => {
  const { updateAvailable, dismiss, reload } = useServiceWorkerUpdate();
  useSeedDemoTeams();

  return (
    <ErrorBoundary>
      <AppSessionProvider>
        <Outlet />
      </AppSessionProvider>
      {updateAvailable && <UpdateBanner onDismiss={dismiss} onReload={reload} />}
    </ErrorBoundary>
  );
};

export default RootLayout;
