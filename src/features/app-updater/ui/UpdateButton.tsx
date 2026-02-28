import { ArrowDownToLine, RefreshCw, RotateCcw } from "lucide-react";

import type { UpdaterStatus } from "../model/useAppUpdater";

type UpdateButtonProps = {
  status: UpdaterStatus;
  availableVersion: string | null;
  onInstallUpdate: () => Promise<void>;
  onRestartToApplyUpdate: () => Promise<void>;
};

export const UpdateButton = ({
  status,
  availableVersion,
  onInstallUpdate,
  onRestartToApplyUpdate,
}: UpdateButtonProps) => {
  if (status === "idle" || status === "checking" || status === "error") {
    return null;
  }

  const handleClick = () => {
    if (status === "available") {
      void onInstallUpdate();
    } else if (status === "ready_to_restart") {
      void onRestartToApplyUpdate();
    }
  };

  const isDisabled = status === "downloading";

  const ariaLabel =
    status === "available"
      ? `Update to v${availableVersion ?? ""}`
      : status === "downloading"
        ? "Installing update…"
        : "Restart to apply update";

  const className =
    status === "available"
      ? "border border-warning/60 bg-warning/10 text-warning hover:bg-warning/20 w-6 h-6 rounded-md transition-colors flex items-center justify-center shrink-0 cursor-pointer"
      : status === "downloading"
        ? "border border-info/60 bg-info/10 text-info cursor-not-allowed w-6 h-6 rounded-md flex items-center justify-center shrink-0"
        : "border border-success/60 bg-success/10 text-success hover:bg-success/20 w-6 h-6 rounded-md transition-colors flex items-center justify-center shrink-0";

  return (
    <button
      type="button"
      className={className}
      aria-label={ariaLabel}
      onClick={handleClick}
      disabled={isDisabled}
    >
      {status === "available" ? <ArrowDownToLine className="h-3 w-3" /> : null}
      {status === "downloading" ? <RefreshCw className="h-3 w-3 animate-spin" /> : null}
      {status === "ready_to_restart" ? <RotateCcw className="h-3 w-3" /> : null}
    </button>
  );
};
