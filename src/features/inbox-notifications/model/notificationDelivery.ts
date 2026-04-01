import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
  createChannel,
  Importance,
} from "@tauri-apps/plugin-notification";

import { reportFrontendWarning } from "../../../shared/lib/sentry";

export type NotificationConfig = {
  title: string;
  body?: string;
  importance?: "High" | "Default";
  url?: string;
  icon?: string;
  extra?: Record<string, unknown>;
};

const WINDOW_TAURI_GLOBAL = "__TAURI_INTERNALS__";
const INBOX_NOTIFICATIONS_FEATURE = "inbox-notifications";

type TauriWindow = Window & {
  __TAURI_INTERNALS__?: unknown;
};

const isTauriRuntime = () => {
  if (typeof window === "undefined") {
    return false;
  }

  return WINDOW_TAURI_GLOBAL in (window as TauriWindow);
};

const isWebNotificationSupported = () =>
  typeof window !== "undefined" && typeof Notification !== "undefined";

const initChannels = async () => {
  try {
    await Promise.all([
      createChannel({
        id: "high-urgency",
        name: "High Urgency",
        importance: Importance.High,
      }),
      createChannel({
        id: "default",
        name: "Default",
        importance: Importance.Default,
      }),
    ]);
  } catch (error) {
    reportFrontendWarning("Failed to initialize notification channels", {
      action: "initialize-notification-channels",
      error,
      feature: INBOX_NOTIFICATIONS_FEATURE,
    });
  }
};

export const ensureNotificationPermission = async () => {
  if (isTauriRuntime()) {
    try {
      const granted = await isPermissionGranted();
      if (granted) {
        await initChannels();
        return true;
      }

      const permission = await requestPermission();
      if (permission === "granted") {
        await initChannels();
        return true;
      }
      return false;
    } catch (error) {
      reportFrontendWarning("Tauri notification permission check/request failed", {
        action: "request-notification-permission",
        error,
        feature: INBOX_NOTIFICATIONS_FEATURE,
      });
      return false;
    }
  }

  if (!isWebNotificationSupported()) {
    return false;
  }

  if (Notification.permission === "granted") {
    return true;
  }

  if (Notification.permission === "denied") {
    return false;
  }

  const permission = await Notification.requestPermission();
  return permission === "granted";
};

export const showDesktopNotification = async ({
  title,
  body,
  importance,
  url,
  icon,
  extra,
}: NotificationConfig) => {
  if (isTauriRuntime()) {
    try {
      const channelId = importance === "High" ? "high-urgency" : "default";
      const notificationExtra = url ? (extra ? { ...extra, url } : { url }) : extra;
      const options = {
        title,
        body,
        channelId,
        icon,
        autoCancel: true,
        extra: notificationExtra,
      };
      await sendNotification(options);
      return;
    } catch (error) {
      reportFrontendWarning("Tauri notification send failed", {
        action: "send-notification",
        error,
        extra: {
          importance: importance ?? "Default",
          title,
        },
        feature: INBOX_NOTIFICATIONS_FEATURE,
      });
    }

    return;
  }

  if (!isWebNotificationSupported() || Notification.permission !== "granted") {
    return;
  }

  const notification = new Notification(title, {
    body,
    icon,
  });
  notification.addEventListener("click", () => {
    if (url) {
      window.open(url, "_blank");
    } else {
      window.focus();
    }
    notification.close();
  });
};
