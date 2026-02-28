import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { onAction } from "@tauri-apps/plugin-notification";
import { relaunch } from "@tauri-apps/plugin-process";
import { Store } from "@tauri-apps/plugin-store";
import { check, type DownloadEvent } from "@tauri-apps/plugin-updater";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  ensureNotificationPermission,
  showDesktopNotification,
} from "../../inbox-notifications/model/notificationDelivery";

const UPDATER_STORE_FILE = "app-updater-preferences.json";
const LAST_NOTIFIED_VERSION_KEY = "last_notified_version";
const UPDATE_NOTIFICATION_KIND = "app-update";
const UPDATE_NOTIFICATION_TITLE = "Update available";
const TAURI_INTERNALS_WINDOW_KEY = "__TAURI_INTERNALS__";
const MOCK_UPDATER_ENV_FLAG = "true";
const MOCK_UPDATER_VERSION = "9.9.9-mock";
const MOCK_UPDATER_INSTALL_DELAY_MS = 1200;
const MAX_PROGRESS_PERCENT = 100;
const MIN_PROGRESS_PERCENT = 0;
const PERCENTAGE_MULTIPLIER = 100;

export const UPDATER_RECHECK_INTERVAL_MS = 21600000;
export const UPDATER_STARTUP_CHECK_DELAY_MS = 3000;

let hasStartupUpdateCheckRun = false;

export type UpdaterStatus =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "ready_to_restart"
  | "error";

export type UpdaterState = {
  status: UpdaterStatus;
  availableVersion: string | null;
  releaseNotes: string | null;
  progressPercent: number | null;
  errorMessage: string | null;
  isBannerVisible: boolean;
  checkForUpdates: () => Promise<void>;
  installUpdate: () => Promise<void>;
  restartToApplyUpdate: () => Promise<void>;
  remindLater: () => Promise<void>;
};

type TauriWindow = Window & {
  __TAURI_INTERNALS__?: unknown;
};

type UpdateMetadata = {
  version: string;
  body?: string;
  downloadAndInstall: (onEvent?: (progress: DownloadEvent) => void) => Promise<void>;
};

type CheckForUpdatesOptions = {
  shouldNotify: boolean;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isString = (value: unknown): value is string => typeof value === "string";

const isUpdateMetadata = (value: unknown): value is UpdateMetadata => {
  if (!isObject(value)) {
    return false;
  }

  const candidateVersion = value.version;
  const candidateDownloadAndInstall = value.downloadAndInstall;

  return isString(candidateVersion) && typeof candidateDownloadAndInstall === "function";
};

const isUpdateNotification = (value: unknown): boolean => {
  if (!isObject(value)) {
    return false;
  }

  return value.kind === UPDATE_NOTIFICATION_KIND;
};

const isTauriRuntime = () => {
  if (typeof window === "undefined") {
    return false;
  }

  return TAURI_INTERNALS_WINDOW_KEY in (window as TauriWindow);
};

const isMockUpdaterEnabled = () => import.meta.env.VITE_MOCK_UPDATER === MOCK_UPDATER_ENV_FLAG;

const getOrCreateStore = async () => {
  const existing = await Store.get(UPDATER_STORE_FILE);
  if (existing) {
    return existing;
  }

  return Store.load(UPDATER_STORE_FILE);
};

const getUpdateNotificationBody = (version: string) =>
  `Gitlabify ${version} is available. Open the app to update.`;

const getReleaseNotes = (body: string | undefined) => {
  if (!isString(body)) {
    return null;
  }

  const trimmedBody = body.trim();
  if (trimmedBody.length === 0) {
    return null;
  }

  return trimmedBody;
};

const waitForDelay = (delayMs: number) =>
  new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, delayMs);
  });

const createMockUpdate = (): UpdateMetadata => ({
  version: MOCK_UPDATER_VERSION,
  downloadAndInstall: async () => {
    await waitForDelay(MOCK_UPDATER_INSTALL_DELAY_MS);
  },
});

