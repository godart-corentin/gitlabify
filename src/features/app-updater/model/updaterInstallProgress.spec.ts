import { describe, expect, it } from "vitest";

import { getNextInstallProgressState } from "./updaterInstallProgress";
import type { InstallProgressState } from "./updaterTypes";

const createProgressState = (overrides?: Partial<InstallProgressState>): InstallProgressState => ({
  downloadedBytes: 0,
  totalBytes: null,
  progressPercent: null,
  ...overrides,
});

describe("updaterInstallProgress", () => {
  it("resets byte counters and progress to zero when a download starts", () => {
    const nextState = getNextInstallProgressState(
      createProgressState({
        downloadedBytes: 50,
        totalBytes: 100,
        progressPercent: 50,
      }),
      {
        event: "Started",
        data: {
          contentLength: 200,
        },
      },
    );

    expect(nextState).toEqual({
      downloadedBytes: 0,
      totalBytes: 200,
      progressPercent: 0,
    });
  });

  it("computes rounded progress percentage from known total bytes", () => {
    const nextState = getNextInstallProgressState(
      createProgressState({
        downloadedBytes: 0,
        totalBytes: 200,
        progressPercent: 0,
      }),
      {
        event: "Progress",
        data: {
          chunkLength: 101,
        },
      },
    );

    expect(nextState.progressPercent).toBe(51);
    expect(nextState.downloadedBytes).toBe(101);
  });

  it("keeps progress unset when total bytes are unknown or invalid", () => {
    const unknownTotalState = getNextInstallProgressState(createProgressState(), {
      event: "Progress",
      data: {
        chunkLength: 25,
      },
    });

    expect(unknownTotalState.progressPercent).toBeNull();

    const zeroTotalState = getNextInstallProgressState(
      createProgressState({
        totalBytes: 0,
      }),
      {
        event: "Progress",
        data: {
          chunkLength: 25,
        },
      },
    );

    expect(zeroTotalState.progressPercent).toBeNull();
  });

  it("marks download progress as complete when the installer finishes", () => {
    const nextState = getNextInstallProgressState(
      createProgressState({
        downloadedBytes: 100,
        totalBytes: 200,
        progressPercent: 50,
      }),
      {
        event: "Finished",
      },
    );

    expect(nextState.progressPercent).toBe(100);
  });

  it("clamps computed percentage into the 0 to 100 range", () => {
    const nextState = getNextInstallProgressState(
      createProgressState({
        downloadedBytes: 99,
        totalBytes: 100,
        progressPercent: 99,
      }),
      {
        event: "Progress",
        data: {
          chunkLength: 100,
        },
      },
    );

    expect(nextState.progressPercent).toBe(100);
  });
});
