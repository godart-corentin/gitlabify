import { clsx } from "clsx";
import { ArrowDownToLine, Moon, RefreshCw, RotateCcw, Settings2, Sun } from "lucide-react";
import type { KeyboardEvent } from "react";
import { useRef } from "react";

import type { UpdaterStatus } from "../../app-updater/model";
import type { ThemeMode } from "../model/useTheme";

type AppSettingsMenuProps = {
  theme: ThemeMode;
  onThemeChange: (mode: ThemeMode) => void;
  updaterStatus: UpdaterStatus;
  availableVersion: string | null;
  progressPercent: number | null;
  onInstallUpdate: () => Promise<void>;
  onRestartToApplyUpdate: () => Promise<void>;
};

const ESCAPE_KEY = "Escape";
const NO_UPDATE_AVAILABLE_LABEL = "Update unavailable";
const CHECKING_FOR_UPDATES_LABEL = "Checking...";
const RESTART_TO_APPLY_LABEL = "Restart to apply update";
const LIGHT_THEME: ThemeMode = "light";
const DARK_THEME: ThemeMode = "dark";

const formatProgressPercentLabel = (progressPercent: number | null) => {
  if (progressPercent === null) {
    return "Updating...";
  }

  return `Updating... ${progressPercent}%`;
};

const getUpdaterActionLabel = (
  updaterStatus: UpdaterStatus,
  availableVersion: string | null,
  progressPercent: number | null,
) => {
  if (updaterStatus === "checking") {
    return CHECKING_FOR_UPDATES_LABEL;
  }

  if (updaterStatus === "downloading") {
    return formatProgressPercentLabel(progressPercent);
  }

  if (updaterStatus === "available") {
    return availableVersion ? `Update to v${availableVersion}` : "Update now";
  }

  if (updaterStatus === "ready_to_restart") {
    return RESTART_TO_APPLY_LABEL;
  }

  return NO_UPDATE_AVAILABLE_LABEL;
};

const getUpdaterIndicatorLabel = (updaterStatus: UpdaterStatus) => {
  if (updaterStatus === "downloading") {
    return "Update in progress";
  }

  if (updaterStatus === "ready_to_restart") {
    return "Update ready to restart";
  }

  if (updaterStatus === "error") {
    return "Update failed";
  }

  return "Update available";
};

const hasUpdateIndicator = (updaterStatus: UpdaterStatus) =>
  updaterStatus === "available" ||
  updaterStatus === "downloading" ||
  updaterStatus === "ready_to_restart";

export const AppSettingsMenu = ({
  theme,
  onThemeChange,
  updaterStatus,
  availableVersion,
  progressPercent,
  onInstallUpdate,
  onRestartToApplyUpdate,
}: AppSettingsMenuProps) => {
  const menuRef = useRef<HTMLDetailsElement | null>(null);
  const updaterActionLabel = getUpdaterActionLabel(
    updaterStatus,
    availableVersion,
    progressPercent,
  );
  const updaterBusy =
    updaterStatus === "checking" ||
    updaterStatus === "downloading" ||
    updaterStatus === "idle" ||
    updaterStatus === "error";

  const closeMenu = () => {
    if (menuRef.current) {
      menuRef.current.open = false;
    }
  };

  const handleUpdaterAction = () => {
    if (updaterBusy) {
      return;
    }

    if (updaterStatus === "ready_to_restart") {
      void onRestartToApplyUpdate();
      return;
    }

    if (updaterStatus === "available") {
      void onInstallUpdate();
      return;
    }
  };

  const handleThemeToggle = () => {
    onThemeChange(theme === LIGHT_THEME ? DARK_THEME : LIGHT_THEME);
  };

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDetailsElement>) => {
    if (event.key !== ESCAPE_KEY) {
      return;
    }
    event.preventDefault();
    closeMenu();
  };

  const renderUpdaterIcon = () => {
    if (updaterStatus === "ready_to_restart") {
      return <RotateCcw className="h-4 w-4" />;
    }

    if (updaterStatus === "checking" || updaterStatus === "downloading") {
      return <RefreshCw className="h-4 w-4 animate-spin" />;
    }

    return <ArrowDownToLine className="h-4 w-4" />;
  };

  return (
    <details ref={menuRef} className="relative" onKeyDown={handleMenuKeyDown}>
      <summary
        className={clsx(
          "relative list-none [&::-webkit-details-marker]:hidden p-2 rounded-md text-base-content/60 hover:bg-base-200 transition-colors flex items-center justify-center",
          updaterStatus === "downloading" && "bg-base-content/10 text-base-content",
        )}
        aria-label="Theme settings"
      >
        <Settings2 className="h-4 w-4" />
        {hasUpdateIndicator(updaterStatus) ? (
          <span
            className={clsx(
              "absolute top-1 right-1 h-2 w-2 rounded-full",
              updaterStatus === "available" && "bg-warning",
              updaterStatus === "downloading" && "bg-info animate-pulse",
              updaterStatus === "ready_to_restart" && "bg-success",
            )}
            aria-label={getUpdaterIndicatorLabel(updaterStatus)}
          />
        ) : null}
      </summary>

      <div
        className="absolute right-0 mt-2 w-max border border-base-300 bg-base-100 rounded-md flex flex-col z-30"
        role="menu"
        aria-label="Settings options"
      >
        <button
          type="button"
          className={clsx(
            "w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-base-content/70 whitespace-nowrap hover:bg-base-200 transition-colors border-b border-base-300/70",
            updaterBusy &&
              "cursor-not-allowed bg-base-content/10 text-base-content/50 hover:bg-base-content/10",
          )}
          onClick={handleUpdaterAction}
          disabled={updaterBusy}
          role="menuitem"
        >
          {renderUpdaterIcon()}
          <span>{updaterActionLabel}</span>
        </button>

        <button
          type="button"
          className="w-full flex justify-center px-3 py-2 text-xs font-medium text-base-content/70 hover:bg-base-200 transition-colors"
          onClick={handleThemeToggle}
          role="menuitem"
          aria-label="Toggle theme"
        >
          <span className="grid grid-cols-[1rem_2rem_1rem] items-center gap-3">
            <Sun className="h-4 w-4" />
            <span
              className={clsx(
                "relative block h-4 w-8 rounded-full transition-colors",
                theme === DARK_THEME ? "bg-base-content/60" : "bg-base-300",
              )}
            >
              <span
                className={clsx(
                  "block h-4 w-4 rounded-full bg-base-100 ring-1 ring-base-300 transition-transform",
                  theme === DARK_THEME ? "translate-x-4" : "translate-x-0",
                )}
              />
            </span>
            <Moon className="h-4 w-4" />
          </span>
        </button>
      </div>
    </details>
  );
};