const toErrorMessage = (error: unknown, fallbackMessage: string) => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallbackMessage;
};

const clampProgressPercent = (value: number) =>
  Math.min(MAX_PROGRESS_PERCENT, Math.max(MIN_PROGRESS_PERCENT, value));

const getBannerDismissKey = (
  status: UpdaterStatus,
  availableVersion: string | null,
): string | null => {
  if (status === "available" || status === "ready_to_restart" || status === "error") {
    return `${status}:${availableVersion ?? "none"}`;
  }

  return null;
};

export const resetAppUpdaterSessionStateForTests = () => {
  hasStartupUpdateCheckRun = false;
};

export const useAppUpdater = (): UpdaterState => {
  const [status, setStatus] = useState<UpdaterStatus>("idle");
  const [availableUpdate, setAvailableUpdate] = useState<UpdateMetadata | null>(null);
  const [availableVersion, setAvailableVersion] = useState<string | null>(null);
  const [releaseNotes, setReleaseNotes] = useState<string | null>(null);
  const [progressPercent, setProgressPercent] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dismissedBannerKey, setDismissedBannerKey] = useState<string | null>(null);
  const isInstallingRef = useRef(false);
  const isCheckingRef = useRef(false);
  const downloadedBytesRef = useRef(0);
  const totalBytesRef = useRef<number | null>(null);
  const storeRef = useRef<Store | null>(null);

  const openAppWindow = useCallback(async () => {
    const appWindow = getCurrentWebviewWindow();
    await Promise.all([appWindow.show(), appWindow.unminimize(), appWindow.setFocus()]);
  }, []);

  const notifyForNewVersion = useCallback(
    async (version: string, alwaysNotify: boolean = false) => {
      try {
        const store = storeRef.current ?? (await getOrCreateStore());
        storeRef.current = store;

        if (!alwaysNotify) {
          const lastNotifiedVersion = await store.get(LAST_NOTIFIED_VERSION_KEY);
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
          await store.set(LAST_NOTIFIED_VERSION_KEY, version);
          await store.save();
        }
      } catch (error) {
        console.warn("Failed to notify about available app update", error);
      }
    },
    [],
  );

  const clearUpdateState = useCallback(() => {
    setAvailableUpdate(null);
    setAvailableVersion(null);
    setReleaseNotes(null);
    setProgressPercent(null);
    setErrorMessage(null);
    setDismissedBannerKey(null);
    setStatus("idle");
  }, []);

  const setAvailableState = useCallback((update: UpdateMetadata) => {
    setAvailableUpdate(update);
    setAvailableVersion(update.version);
    setReleaseNotes(getReleaseNotes(update.body));
    setProgressPercent(null);
    setErrorMessage(null);
    setDismissedBannerKey((current) => {
      const availableDismissKey = getBannerDismissKey("available", update.version);
      return current === availableDismissKey ? current : null;
    });
    setStatus("available");
  }, []);

  const runUpdateCheck = useCallback(
    async ({ shouldNotify }: CheckForUpdatesOptions) => {
      if (isCheckingRef.current) {
        return;
      }

      isCheckingRef.current = true;
      setStatus("checking");
      setErrorMessage(null);

      try {
        const isMockMode = isMockUpdaterEnabled();
        const checkResult = isMockMode ? createMockUpdate() : await check();

        if (!isUpdateMetadata(checkResult)) {
          clearUpdateState();
          return;
        }

        setAvailableState(checkResult);

        if (shouldNotify) {
          await notifyForNewVersion(checkResult.version);
        }
      } catch (error) {
        setErrorMessage(toErrorMessage(error, "Unable to check for updates."));
        setStatus("error");
        console.warn("Failed to check for app update", error);
      } finally {
        isCheckingRef.current = false;
      }
    },
    [clearUpdateState, notifyForNewVersion, setAvailableState],
  );

  const checkForUpdates = useCallback(async () => {
    if (status === "downloading") {
      return;
    }

    await runUpdateCheck({
      shouldNotify: false,
    });
  }, [runUpdateCheck, status]);

  const handleDownloadProgress = useCallback((progress: DownloadEvent) => {
    if (progress.event === "Started") {
      downloadedBytesRef.current = 0;
      totalBytesRef.current = progress.data.contentLength ?? null;
      setProgressPercent(MIN_PROGRESS_PERCENT);
      return;
    }

    if (progress.event === "Progress") {
      downloadedBytesRef.current += progress.data.chunkLength;

      const totalBytes = totalBytesRef.current;
      if (!totalBytes || totalBytes <= 0) {
        return;
      }

      const downloadRatio = downloadedBytesRef.current / totalBytes;
      const nextProgressPercent = clampProgressPercent(
        Math.round(downloadRatio * PERCENTAGE_MULTIPLIER),
      );
      setProgressPercent(nextProgressPercent);
      return;
    }

    setProgressPercent(MAX_PROGRESS_PERCENT);
  }, []);

  const installUpdate = useCallback(async () => {
    if (!availableUpdate || isInstallingRef.current) {
      return;
    }

    isInstallingRef.current = true;
    downloadedBytesRef.current = 0;
    totalBytesRef.current = null;
    setStatus("downloading");
    setErrorMessage(null);
    setProgressPercent(MIN_PROGRESS_PERCENT);

    try {
      await availableUpdate.downloadAndInstall(handleDownloadProgress);
      setAvailableUpdate(null);
      setStatus("ready_to_restart");
      setProgressPercent(MAX_PROGRESS_PERCENT);
    } catch (error) {
      setStatus("error");
      setErrorMessage(toErrorMessage(error, "Unable to install update."));
      setProgressPercent(null);
      console.warn("Failed to install app update", error);
    } finally {
      isInstallingRef.current = false;
    }
  }, [availableUpdate, handleDownloadProgress]);

  const restartToApplyUpdate = useCallback(async () => {
    if (status !== "ready_to_restart") {
      return;
    }

    try {
      await relaunch();
    } catch (error) {
      setStatus("error");
      setErrorMessage(toErrorMessage(error, "Unable to restart app to apply update."));
      console.warn("Failed to relaunch app after update", error);
    }
  }, [status]);

  const remindLater = useCallback(async () => {
    const dismissKey = getBannerDismissKey(status, availableVersion);
    if (!dismissKey) {
      return;
    }

    setDismissedBannerKey(dismissKey);
  }, [availableVersion, status]);

  const currentBannerDismissKey = getBannerDismissKey(status, availableVersion);
  const isBannerVisible =
    currentBannerDismissKey === null || dismissedBannerKey !== currentBannerDismissKey;

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
      if (unregister) {
        unregister();
      }
    };
  }, [openAppWindow]);

  useEffect(() => {
    const isMockMode = isMockUpdaterEnabled();
    if (!isTauriRuntime() && !isMockMode) {
      return;
    }

    if (hasStartupUpdateCheckRun) {
      return;
    }
    hasStartupUpdateCheckRun = true;

    let isCancelled = false;
    const runStartupCheck = async () => {
      if (isCancelled) {
        return;
      }

      await runUpdateCheck({
        shouldNotify: true,
      });
    };

    void runStartupCheck();

    return () => {
      isCancelled = true;
    };
  }, [runUpdateCheck]);

  useEffect(() => {
    const isMockMode = isMockUpdaterEnabled();
    if (!isTauriRuntime() && !isMockMode) {
      return;
    }

    const intervalId = globalThis.setInterval(() => {
      if (status === "downloading" || status === "ready_to_restart") {
        return;
      }

      void runUpdateCheck({
        shouldNotify: true,
      });
    }, UPDATER_RECHECK_INTERVAL_MS);

    return () => {
      globalThis.clearInterval(intervalId);
    };
  }, [runUpdateCheck, status]);

  return {
    status,
    availableVersion,
    releaseNotes,
    progressPercent,
    errorMessage,
    isBannerVisible,
    checkForUpdates,
    installUpdate,
    restartToApplyUpdate,
    remindLater,
  };
};
