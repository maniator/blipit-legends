import type { DecisionType } from "@feat/gameplay/context/index";
import { appLog } from "@shared/utils/logger";

import { NOTIF_TAG } from "./constants";

export interface ServiceWorkerNotificationOptions extends NotificationOptions {
  actions?: { action: string; title: string }[];
  data?: unknown;
}

export interface ManagerNotificationData {
  decision: DecisionType;
  gameInstanceId?: string;
  pitchKey: number;
}

export const getNotificationBody = (d: DecisionType): string => {
  switch (d.kind) {
    case "steal":
      return `Steal from ${d.base === 0 ? "1st" : "2nd"} base? (${d.successPct}% success)`;
    case "bunt":
      return "Sacrifice bunt opportunity";
    case "count30":
      return "Count is 3-0 — Take or swing?";
    case "count02":
      return "Count is 0-2 — Protect or swing?";
    case "ibb":
      return "Intentional walk opportunity";
    case "ibb_or_steal":
      return `Intentional walk or steal from ${d.base === 0 ? "1st" : "2nd"}? (${d.successPct}% steal success)`;
    case "pinch_hitter": {
      const vs = d.pitcherHandedness ? ` vs ${d.pitcherHandedness}HP` : "";
      const edge =
        d.currentBatterMatchupDeltaPct !== undefined
          ? ` (current edge ${d.currentBatterMatchupDeltaPct >= 0 ? "+" : ""}${d.currentBatterMatchupDeltaPct}%)`
          : "";
      return `Pinch hitter opportunity${vs}${edge}`;
    }
    case "defensive_shift":
      return "Deploy defensive shift? (pop-outs ↑)";
    default:
      return "Manager decision needed";
  }
};

export const getNotificationActions = (d: DecisionType): { action: string; title: string }[] => {
  switch (d.kind) {
    case "steal":
      return [
        { action: "steal", title: "⚾ Yes, steal!" },
        { action: "skip", title: "⏭ Skip" },
      ];
    case "bunt":
      return [
        { action: "bunt", title: "✅ Bunt!" },
        { action: "skip", title: "⏭ Skip" },
      ];
    case "count30":
      return [
        { action: "take", title: "🤚 Take" },
        { action: "swing", title: "⚾ Swing" },
      ];
    case "count02":
      return [
        { action: "protect", title: "🛡 Protect" },
        { action: "normal", title: "⚾ Normal" },
      ];
    case "ibb":
      return [
        { action: "ibb", title: "✅ Walk Them" },
        { action: "skip", title: "⏭ Skip" },
      ];
    case "ibb_or_steal":
      return [
        { action: "ibb", title: "🥾 Walk Them" },
        { action: "steal", title: `⚡ Steal! (${(d as { successPct: number }).successPct}%)` },
        { action: "skip", title: "⏭ Skip" },
      ];
    case "pinch_hitter":
      return [
        { action: "ph_contact", title: "🎯 Contact" },
        { action: "ph_patient", title: "👀 Patient" },
        { action: "ph_power", title: "💪 Power" },
        { action: "ph_aggressive", title: "🔥 Aggressive" },
        { action: "ph_balanced", title: "⚖️ Balanced" },
        { action: "skip", title: "⏭ Skip" },
      ];
    case "defensive_shift":
      return [
        { action: "shift_on", title: "📐 Shift On" },
        { action: "shift_off", title: "🏟 Normal" },
        { action: "skip", title: "⏭ Skip" },
      ];
    default:
      return [{ action: "skip", title: "⏭ Skip" }];
  }
};

/** Show a service-worker notification with action buttons.
 *  requireInteraction: true keeps the notification visible until acted upon.
 *  Falls back to a plain Notification if the SW path fails. */
export const showManagerNotification = (
  d: DecisionType,
  metadata: { gameInstanceId?: string; pitchKey: number },
): void => {
  const permission = typeof Notification !== "undefined" ? Notification.permission : "unavailable";
  appLog.log(`showManagerNotification — kind="${d.kind}" permission="${permission}"`);

  if (typeof Notification === "undefined" || Notification.permission !== "granted") {
    appLog.warn(`showManagerNotification — skipped (permission="${permission}")`);
    return;
  }

  const title = "⚾ Your turn, Manager!";
  const body = getNotificationBody(d);

  if ("serviceWorker" in navigator) {
    appLog.log("showManagerNotification — awaiting navigator.serviceWorker.ready");
    navigator.serviceWorker.ready
      .then((reg) => {
        appLog.log("SW ready — calling reg.showNotification");
        return reg.showNotification(title, {
          body,
          tag: NOTIF_TAG,
          actions: getNotificationActions(d),
          data: { decision: d, ...metadata } satisfies ManagerNotificationData,
          requireInteraction: true,
        } as ServiceWorkerNotificationOptions);
      })
      .then(() => appLog.log("showNotification resolved — notification delivered to OS"))
      .catch((err) => {
        appLog.error("SW showNotification failed:", err, "— falling back to plain Notification");
        try {
          new Notification(title, { body, tag: NOTIF_TAG });
          appLog.log("plain Notification fallback sent");
        } catch (e) {
          appLog.error("plain Notification fallback also failed:", e);
        }
      });
  } else {
    appLog.log("showManagerNotification — no SW support, using plain Notification");
    try {
      new Notification(title, { body });
      appLog.log("plain Notification sent");
    } catch (e) {
      appLog.error("plain Notification failed:", e);
    }
  }
};

/** Close any open manager-decision notification (called when decision resolves). */
export const closeManagerNotification = (): void => {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.ready
    .then((reg) => reg.getNotifications({ tag: NOTIF_TAG }))
    .then((list) => {
      if (list.length > 0) {
        appLog.log(`closeManagerNotification — closing ${list.length} notification(s)`);
        list.forEach((n) => n.close());
      }
    })
    .catch(() => {});
};
