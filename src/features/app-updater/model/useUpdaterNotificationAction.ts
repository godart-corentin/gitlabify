import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { onAction } from "@tauri-apps/plugin-notification";
import { useEffect } from "react";

import { reportFrontendWarning } from "../../../shared/lib/sentry";
import { isObject } from "../../../shared/lib/type-guards";

import { isTauriRuntime } from "./updaterCheck";
import { UPDATE_NOTIFICATION_KIND } from "./updaterConstants";

const APP_UPDATER_FEATURE = "app-updater";

const isUpdateNotification = (value: unknown): boolean =>
  isObject(value) && "kind" in value && value.kind === UPDATE_NOTIFICATION_KIND;

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
            reportFrontendWarning("Failed to open app after update notification click", {
              action: "open-window-from-notification",
              error,
              feature: APP_UPDATER_FEATURE,
            });
          }
        });

        if (!isMounted) {
          listener.unregister().catch(() => {});
          return;
        }

        unregister = () => {
          listener.unregister().catch((error) => {
            reportFrontendWarning("Failed to unregister app updater notification listener", {
              action: "unregister-update-notification-listener",
              error,
              feature: APP_UPDATER_FEATURE,
            });
          });
        };
      } catch (error) {
        reportFrontendWarning("Failed to register app updater notification listener", {
          action: "register-update-notification-listener",
          error,
          feature: APP_UPDATER_FEATURE,
        });
      }
    };

    void registerListener();

    return () => {
      isMounted = false;
      unregister?.();
    };
  }, []);
};
