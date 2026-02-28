import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  UPDATER_STARTUP_CHECK_DELAY_MS,
  resetAppUpdaterSessionStateForTests,
  useAppUpdater,
} from "./useAppUpdater";

const {
  checkMock,
  onActionMock,
  relaunchMock,
  getCurrentWebviewWindowMock,
  ensureNotificationPermissionMock,
  showDesktopNotificationMock,
  storeLookupMock,
  storeLoadMock,
  storeGetMock,
  storeSetMock,
  storeSaveMock,
} = vi.hoisted(() => {
  const storeGet = vi.fn();
  const storeSet = vi.fn();
  const storeSave = vi.fn();

  return {
    checkMock: vi.fn(),
    onActionMock: vi.fn(),
    relaunchMock: vi.fn(),
    getCurrentWebviewWindowMock: vi.fn(),
    ensureNotificationPermissionMock: vi.fn(),
    showDesktopNotificationMock: vi.fn(),
    storeLookupMock: vi.fn(),
    storeLoadMock: vi.fn(),
    storeGetMock: storeGet,
    storeSetMock: storeSet,
    storeSaveMock: storeSave,
  };
});

vi.mock("@tauri-apps/plugin-updater", () => ({
  check: checkMock,
}));

vi.mock("@tauri-apps/plugin-notification", () => ({
  onAction: onActionMock,
}));

vi.mock("@tauri-apps/plugin-process", () => ({
  relaunch: relaunchMock,
}));

vi.mock("@tauri-apps/api/webviewWindow", () => ({
  getCurrentWebviewWindow: getCurrentWebviewWindowMock,
}));

vi.mock("@tauri-apps/plugin-store", () => ({
  Store: {
    get: storeLookupMock,
    load: storeLoadMock,
  },
}));

vi.mock("../../inbox-notifications/model/notificationDelivery", () => ({
  ensureNotificationPermission: ensureNotificationPermissionMock,
  showDesktopNotification: showDesktopNotificationMock,
}));

type DownloadAndInstall = (onEvent?: (event: unknown) => void) => Promise<void>;

const createUpdate = (downloadAndInstall?: DownloadAndInstall) => ({
  version: "1.2.3",
  body: "Patch notes",
  downloadAndInstall: downloadAndInstall ?? vi.fn().mockResolvedValue(undefined),
});

