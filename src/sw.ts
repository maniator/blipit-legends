/// <reference lib="webworker" />

import { createLogger } from "@shared/utils/logger";
import { clientsClaim } from "workbox-core";
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

const log = createLogger("SW");

// ---------------------------------------------------------------------------
// SKIP_WAITING prompt — the client sends this when the user clicks "Reload" in
// the update banner.  The new SW waits until then so it does not disrupt an
// in-progress game session.
// ---------------------------------------------------------------------------
self.addEventListener("message", (event) => {
  const me = event as ExtendableMessageEvent;
  if (me.data?.type === "SKIP_WAITING") {
    log.log("SKIP_WAITING received — activating new SW");
    me.waitUntil(self.skipWaiting());
  }
});

// ---------------------------------------------------------------------------
// Precache all build output entries injected by vite-plugin-pwa and wire up
// cache-first routing for those entries.
// ---------------------------------------------------------------------------
precacheAndRoute(self.__WB_MANIFEST);

// Remove outdated Workbox precache entries (e.g., stale revision hashes from
// previous builds). This only cleans up Workbox-managed caches; legacy
// CacheStorage entries from the previous hand-rolled SW are not affected.
cleanupOutdatedCaches();

// ---------------------------------------------------------------------------
// SPA navigation fallback — serve the precached index.html for every
// same-origin navigation request so client-side routes work while offline.
// ---------------------------------------------------------------------------
registerRoute(new NavigationRoute(createHandlerBoundToURL("/index.html")));

// Take immediate control of all open tabs on first install.
clientsClaim();

// ---------------------------------------------------------------------------
// Handle notification action button clicks and notification body clicks.
// Posts a NOTIFICATION_ACTION message back to the game page so it can
// dispatch the correct reducer action without the user needing to open the tab.
// ---------------------------------------------------------------------------
self.addEventListener("notificationclick", (event) => {
  const ne = event as NotificationEvent;
  const action = ne.action || "focus";
  log.log(`notificationclick fired — action="${action}", tag="${ne.notification.tag}"`);
  ne.notification.close();

  ne.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        const windowClients = clientList as WindowClient[];
        log.log(`matchAll found ${windowClients.length} window client(s)`);

        const gameClients = windowClients.filter((client) => {
          try {
            return new URL(client.url).pathname === "/game";
          } catch {
            return false;
          }
        });
        const deliveryClients = gameClients.length > 0 ? gameClients : windowClients;
        const client = deliveryClients[0];
        if (!client) {
          log.warn(
            "No window clients found — cannot deliver NOTIFICATION_ACTION; user may need to re-open the tab",
          );
          return;
        }

        const data = ne.notification.data as
          | { decision?: unknown; gameInstanceId?: string; pitchKey?: number }
          | undefined;
        log.log(
          `Posting NOTIFICATION_ACTION action="${action}" to ${deliveryClients.length} client(s)`,
        );
        for (const deliveryClient of deliveryClients) {
          deliveryClient.postMessage({
            type: "NOTIFICATION_ACTION",
            action,
            payload: data?.decision,
            gameInstanceId: data?.gameInstanceId,
            pitchKey: data?.pitchKey,
          });
        }

        return client
          .focus()
          .then(() => log.log("client.focus() resolved — tab brought to foreground"))
          .catch((err) => log.warn("client.focus() failed (may be blocked by browser):", err));
      })
      .catch((err) => log.error("notificationclick handler failed:", err)),
  );
});
