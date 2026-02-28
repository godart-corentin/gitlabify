import type { ReactNode } from "react";

import type { User } from "../../../entities/inbox/model";
import type { UpdaterState } from "../../../features/app-updater/model";
import { UpdateBanner } from "../../../features/app-updater/ui";
import type { ThemeMode } from "../../../features/theme-switcher/model/useTheme";
import { AppSettingsMenu } from "../../../features/theme-switcher/ui/AppSettingsMenu";
import { Avatar } from "../../../shared/ui/avatar/Avatar";

type AppShellProps = {
  user: User;
  isOffline?: boolean;
  theme: ThemeMode;
  onThemeChange: (mode: ThemeMode) => void;
  onLogout: () => void;
  updater: UpdaterState;
  children: ReactNode;
};

export const AppShell = ({
  user,
  isOffline,
  theme,
  onThemeChange,
  onLogout,
  updater,
  children,
}: AppShellProps) => {
  return (
    <main className="flex flex-col h-screen bg-base-100 text-base-content overflow-hidden">
      <header className="flex items-center justify-between h-14 px-4 border-b border-base-300 bg-base-100 flex-shrink-0 z-20">
        <div className="flex items-center gap-2">
          <span className="text-xl">🦊</span>
          <div className="flex flex-col leading-none">
            <h1 className="text-sm font-medium tracking-tight">gitlabify</h1>
            {isOffline ? (
              <span className="text-[10px] uppercase tracking-widest font-semibold text-base-content/50 border border-base-300 rounded-full px-2 py-0.5">
                Offline
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end leading-none">
            <span className="text-xs font-mono text-base-content/60">{user.username}</span>
          </div>

          <AppSettingsMenu
            theme={theme}
            onThemeChange={onThemeChange}
            updaterStatus={updater.status}
            availableVersion={updater.availableVersion}
            progressPercent={updater.progressPercent}
            onInstallUpdate={updater.installUpdate}
            onRestartToApplyUpdate={updater.restartToApplyUpdate}
          />
          <Avatar src={user.avatarUrl} alt={user.name || "User"} size="sm" />

          <button
            onClick={onLogout}
            type="button"
            className="text-xs font-medium text-base-content/60 hover:text-base-content border-l border-base-300 pl-3"
          >
            Sign out
          </button>
        </div>
      </header>

      {updater.isBannerVisible ? (
        <UpdateBanner
          status={updater.status}
          availableVersion={updater.availableVersion}
          releaseNotes={updater.releaseNotes}
          progressPercent={updater.progressPercent}
          errorMessage={updater.errorMessage}
          onInstallUpdate={updater.installUpdate}
          onRestartToApplyUpdate={updater.restartToApplyUpdate}
          onRemindLater={updater.remindLater}
        />
      ) : null}

      <div className="flex-1 overflow-hidden relative">{children}</div>
    </main>
  );
};
