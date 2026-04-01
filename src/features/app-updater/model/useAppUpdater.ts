import { relaunch } from "@tauri-apps/plugin-process";
import type { Store } from "@tauri-apps/plugin-store";
import type { DownloadEvent } from "@tauri-apps/plugin-updater";
import { useCallback, useRef, useState } from "react";

import { reportFrontendError, reportFrontendWarning } from "../../../shared/lib/sentry";
import {
  ensureNotificationPermission,
  showDesktopNotification,
} from "../../inbox-notifications/model/notificationDelivery";

import { checkForAvailableUpdate, isMockUpdaterEnabled, isTauriRuntime } from "./updaterCheck";
import {
  UPDATER_RECHECK_INTERVAL_MS,
  UPDATER_STARTUP_CHECK_DELAY_MS,
  UPDATE_NOTIFICATION_KIND,
  UPDATE_NOTIFICATION_TITLE,
} from "./updaterConstants";
import { createInstallProgressState, getNextInstallProgressState } from "./updaterInstallProgress";
import {
  getLastNotifiedVersion,
  getOrCreateUpdaterStore,
  saveLastNotifiedVersion,
} from "./updaterPreferences";
import {
  applyAvailableUpdate,
  createIdleUpdaterSnapshot,
  createUpdaterCheckingState,
  createUpdaterErrorState,
  createUpdaterInstallStartingState,
  createUpdaterProgressState,
  createUpdaterReadyToRestartState,
  getBannerDismissKey,
} from "./updaterState";
import type { CheckForUpdatesOptions, UpdaterState } from "./updaterTypes";
import { useUpdaterNotificationAction } from "./useUpdaterNotificationAction";
import { useUpdaterPolling } from "./useUpdaterPolling";
import {
  resetAppUpdaterSessionStateForTests,
  useUpdaterStartupCheck,
} from "./useUpdaterStartupCheck";

export type { UpdaterState, UpdaterStatus } from "./updaterTypes";
export { resetAppUpdaterSessionStateForTests };

const getUpdateNotificationBody = (version: string) =>
  `Gitlabify ${version} is available. Open the app to update.`;
const APP_UPDATER_FEATURE = "app-updater";

const toErrorMessage = (error: unknown, fallbackMessage: string) => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallbackMessage;
};

