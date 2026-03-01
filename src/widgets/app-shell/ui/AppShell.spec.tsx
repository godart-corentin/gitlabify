import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UpdaterState } from "../../../features/app-updater/model";

import { AppShell } from "./AppShell";

const USER_FIXTURE = {
  id: 1,
  username: "corentin",
  name: "Corentin",
  avatarUrl: null,
} as const;

describe("AppShell", () => {
  const onLogout = vi.fn();
  const onTogglePin = vi.fn();
  const onSnapToTray = vi.fn();
  const installUpdate = vi.fn(async () => undefined);
  const restartToApplyUpdate = vi.fn(async () => undefined);
  const remindLater = vi.fn(async () => undefined);

  beforeEach(() => {
    onLogout.mockReset();
    onTogglePin.mockReset();
    onSnapToTray.mockReset();
    installUpdate.mockReset();
    restartToApplyUpdate.mockReset();
    remindLater.mockReset();
  });

  const createUpdaterFixture = (overrides?: Partial<UpdaterState>): UpdaterState => ({
    status: "idle",
    availableVersion: null,
    releaseNotes: null,
    progressPercent: null,
    errorMessage: null,
    isBannerVisible: true,
    checkForUpdates: vi.fn(async () => undefined),
    installUpdate,
    restartToApplyUpdate,
    remindLater,
    ...overrides,
  });

  it("hides the update button when updater is idle", () => {
    const updater = createUpdaterFixture();

    render(
      <AppShell
        user={USER_FIXTURE}
        onLogout={onLogout}
        onTogglePin={onTogglePin}
        onSnapToTray={onSnapToTray}
        isPinned={false}
        updater={updater}
      >
        <div>content</div>
      </AppShell>,
    );

    expect(screen.queryByRole("button", { name: /update to/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /installing update/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /restart to apply update/i })).toBeNull();
  });

  it("shows warning update button when update is available and triggers install on click", () => {
    const updater = createUpdaterFixture({
      status: "available",
      availableVersion: "1.2.3",
      releaseNotes: "Important update",
    });

    render(
      <AppShell
        user={USER_FIXTURE}
        onLogout={onLogout}
        onTogglePin={onTogglePin}
        onSnapToTray={onSnapToTray}
        isPinned={false}
        updater={updater}
      >
        <div>content</div>
      </AppShell>,
    );

    expect(screen.queryByText("Update v1.2.3 is available")).not.toBeNull();

    const updateButton = screen.getByRole("button", { name: "Update to v1.2.3" });
    expect((updateButton as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(updateButton);
    expect(installUpdate).toHaveBeenCalledTimes(1);
  });

  it("shows disabled info update button while update is downloading", () => {
    const updater = createUpdaterFixture({
      status: "downloading",
      availableVersion: "1.2.3",
      progressPercent: 52,
    });

    render(
      <AppShell
        user={USER_FIXTURE}
        onLogout={onLogout}
        onTogglePin={onTogglePin}
        onSnapToTray={onSnapToTray}
        isPinned={false}
        updater={updater}
      >
        <div>content</div>
      </AppShell>,
    );

    expect(screen.queryByText("Updating to v1.2.3")).not.toBeNull();

    const downloadingButton = screen.getByRole("button", { name: "Installing update…" });
    expect((downloadingButton as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows success restart button when update is ready and triggers restart on click", () => {
    const updater = createUpdaterFixture({
      status: "ready_to_restart",
      availableVersion: "1.2.3",
    });

    render(
      <AppShell
        user={USER_FIXTURE}
        onLogout={onLogout}
        onTogglePin={onTogglePin}
        onSnapToTray={onSnapToTray}
        isPinned={false}
        updater={updater}
      >
        <div>content</div>
      </AppShell>,
    );

    expect(screen.queryByText("Update installed")).not.toBeNull();

    const restartButton = screen.getByRole("button", { name: "Restart to apply update" });
    fireEvent.click(restartButton);

    expect(restartToApplyUpdate).toHaveBeenCalledTimes(1);
  });

  it("hides banner on remind later but keeps update button visible in header", () => {
    const updater = createUpdaterFixture({
      status: "available",
      availableVersion: "1.2.3",
      releaseNotes: "Important update",
    });

    const { rerender } = render(
      <AppShell
        user={USER_FIXTURE}
        onLogout={onLogout}
        onTogglePin={onTogglePin}
        onSnapToTray={onSnapToTray}
        isPinned={false}
        updater={updater}
      >
        <div>content</div>
      </AppShell>,
    );

    const laterButton = screen.getByRole("button", { name: "Later" });
    fireEvent.click(laterButton);
    expect(remindLater).toHaveBeenCalledTimes(1);

    const hiddenBannerUpdater = { ...updater, isBannerVisible: false };
    rerender(
      <AppShell
        user={USER_FIXTURE}
        onLogout={onLogout}
        onTogglePin={onTogglePin}
        onSnapToTray={onSnapToTray}
        isPinned={false}
        updater={hiddenBannerUpdater}
      >
        <div>content</div>
      </AppShell>,
    );

    expect(screen.queryByText("Update v1.2.3 is available")).toBeNull();
    expect(screen.getByRole("button", { name: "Update to v1.2.3" })).not.toBeNull();
  });
});
