import { beforeEach, describe, expect, it, vi } from "vitest";

const { captureExceptionMock, captureMessageMock } = vi.hoisted(() => ({
  captureExceptionMock: vi.fn(),
  captureMessageMock: vi.fn(),
}));

vi.mock("./sentry", () => ({
  Sentry: {
    captureException: captureExceptionMock,
    captureMessage: captureMessageMock,
  },
}));

import { reportFrontendError, reportFrontendWarning } from "./frontendErrorReporting";

describe("frontendErrorReporting", () => {
  beforeEach(() => {
    captureExceptionMock.mockReset();
    captureMessageMock.mockReset();
    vi.restoreAllMocks();
  });

  it("logs warnings locally in development and sends Error warnings to Sentry with exception context", () => {
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = new Error("listener cleanup failed");

    reportFrontendWarning("Failed to unregister listener", {
      error,
      feature: "inbox-notifications",
      action: "unregister-listener",
      extra: { source: "onAction" },
    });

    expect(consoleWarnSpy).toHaveBeenCalledWith("Failed to unregister listener", error);
    expect(captureExceptionMock).toHaveBeenCalledWith(
      error,
      expect.objectContaining({
        level: "warning",
        tags: {
          action: "unregister-listener",
          feature: "inbox-notifications",
        },
        extra: {
          cause: "listener cleanup failed",
          source: "onAction",
        },
      }),
    );
    expect(captureMessageMock).not.toHaveBeenCalled();
  });

  it("captures errors with Sentry exception handling and logs them locally in development", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("store unavailable");

    reportFrontendError("Failed to persist theme preference", {
      error,
      feature: "theme-switcher",
      action: "persist-theme",
      extra: { mode: "dark" },
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to persist theme preference", error);
    expect(captureExceptionMock).toHaveBeenCalledWith(
      error,
      expect.objectContaining({
        extra: {
          cause: "store unavailable",
          mode: "dark",
        },
        tags: {
          action: "persist-theme",
          feature: "theme-switcher",
        },
      }),
    );
  });

  it("falls back to Sentry message capture when no Error instance is provided", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    reportFrontendError("Failed to pin window", {
      error: "pin failed",
      feature: "window-pin",
      action: "toggle-pin",
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to pin window", "pin failed");
    expect(captureMessageMock).toHaveBeenCalledWith(
      "Failed to pin window",
      expect.objectContaining({
        level: "error",
        tags: {
          action: "toggle-pin",
          feature: "window-pin",
        },
        extra: {
          cause: "pin failed",
        },
      }),
    );
  });
});