export const useAppUpdater = (): UpdaterState => {
  const [snapshot, setSnapshot] = useState(createIdleUpdaterSnapshot);
  const isInstallingRef = useRef(false);
  const isCheckingRef = useRef(false);
  const installProgressRef = useRef(createInstallProgressState());
  const storeRef = useRef<Store | null>(null);

  const notifyForNewVersion = useCallback(
    async (version: string, alwaysNotify: boolean = false) => {
      try {
        const store = storeRef.current ?? (await getOrCreateUpdaterStore());
        storeRef.current = store;

        if (!alwaysNotify) {
          const lastNotifiedVersion = await getLastNotifiedVersion(store);
          if (lastNotifiedVersion === version) {
            return;
          }
        }

        const hasPermission = await ensureNotificationPermission();
        if (!hasPermission) {
          return;
        }

        await showDesktopNotification({
          title: UPDATE_NOTIFICATION_TITLE,
          body: getUpdateNotificationBody(version),
          extra: {
            kind: UPDATE_NOTIFICATION_KIND,
            version,
          },
        });

        if (!alwaysNotify) {
          await saveLastNotifiedVersion(store, version);
        }
      } catch (error) {
        reportFrontendWarning("Failed to notify about available app update", {
          action: "notify-about-update",
          error,
          extra: { version },
          feature: APP_UPDATER_FEATURE,
        });
      }
    },
    [],
  );

  const runUpdateCheck = useCallback(
    async ({ shouldNotify }: CheckForUpdatesOptions) => {
      if (isCheckingRef.current) {
        return;
      }

      isCheckingRef.current = true;
      setSnapshot((current) => createUpdaterCheckingState(current));

      try {
        const availableUpdate = await checkForAvailableUpdate();

        if (!availableUpdate) {
          setSnapshot(createIdleUpdaterSnapshot());
          return;
        }

        setSnapshot((current) => applyAvailableUpdate(current, availableUpdate));

        if (shouldNotify) {
          await notifyForNewVersion(availableUpdate.version);
        }
      } catch (error) {
        setSnapshot((current) =>
          createUpdaterErrorState(current, toErrorMessage(error, "Unable to check for updates.")),
        );
        reportFrontendError("Failed to check for app update", {
          action: "check-for-updates",
          error,
          feature: APP_UPDATER_FEATURE,
        });
      } finally {
        isCheckingRef.current = false;
      }
    },
    [notifyForNewVersion],
  );

  const checkForUpdates = useCallback(async () => {
    if (snapshot.status === "downloading") {
      return;
    }

    await runUpdateCheck({
      shouldNotify: false,
    });
  }, [runUpdateCheck, snapshot.status]);

  const handleDownloadProgress = useCallback((progress: DownloadEvent) => {
    const nextProgressState = getNextInstallProgressState(installProgressRef.current, progress);
    installProgressRef.current = nextProgressState;
    setSnapshot((current) =>
      createUpdaterProgressState(current, nextProgressState.progressPercent),
    );
  }, []);

  const installUpdate = useCallback(async () => {
    const availableUpdate = snapshot.availableUpdate;
    if (!availableUpdate || isInstallingRef.current) {
      return;
    }

    isInstallingRef.current = true;
    installProgressRef.current = createInstallProgressState();
    setSnapshot((current) => createUpdaterInstallStartingState(current));

    try {
      await availableUpdate.downloadAndInstall(handleDownloadProgress);
      setSnapshot((current) => createUpdaterReadyToRestartState(current));
    } catch (error) {
      setSnapshot((current) =>
        createUpdaterErrorState(current, toErrorMessage(error, "Unable to install update.")),
      );
      reportFrontendError("Failed to install app update", {
        action: "install-update",
        error,
        extra: { version: availableUpdate.version },
        feature: APP_UPDATER_FEATURE,
      });
    } finally {
      isInstallingRef.current = false;
    }
  }, [handleDownloadProgress, snapshot.availableUpdate]);

  const restartToApplyUpdate = useCallback(async () => {
    if (snapshot.status !== "ready_to_restart") {
      return;
    }

    try {
      await relaunch();
    } catch (error) {
      setSnapshot((current) =>
        createUpdaterErrorState(
          current,
          toErrorMessage(error, "Unable to restart app to apply update."),
        ),
      );
      reportFrontendError("Failed to relaunch app after update", {
        action: "restart-to-apply-update",
        error,
        feature: APP_UPDATER_FEATURE,
      });
    }
  }, [snapshot.status]);

  const remindLater = useCallback(async () => {
    const dismissKey = getBannerDismissKey(snapshot.status, snapshot.availableVersion);
    if (!dismissKey) {
      return;
    }

    setSnapshot((current) => ({
      ...current,
      dismissedBannerKey: dismissKey,
    }));
  }, [snapshot.availableVersion, snapshot.status]);

  useUpdaterNotificationAction();

  const isUpdaterEnabled = isTauriRuntime() || isMockUpdaterEnabled();
  const runStartupCheck = useCallback(
    async () =>
      runUpdateCheck({
        shouldNotify: true,
      }),
    [runUpdateCheck],
  );

  useUpdaterStartupCheck({
    isEnabled: isUpdaterEnabled,
    runUpdateCheck: runStartupCheck,
  });

  const runPollingCheck = useCallback(
    async () =>
      runUpdateCheck({
        shouldNotify: true,
      }),
    [runUpdateCheck],
  );

  useUpdaterPolling({
    isEnabled: isUpdaterEnabled,
    isPaused: snapshot.status === "downloading" || snapshot.status === "ready_to_restart",
    runUpdateCheck: runPollingCheck,
  });

  const currentBannerDismissKey = getBannerDismissKey(snapshot.status, snapshot.availableVersion);
  const isBannerVisible =
    currentBannerDismissKey === null || snapshot.dismissedBannerKey !== currentBannerDismissKey;

  return {
    status: snapshot.status,
    availableVersion: snapshot.availableVersion,
    releaseNotes: snapshot.releaseNotes,
    progressPercent: snapshot.progressPercent,
    errorMessage: snapshot.errorMessage,
    isBannerVisible,
    checkForUpdates,
    installUpdate,
    restartToApplyUpdate,
    remindLater,
  };
};

export { UPDATER_RECHECK_INTERVAL_MS, UPDATER_STARTUP_CHECK_DELAY_MS };
