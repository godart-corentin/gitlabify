import type { DownloadEvent } from "@tauri-apps/plugin-updater";

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

export type UpdateMetadata = {
  version: string;
  body?: string;
  downloadAndInstall: (onEvent?: (progress: DownloadEvent) => void) => Promise<void>;
};

export type UpdaterSnapshot = {
  status: UpdaterStatus;
  availableUpdate: UpdateMetadata | null;
  availableVersion: string | null;
  releaseNotes: string | null;
  progressPercent: number | null;
  errorMessage: string | null;
  dismissedBannerKey: string | null;
};

export type CheckForUpdatesOptions = {
  shouldNotify: boolean;
};

export type InstallProgressState = {
  downloadedBytes: number;
  totalBytes: number | null;
  progressPercent: number | null;
};
