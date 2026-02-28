import { sendNotification } from "@tauri-apps/plugin-notification";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { showDesktopNotification } from "./notificationDelivery";

vi.mock("@tauri-apps/plugin-notification", () => ({
  sendNotification: vi.fn(),
  isPermissionGranted: vi.fn(),
  requestPermission: vi.fn(),
  createChannel: vi.fn(),
  Importance: {
    High: 1,
    Default: 2,
  },
}));

describe("notificationDelivery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("__TAURI_INTERNALS__", undefined);
  });

  it("calls sendNotification with autoCancel: true when in Tauri runtime", async () => {
    // Mock Tauri runtime
    vi.stubGlobal("__TAURI_INTERNALS__", {});

    await showDesktopNotification({
      title: "Test Title",
      body: "Test Body",
      url: "https://gitlab.com",
    });

    expect(sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Test Title",
        body: "Test Body",
        autoCancel: true,
        extra: { url: "https://gitlab.com" },
      }),
    );
  });

  it("merges custom extra payload with url in Tauri runtime", async () => {
    vi.stubGlobal("__TAURI_INTERNALS__", {});

    await showDesktopNotification({
      title: "Update available",
      body: "Click to open app",
      url: "https://gitlab.com",
      extra: { kind: "app-update", version: "1.2.3" },
    });

    expect(sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        extra: {
          kind: "app-update",
          version: "1.2.3",
          url: "https://gitlab.com",
        },
      }),
    );
  });
});
