import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
  createChannel,
  Importance,
} from "@tauri-apps/plugin-notification";

import type { NotificationConfig } from "./notificationDiff";

const WINDOW_TAURI_GLOBAL = "__TAURI_INTERNALS__";

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
    console.warn("Failed to initialize notification channels", error);
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
      console.warn("Tauri notification permission check/request failed", error);
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

export const showDesktopNotification = async ({ title, body, importance }: NotificationConfig) => {
  if (isTauriRuntime()) {
    try {
      const channelId = importance === "High" ? "high-urgency" : "default";
      const options = body ? { title, body, channelId } : { title, channelId };
      await sendNotification(options);
      return;
    } catch (error) {
      console.warn("Tauri notification send failed", error);
    }

    return;
  }

  if (!isWebNotificationSupported() || Notification.permission !== "granted") {
    return;
  }

  const notification = new Notification(title, body ? { body } : undefined);
  notification.addEventListener("click", () => {
    window.focus();
    notification.close();
  });
};
