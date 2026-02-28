import { clsx } from "clsx";
import { ArrowDownToLine, RotateCcw } from "lucide-react";

import type { UpdaterStatus } from "../model/useAppUpdater";

type UpdateBannerProps = {
  status: UpdaterStatus;
  availableVersion: string | null;
  releaseNotes: string | null;
  progressPercent: number | null;
  errorMessage: string | null;
  onInstallUpdate: () => Promise<void>;
  onRestartToApplyUpdate: () => Promise<void>;
  onRemindLater: () => Promise<void>;
};

const MAX_PROGRESS_PERCENT = 100;

const formatProgressText = (progressPercent: number | null) => {
  if (progressPercent === null) {
    return "Preparing download...";
  }

  return `Downloading update... ${progressPercent}%`;
};

export const UpdateBanner = ({
  status,
  availableVersion,
  releaseNotes,
  progressPercent,
  onInstallUpdate,
  onRestartToApplyUpdate,
  onRemindLater,
}: UpdateBannerProps) => {
  if (status === "idle" || status === "checking" || status === "error") {
    return null;
  }

  const handleInstallUpdate = () => {
    void onInstallUpdate();
  };

  const handleRestartToApplyUpdate = () => {
    void onRestartToApplyUpdate();
  };

  const handleRemindLater = () => {
    void onRemindLater();
  };

  const heading =
    status === "available"
      ? `Update v${availableVersion ?? ""} is available`
      : status === "downloading"
        ? `Updating to v${availableVersion ?? ""}`
        : "Update installed";

  const message =
    status === "available"
      ? (releaseNotes ?? "A new Gitlabify release is ready to install.")
      : status === "downloading"
        ? formatProgressText(progressPercent)
        : `Restart Gitlabify to apply v${availableVersion ?? ""}.`;

  return (
    <section
      className={clsx(
        "mx-3 mt-3 rounded-md border px-3 py-2 text-xs",
        "border-warning/40 bg-warning/10 text-base-content",
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 font-semibold text-base-content">
        <ArrowDownToLine className="h-4 w-4" />
        <span>{heading}</span>
      </div>
      <p className="mt-1 text-xs text-base-content/70">{message}</p>

      {status === "downloading" ? (
        <div className="mt-3">
          <progress
            className="progress progress-info h-2 w-full"
            value={progressPercent ?? 0}
            max={MAX_PROGRESS_PERCENT}
          />
        </div>
      ) : null}

      <div className="mt-3 flex items-center gap-2">
        {status === "available" ? (
          <button type="button" className="btn btn-xs btn-warning" onClick={handleInstallUpdate}>
            Update now
          </button>
        ) : null}

        {status === "ready_to_restart" ? (
          <button
            type="button"
            className="btn btn-xs btn-success"
            onClick={handleRestartToApplyUpdate}
          >
            <RotateCcw className="h-3 w-3" />
            Restart now
          </button>
        ) : null}

        {status === "available" || status === "ready_to_restart" ? (
          <button type="button" className="btn btn-xs btn-ghost" onClick={handleRemindLater}>
            Later
          </button>
        ) : null}
      </div>
    </section>
  );
};
