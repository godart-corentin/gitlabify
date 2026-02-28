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
  const onThemeChange = vi.fn();
  const onLogout = vi.fn();
  const installUpdate = vi.fn(async () => undefined);
  const restartToApplyUpdate = vi.fn(async () => undefined);
  const remindLater = vi.fn(async () => undefined);

  beforeEach(() => {
    onThemeChange.mockReset();
    onLogout.mockReset();
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

  const openSettingsMenu = () => {
    fireEvent.click(screen.getByLabelText("Theme settings"));
  };

  it("shows Update unavailable in settings when updater is idle", () => {
    const updater = createUpdaterFixture();

    render(
      <AppShell
        user={USER_FIXTURE}
        theme="light"
        onThemeChange={onThemeChange}
        onLogout={onLogout}
        updater={updater}
      >
        <div>content</div>
      </AppShell>,
    );

    openSettingsMenu();

    const unavailableButton = screen.getByRole("menuitem", { name: "Update unavailable" });
    expect((unavailableButton as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows available update banner and triggers install from settings", () => {
    const updater = createUpdaterFixture({
      status: "available",
      availableVersion: "1.2.3",
      releaseNotes: "Important update",
    });

    render(
      <AppShell
        user={USER_FIXTURE}
        theme="light"
        onThemeChange={onThemeChange}
        onLogout={onLogout}
        updater={updater}
      >
        <div>content</div>
      </AppShell>,
    );

    expect(screen.queryByText("Update v1.2.3 is available")).not.toBeNull();
    expect(screen.queryByLabelText("Update available")).not.toBeNull();

    openSettingsMenu();

    const updateButton = screen.getByRole("menuitem", { name: "Update to v1.2.3" });
    fireEvent.click(updateButton);

    expect(installUpdate).toHaveBeenCalledTimes(1);
  });

  it("hides available banner on later without disabling settings update action", () => {
    const updater = createUpdaterFixture({
      status: "available",
      availableVersion: "1.2.3",
      releaseNotes: "Important update",
    });

    const { rerender } = render(
      <AppShell
        user={USER_FIXTURE}
        theme="light"
        onThemeChange={onThemeChange}
        onLogout={onLogout}
        updater={updater}
      >
        <div>content</div>
      </AppShell>,
    );

    const laterButton = screen.getByRole("button", { name: "Later" });
    fireEvent.click(laterButton);

    expect(remindLater).toHaveBeenCalledTimes(1);

    const hiddenBannerUpdater = {
      ...updater,
      isBannerVisible: false,
    };

    rerender(
      <AppShell
        user={USER_FIXTURE}
        theme="light"
        onThemeChange={onThemeChange}
        onLogout={onLogout}
        updater={hiddenBannerUpdater}
      >
        <div>content</div>
      </AppShell>,
    );

    expect(screen.queryByText("Update v1.2.3 is available")).toBeNull();

    openSettingsMenu();
    const updateButton = screen.getByRole("menuitem", { name: "Update to v1.2.3" });
    expect((updateButton as HTMLButtonElement).disabled).toBe(false);
  });

  it("shows disabled updating state in settings while update is downloading", () => {
    const updater = createUpdaterFixture({
      status: "downloading",
      availableVersion: "1.2.3",
      progressPercent: 52,
    });

    render(
      <AppShell
        user={USER_FIXTURE}
        theme="light"
        onThemeChange={onThemeChange}
        onLogout={onLogout}
        updater={updater}
      >
        <div>content</div>
      </AppShell>,
    );

    expect(screen.queryByText("Updating to v1.2.3")).not.toBeNull();

    openSettingsMenu();

    const updatingButton = screen.getByRole("menuitem", { name: "Updating... 52%" });

    expect((updatingButton as HTMLButtonElement).disabled).toBe(true);
  });

  it("triggers restart action when update is ready to restart", () => {
    const updater = createUpdaterFixture({
      status: "ready_to_restart",
      availableVersion: "1.2.3",
    });

    render(
      <AppShell
        user={USER_FIXTURE}
        theme="light"
        onThemeChange={onThemeChange}
        onLogout={onLogout}
        updater={updater}
      >
        <div>content</div>
      </AppShell>,
    );

    expect(screen.queryByText("Update installed")).not.toBeNull();

    openSettingsMenu();

    const restartButton = screen.getByRole("menuitem", { name: "Restart to apply update" });
    fireEvent.click(restartButton);

    expect(restartToApplyUpdate).toHaveBeenCalledTimes(1);
  });
});