describe("useAppUpdater", () => {
  let storeData: Map<string, unknown>;

  const flushPromises = async () => {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  };

  const runStartupCheck = async () => {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(UPDATER_STARTUP_CHECK_DELAY_MS);
    });
    await flushPromises();
  };

  beforeEach(() => {
    resetAppUpdaterSessionStateForTests();
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-27T12:00:00.000Z"));
    vi.stubGlobal("__TAURI_INTERNALS__", {});
    vi.stubEnv("VITE_MOCK_UPDATER", "false");

    const unregisterMock = vi.fn().mockResolvedValue(undefined);
    onActionMock.mockResolvedValue({ unregister: unregisterMock });

    getCurrentWebviewWindowMock.mockReturnValue({
      show: vi.fn().mockResolvedValue(undefined),
      unminimize: vi.fn().mockResolvedValue(undefined),
      setFocus: vi.fn().mockResolvedValue(undefined),
    });

    ensureNotificationPermissionMock.mockResolvedValue(true);
    showDesktopNotificationMock.mockResolvedValue(undefined);

    storeData = new Map<string, unknown>();
    storeLookupMock.mockResolvedValue(null);
    storeLoadMock.mockResolvedValue({
      get: storeGetMock,
      set: storeSetMock,
      save: storeSaveMock,
    });
    storeGetMock.mockImplementation(async (key: string) => storeData.get(key) ?? null);
    storeSetMock.mockImplementation(async (key: string, value: unknown) => {
      storeData.set(key, value);
    });
    storeSaveMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses fake updater data when VITE_MOCK_UPDATER is enabled", async () => {
    vi.stubEnv("VITE_MOCK_UPDATER", "true");

    const { result } = renderHook(() => useAppUpdater());
    await runStartupCheck();

    expect(result.current.status).toBe("available");
    expect(result.current.availableVersion).toBe("9.9.9-mock");
    expect(checkMock).not.toHaveBeenCalled();
    expect(showDesktopNotificationMock).toHaveBeenCalledTimes(1);
  });

  it("returns idle when no update is available", async () => {
    checkMock.mockResolvedValue(null);

    const { result } = renderHook(() => useAppUpdater());
    await runStartupCheck();

    expect(result.current.status).toBe("idle");
    expect(result.current.availableVersion).toBeNull();
  });

  it("detects update and exposes available state", async () => {
    checkMock.mockResolvedValue(createUpdate());

    const { result } = renderHook(() => useAppUpdater());
    await runStartupCheck();

    expect(result.current.status).toBe("available");
    expect(result.current.availableVersion).toBe("1.2.3");
    expect(result.current.releaseNotes).toBe("Patch notes");
  });

  it("sends startup notification only once per version", async () => {
    checkMock.mockResolvedValue(createUpdate());

    const firstSession = renderHook(() => useAppUpdater());
    await runStartupCheck();
    expect(showDesktopNotificationMock).toHaveBeenCalledTimes(1);

    firstSession.unmount();
    resetAppUpdaterSessionStateForTests();

    renderHook(() => useAppUpdater());
    await runStartupCheck();

    expect(checkMock).toHaveBeenCalledTimes(2);
    expect(showDesktopNotificationMock).toHaveBeenCalledTimes(1);
  });

  it("focuses app on update notification click without installing", async () => {
    const downloadAndInstallMock = vi.fn().mockResolvedValue(undefined);
    checkMock.mockResolvedValue(createUpdate(downloadAndInstallMock));

    renderHook(() => useAppUpdater());
    await runStartupCheck();

    expect(onActionMock).toHaveBeenCalledTimes(1);
    const actionHandler = onActionMock.mock.calls[0][0] as (notification: {
      extra?: Record<string, unknown>;
    }) => Promise<void>;

    await actionHandler({ extra: { kind: "app-update", version: "1.2.3" } });

    const windowApi = getCurrentWebviewWindowMock.mock.results[0]?.value;
    expect(windowApi.show).toHaveBeenCalledTimes(1);
    expect(windowApi.unminimize).toHaveBeenCalledTimes(1);
    expect(windowApi.setFocus).toHaveBeenCalledTimes(1);
    expect(downloadAndInstallMock).not.toHaveBeenCalled();
  });

  it("allows manual checks after startup check ran", async () => {
    checkMock.mockResolvedValue(null);

    const { result } = renderHook(() => useAppUpdater());
    await runStartupCheck();
    expect(checkMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.checkForUpdates();
    });
    await flushPromises();

    expect(checkMock).toHaveBeenCalledTimes(2);
  });

  it("tracks download progress and transitions to ready_to_restart", async () => {
    const downloadAndInstallMock = vi
      .fn()
      .mockImplementation(async (onEvent?: (event: unknown) => void) => {
        onEvent?.({ event: "Started", data: { contentLength: 200 } });
        onEvent?.({ event: "Progress", data: { chunkLength: 100 } });
        onEvent?.({ event: "Progress", data: { chunkLength: 100 } });
        onEvent?.({ event: "Finished" });
      });
    checkMock.mockResolvedValue(createUpdate(downloadAndInstallMock));

    const { result } = renderHook(() => useAppUpdater());
    await runStartupCheck();
    expect(result.current.status).toBe("available");

    await act(async () => {
      await result.current.installUpdate();
    });
    await flushPromises();

    expect(result.current.status).toBe("ready_to_restart");
    expect(result.current.progressPercent).toBe(100);
    expect(downloadAndInstallMock).toHaveBeenCalledTimes(1);
  });

  it("calls relaunch when restart is requested", async () => {
    checkMock.mockResolvedValue(createUpdate());
    relaunchMock.mockResolvedValue(undefined);

    const { result } = renderHook(() => useAppUpdater());
    await runStartupCheck();

    await act(async () => {
      await result.current.installUpdate();
    });
    await flushPromises();

    await act(async () => {
      await result.current.restartToApplyUpdate();
    });

    expect(relaunchMock).toHaveBeenCalledTimes(1);
  });

  it("hides banner when remindLater is used in ready_to_restart", async () => {
    checkMock.mockResolvedValue(createUpdate());

    const { result } = renderHook(() => useAppUpdater());
    await runStartupCheck();

    await act(async () => {
      await result.current.installUpdate();
    });
    await flushPromises();

    expect(result.current.status).toBe("ready_to_restart");
    expect(result.current.isBannerVisible).toBe(true);

    await act(async () => {
      await result.current.remindLater();
    });

    expect(result.current.isBannerVisible).toBe(false);
  });

  it("moves to error on failed install and allows retry", async () => {
    const downloadAndInstallMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(undefined);
    checkMock.mockResolvedValue(createUpdate(downloadAndInstallMock));

    const { result } = renderHook(() => useAppUpdater());
    await runStartupCheck();

    await act(async () => {
      await result.current.installUpdate();
    });
    await flushPromises();

    expect(result.current.status).toBe("error");

    await act(async () => {
      await result.current.installUpdate();
    });
    await flushPromises();

    expect(result.current.status).toBe("ready_to_restart");
    expect(downloadAndInstallMock).toHaveBeenCalledTimes(2);
  });
});
