import { check } from "@tauri-apps/plugin-updater";

import {
  MOCK_UPDATER_ENV_FLAG,
  MOCK_UPDATER_INSTALL_DELAY_MS,
  MOCK_UPDATER_VERSION,
  TAURI_INTERNALS_WINDOW_KEY,
} from "./updaterConstants";
import type { UpdateMetadata } from "./updaterTypes";

type TauriWindow = Window & {
  __TAURI_INTERNALS__?: unknown;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isString = (value: unknown): value is string => typeof value === "string";

export const isTauriRuntime = () => {
  if (typeof window === "undefined") {
    return false;
  }

  return TAURI_INTERNALS_WINDOW_KEY in (window as TauriWindow);
};

export const isMockUpdaterEnabled = () =>
  import.meta.env.VITE_MOCK_UPDATER === MOCK_UPDATER_ENV_FLAG;

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

export const isUpdateMetadata = (value: unknown): value is UpdateMetadata => {
  if (!isObject(value)) {
    return false;
  }

  return isString(value.version) && typeof value.downloadAndInstall === "function";
};

export const checkForAvailableUpdate = async (): Promise<UpdateMetadata | null> => {
  const checkResult = isMockUpdaterEnabled() ? createMockUpdate() : await check();

  if (!isUpdateMetadata(checkResult)) {
    return null;
  }

  return checkResult;
};
