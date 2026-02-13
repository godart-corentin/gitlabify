import { openUrl } from "@tauri-apps/plugin-opener";
import { clsx } from "clsx";
import { Copy } from "lucide-react";
import type { MouseEvent } from "react";

import { formatShortRelativeTime } from "../../../shared/lib/date/formatShortRelativeTime";
import { Avatar } from "../../../shared/ui/avatar/Avatar";
import type { IconType } from "../../../shared/ui/status-icon/StatusIcon";
import { StatusIcon } from "../../../shared/ui/status-icon/StatusIcon";
import type { Author } from "../model/schemas";

type StatusIconEntry = {
  key: string;
  type: IconType;
  status: string;
};

type InboxItemProps = {
  type?: IconType;
  status?: string;
  icons?: StatusIconEntry[];
  idLabel?: string | null;
  title: string;
  subtitle?: string | null;
  branchName?: string | null;
  author: Author;
  updatedAt: string;
  webUrl: string;
  onClick?: () => void;
  className?: string;
  isSelected?: boolean;
  dataItemId?: string;
  isHovered?: boolean;
};

export function InboxItem({
  type,
  status,
  icons,
  idLabel,
  title,
  subtitle,
  branchName,
  author,
  updatedAt,
  webUrl,
  onClick,
  className,
  isSelected = false,
  dataItemId,
  isHovered = false,
}: InboxItemProps) {
  const timeAgo = formatShortRelativeTime(updatedAt);

  const handleClick = async () => {
    if (onClick) onClick();
    await openUrl(webUrl);
  };

  const statusIcons: StatusIconEntry[] =
    icons || (type && status ? [{ key: `${type}-${status}`, type, status }] : []);

  const statusIconNodes = statusIcons.map((icon) => (
    <StatusIcon key={icon.key} type={icon.type} status={icon.status} className="h-5 w-5" />
  ));

  const handleCopyBranch = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!branchName || !navigator.clipboard) {
      return;
    }
    try {
      await navigator.clipboard.writeText(branchName);
    } catch {
      // Ignore clipboard errors to avoid blocking navigation.
    }
  };

  return (
    <div
      onClick={handleClick}
      aria-selected={isSelected}
      data-item-id={dataItemId}
      className={clsx(
        "w-full flex items-center gap-4 px-4 py-3 border-b border-base-300 hover:bg-base-200/50 transition-colors cursor-pointer border-l-2 border-transparent",
        isSelected && "bg-primary/10 border-l-primary",
        isHovered && "bg-base-200/60",
        className,
      )}
    >
      <div className="flex items-center gap-2 shrink-0">{statusIconNodes}</div>

      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="flex items-baseline gap-2 min-w-0">
          {idLabel ? (
            <span className="font-mono text-xs text-base-content/50 shrink-0">{idLabel}</span>
          ) : null}
          <span className="text-sm font-medium text-base-content truncate">{title}</span>
        </div>
        {subtitle ? (
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-mono text-base-content/50 truncate min-w-0">
              {subtitle}
            </span>
            {branchName ? (
              <button
                type="button"
                className="inline-flex items-center justify-center h-5 w-5 rounded text-base-content/40 hover:text-base-content/70 hover:bg-base-200/60 transition-colors cursor-pointer shrink-0"
                aria-label="Copy branch name"
                title="Copy branch name"
                onClick={handleCopyBranch}
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <span className="text-xs font-mono text-base-content/40 whitespace-nowrap">{timeAgo}</span>
        <Avatar src={author.avatarUrl} alt={author.name} size="sm" />
      </div>
    </div>
  );
}
