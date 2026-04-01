import { MAX_PROGRESS_PERCENT, MIN_PROGRESS_PERCENT } from "./updaterConstants";
import type { UpdateMetadata, UpdaterSnapshot, UpdaterStatus } from "./updaterTypes";

export const getReleaseNotes = (body: string | undefined) => {
  if (typeof body !== "string") {
    return null;
  }

  const trimmedBody = body.trim();
  if (trimmedBody.length === 0) {
    return null;
  }

  return trimmedBody;
};

export const createIdleUpdaterSnapshot = (): UpdaterSnapshot => ({
  status: "idle",
  availableUpdate: null,
  availableVersion: null,
  releaseNotes: null,
  progressPercent: null,
  errorMessage: null,
  dismissedBannerKey: null,
});

export const getBannerDismissKey = (
  status: UpdaterStatus,
  availableVersion: string | null,
): string | null => {
  if (status === "available" || status === "ready_to_restart" || status === "error") {
    return `${status}:${availableVersion ?? "none"}`;
  }

  return null;
};

export const createUpdaterCheckingState = (state: UpdaterSnapshot): UpdaterSnapshot => ({
  ...state,
  status: "checking",
  errorMessage: null,
});

export const applyAvailableUpdate = (
  state: UpdaterSnapshot,
  update: UpdateMetadata,
): UpdaterSnapshot => {
  const availableDismissKey = getBannerDismissKey("available", update.version);

  return {
    ...state,
    status: "available",
    availableUpdate: update,
    availableVersion: update.version,
    releaseNotes: getReleaseNotes(update.body),
    progressPercent: null,
    errorMessage: null,
    dismissedBannerKey:
      state.dismissedBannerKey === availableDismissKey ? state.dismissedBannerKey : null,
  };
};

export const createUpdaterInstallStartingState = (state: UpdaterSnapshot): UpdaterSnapshot => ({
  ...state,
  status: "downloading",
  errorMessage: null,
  progressPercent: MIN_PROGRESS_PERCENT,
});

export const createUpdaterProgressState = (
  state: UpdaterSnapshot,
  progressPercent: number | null,
): UpdaterSnapshot => ({
  ...state,
  progressPercent,
});

export const createUpdaterReadyToRestartState = (state: UpdaterSnapshot): UpdaterSnapshot => ({
  ...state,
  status: "ready_to_restart",
  availableUpdate: null,
  progressPercent: MAX_PROGRESS_PERCENT,
});

export const createUpdaterErrorState = (
  state: UpdaterSnapshot,
  errorMessage: string,
): UpdaterSnapshot => ({
  ...state,
  status: "error",
  errorMessage,
  progressPercent: null,
});
