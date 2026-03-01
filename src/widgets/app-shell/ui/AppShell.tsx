import { clsx } from "clsx";
import { Locate, Pin, PinOff } from "lucide-react";
import type { ReactNode } from "react";

import type { User } from "../../../entities/inbox/model";
import type { UpdaterState } from "../../../features/app-updater/model";
import { UpdateBanner, UpdateButton } from "../../../features/app-updater/ui";
import { Avatar } from "../../../shared/ui/avatar/Avatar";

type AppShellProps = {
  user: User;
  isOffline?: boolean;
  isPinned: boolean;
  onLogout: () => void;
  onTogglePin: () => void;
  onSnapToTray: () => void;
  updater: UpdaterState;
  children: ReactNode;
};

const ICON_BUTTON_CLASS =
  "flex items-center justify-center w-6 h-6 rounded text-base-content/60 hover:text-base-content hover:bg-base-200 transition-colors";

export const AppShell = ({
  user,
  isOffline,
  isPinned,
  onLogout,
  onTogglePin,
  onSnapToTray,
  updater,
  children,
}: AppShellProps) => {
  return (
    <main className="flex flex-col h-screen bg-base-100 text-base-content overflow-hidden">
      <header
        data-tauri-drag-region={!isPinned || undefined}
        className="flex items-center justify-between h-14 px-4 border-b border-base-300 bg-base-100 flex-shrink-0 z-20"
      >
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
          <UpdateButton
            status={updater.status}
            availableVersion={updater.availableVersion}
            onInstallUpdate={updater.installUpdate}
            onRestartToApplyUpdate={updater.restartToApplyUpdate}
          />

          {!isPinned ? (
            <button
              type="button"
              onClick={onSnapToTray}
              className={ICON_BUTTON_CLASS}
              aria-label="Reset to tray position"
              title="Reset to tray position"
            >
              <Locate size={14} />
            </button>
          ) : null}

          <button
            type="button"
            onClick={onTogglePin}
            className={clsx(ICON_BUTTON_CLASS, !isPinned && "text-primary")}
            aria-label={isPinned ? "Float window" : "Snap to tray"}
            title={isPinned ? "Float window" : "Snap to tray"}
          >
            {isPinned ? <PinOff size={14} /> : <Pin size={14} />}
          </button>

          <div className="flex flex-col items-end leading-none">
            <span className="text-xs font-mono text-base-content/60">{user.username}</span>
          </div>
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
