import type { DownloadEvent } from "@tauri-apps/plugin-updater";

import {
  MAX_PROGRESS_PERCENT,
  MIN_PROGRESS_PERCENT,
  PERCENTAGE_MULTIPLIER,
} from "./updaterConstants";
import type { InstallProgressState } from "./updaterTypes";

const clampProgressPercent = (value: number) =>
  Math.min(MAX_PROGRESS_PERCENT, Math.max(MIN_PROGRESS_PERCENT, value));

export const createInstallProgressState = (): InstallProgressState => ({
  downloadedBytes: 0,
  totalBytes: null,
  progressPercent: null,
});

export const getNextInstallProgressState = (
  state: InstallProgressState,
  progress: DownloadEvent,
): InstallProgressState => {
  if (progress.event === "Started") {
    return {
      downloadedBytes: 0,
      totalBytes: progress.data.contentLength ?? null,
      progressPercent: MIN_PROGRESS_PERCENT,
    };
  }

  if (progress.event === "Progress") {
    const downloadedBytes = state.downloadedBytes + progress.data.chunkLength;
    const totalBytes = state.totalBytes;

    if (!totalBytes || totalBytes <= 0) {
      return {
        downloadedBytes,
        totalBytes,
        progressPercent: null,
      };
    }

    const downloadRatio = downloadedBytes / totalBytes;

    return {
      downloadedBytes,
      totalBytes,
      progressPercent: clampProgressPercent(Math.round(downloadRatio * PERCENTAGE_MULTIPLIER)),
    };
  }

  return {
    ...state,
    progressPercent: MAX_PROGRESS_PERCENT,
  };
};
