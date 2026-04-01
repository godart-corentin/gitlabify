import { describe, expect, it } from "vitest";

import {
  applyAvailableUpdate,
  createIdleUpdaterSnapshot,
  createUpdaterErrorState,
  createUpdaterReadyToRestartState,
  getBannerDismissKey,
} from "./updaterState";
import type { UpdateMetadata, UpdaterSnapshot } from "./updaterTypes";

const createUpdate = (overrides?: Partial<UpdateMetadata>): UpdateMetadata => ({
  version: "1.2.3",
  body: "Patch notes",
  downloadAndInstall: async () => undefined,
  ...overrides,
});

const createSnapshot = (overrides?: Partial<UpdaterSnapshot>): UpdaterSnapshot => ({
  ...createIdleUpdaterSnapshot(),
  ...overrides,
});

describe("updaterState", () => {
  it("creates an idle updater snapshot with cleared updater-facing fields", () => {
    expect(createIdleUpdaterSnapshot()).toEqual({
      status: "idle",
      availableUpdate: null,
      availableVersion: null,
      releaseNotes: null,
      progressPercent: null,
      errorMessage: null,
      dismissedBannerKey: null,
    });
  });

  it("applies an available update and clears stale error state", () => {
    const nextState = applyAvailableUpdate(
      createSnapshot({
        status: "error",
        errorMessage: "network down",
        progressPercent: 42,
      }),
      createUpdate(),
    );

    expect(nextState.status).toBe("available");
    expect(nextState.availableVersion).toBe("1.2.3");
    expect(nextState.releaseNotes).toBe("Patch notes");
    expect(nextState.progressPercent).toBeNull();
    expect(nextState.errorMessage).toBeNull();
  });

  it("keeps the dismiss key only when the same available banner is still active", () => {
    const nextState = applyAvailableUpdate(
      createSnapshot({
        dismissedBannerKey: "available:1.2.3",
      }),
      createUpdate(),
    );

    expect(nextState.dismissedBannerKey).toBe("available:1.2.3");

    const changedVersionState = applyAvailableUpdate(
      createSnapshot({
        dismissedBannerKey: "available:1.0.0",
      }),
      createUpdate(),
    );

    expect(changedVersionState.dismissedBannerKey).toBeNull();
  });

  it("returns dismiss keys only for banner-bearing updater states", () => {
    expect(getBannerDismissKey("idle", null)).toBeNull();
    expect(getBannerDismissKey("checking", null)).toBeNull();
    expect(getBannerDismissKey("downloading", "1.2.3")).toBeNull();
    expect(getBannerDismissKey("available", "1.2.3")).toBe("available:1.2.3");
    expect(getBannerDismissKey("ready_to_restart", "1.2.3")).toBe("ready_to_restart:1.2.3");
    expect(getBannerDismissKey("error", null)).toBe("error:none");
  });

  it("creates ready_to_restart and error states with expected banner behavior", () => {
    const readyState = createUpdaterReadyToRestartState(
      createSnapshot({
        availableUpdate: createUpdate(),
        availableVersion: "1.2.3",
        releaseNotes: "Patch notes",
      }),
    );

    expect(readyState.status).toBe("ready_to_restart");
    expect(readyState.availableUpdate).toBeNull();
    expect(readyState.progressPercent).toBe(100);

    const errorState = createUpdaterErrorState(readyState, "Unable to install update.");

    expect(errorState.status).toBe("error");
    expect(errorState.errorMessage).toBe("Unable to install update.");
    expect(errorState.progressPercent).toBeNull();
    expect(getBannerDismissKey(errorState.status, errorState.availableVersion)).toBe("error:1.2.3");
  });
});
