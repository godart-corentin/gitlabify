import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { onAction } from "@tauri-apps/plugin-notification";
import { useEffect } from "react";

import { isTauriRuntime } from "./updaterCheck";
import { UPDATE_NOTIFICATION_KIND } from "./updaterConstants";

const isUpdateNotification = (value: unknown): boolean =>
  typeof value === "object" &&
  value !== null &&
  "kind" in value &&
  value.kind === UPDATE_NOTIFICATION_KIND;

const openAppWindow = async () => {
  const appWindow = getCurrentWebviewWindow();
  await Promise.all([appWindow.show(), appWindow.unminimize(), appWindow.setFocus()]);
};

export const useUpdaterNotificationAction = () => {
  useEffect(() => {
    if (!isTauriRuntime()) {
      return;
    }

    let isMounted = true;
    let unregister: (() => void) | undefined;

    const registerListener = async () => {
      try {
        const listener = await onAction(async (notification) => {
          if (!isUpdateNotification(notification.extra)) {
            return;
          }

          try {
            await openAppWindow();
          } catch (error) {
            console.warn("Failed to open app after update notification click", error);
          }
        });

        if (!isMounted) {
          listener.unregister().catch(() => {});
          return;
        }

        unregister = () => {
          listener.unregister().catch((error) => {
            console.warn("Failed to unregister app updater notification listener", error);
          });
        };
      } catch (error) {
        console.warn("Failed to register app updater notification listener", error);
      }
    };

    void registerListener();

    return () => {
      isMounted = false;
      unregister?.();
    };
  }, []);
};
