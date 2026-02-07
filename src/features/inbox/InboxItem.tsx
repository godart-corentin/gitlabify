import { openUrl } from "@tauri-apps/plugin-opener";
import { clsx } from "clsx";
import type { CSSProperties, ReactNode } from "react";

import { Avatar } from "../../components/ui/Avatar";
import type { IconType } from "../../components/ui/StatusIcon";
import { StatusIcon } from "../../components/ui/StatusIcon";
import type { Author } from "../../schemas";

type StatusIconEntry = {
  key: string;
  type: IconType;
  status: string;
};

type InboxItemProps = {
  type?: IconType;
  status?: string;
  icons?: StatusIconEntry[];
  title: ReactNode;
  author: Author;
  updatedAt: string;
  webUrl: string;
  onClick?: () => void;
  className?: string;
  isSelected?: boolean;
  dataItemId?: string;
  isHovered?: boolean;
};

const INBOX_ITEM_PADDING_X_PX = 16;
const SECOND_MS = 1000;
const MINUTE_MS = SECOND_MS * 60;
const HOUR_MS = MINUTE_MS * 60;
const DAY_MS = HOUR_MS * 24;
const WEEK_MS = DAY_MS * 7;
const MONTH_MS = DAY_MS * 30;
const YEAR_MS = DAY_MS * 365;
const NOW_THRESHOLD_MS = SECOND_MS * 5;

const INBOX_ITEM_STYLE = {
  "--inbox-row-padding-x": `${INBOX_ITEM_PADDING_X_PX}px`,
} as CSSProperties;

const formatShortRelativeTime = (timestamp: string) => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "now";
  }
  const diffMs = Math.max(0, Date.now() - date.getTime());
  if (diffMs < NOW_THRESHOLD_MS) {
    return "now";
  }
  if (diffMs < MINUTE_MS) {
    return `${Math.max(1, Math.floor(diffMs / SECOND_MS))}s`;
  }
  if (diffMs < HOUR_MS) {
    return `${Math.max(1, Math.floor(diffMs / MINUTE_MS))}m`;
  }
  if (diffMs < DAY_MS) {
    return `${Math.max(1, Math.floor(diffMs / HOUR_MS))}h`;
  }
  if (diffMs < WEEK_MS) {
    return `${Math.max(1, Math.floor(diffMs / DAY_MS))}d`;
  }
  if (diffMs < MONTH_MS) {
    return `${Math.max(1, Math.floor(diffMs / WEEK_MS))}w`;
  }
  if (diffMs < YEAR_MS) {
    return `${Math.max(1, Math.floor(diffMs / MONTH_MS))}mo`;
  }
  return `${Math.max(1, Math.floor(diffMs / YEAR_MS))}y`;
};

export function InboxItem({
  type,
  status,
  icons,
  title,
  author,
  updatedAt,
  webUrl,
  onClick,
  className,
  isSelected = false,
  dataItemId,
  isHovered = false,
}: InboxItemProps) {
  const isActive = isSelected || isHovered;
  const timeAgo = formatShortRelativeTime(updatedAt);

  const handleClick = async () => {
    if (onClick) onClick();
    await openUrl(webUrl);
  };

  const statusIcons: StatusIconEntry[] =
    icons || (type && status ? [{ key: `${type}-${status}`, type, status }] : []);

  const statusIconNodes = statusIcons.map((icon) => (
    <StatusIcon
      key={icon.key}
      type={icon.type}
      status={icon.status}
      className="w-[18px] h-[18px]"
    />
  ));

  return (
    <div
      onClick={handleClick}
      aria-selected={isSelected}
      data-item-id={dataItemId}
      style={INBOX_ITEM_STYLE}
      className={clsx(
        "group flex items-center h-12 gap-3 bg-zinc-900 cursor-pointer border-b border-zinc-800/50 transition-colors inbox-hoverable inbox-row",
        isActive && "inbox-active-bg",
        isSelected && "inbox-selected",
        isHovered && "inbox-hovered",
        className,
      )}
    >
      <div className="flex items-center gap-2 shrink-0">
        {statusIconNodes}
      </div>

      <div className="flex-1 min-w-0 flex flex-col justify-center h-full">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-medium text-zinc-200 truncate group-hover:text-white transition-colors">
            {title}
          </span>
          <span className="text-[10px] text-zinc-500 shrink-0 whitespace-nowrap">
            {timeAgo}
          </span>
        </div>
      </div>

      <Avatar src={author.avatarUrl} alt={author.name} size="sm" />
    </div>
  );
}
