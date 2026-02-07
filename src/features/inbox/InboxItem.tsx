import { openUrl } from "@tauri-apps/plugin-opener";
import { clsx } from "clsx";
import { formatDistanceToNow } from "date-fns";
import type { CSSProperties } from "react";

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
  title: string;
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

const INBOX_ITEM_STYLE = {
  "--inbox-row-padding-x": `${INBOX_ITEM_PADDING_X_PX}px`,
} as CSSProperties;

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
  let timeAgo = "";
  try {
    timeAgo = formatDistanceToNow(new Date(updatedAt), { addSuffix: true });
  } catch {
    timeAgo = "unknown time";
  }

  const handleClick = async () => {
    if (onClick) onClick();
    await openUrl(webUrl);
  };

  const statusIcons: StatusIconEntry[] =
    icons || (type && status ? [{ key: `${type}-${status}`, type, status }] : []);

  const statusIconNodes = statusIcons.map((icon) => (
    <StatusIcon key={icon.key} type={icon.type} status={icon.status} className="w-5 h-5" />
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
          <span className="text-xs text-zinc-500 shrink-0 whitespace-nowrap">{timeAgo}</span>
        </div>
      </div>

      <Avatar src={author.avatarUrl} alt={author.name} size="sm" />
    </div>
  );
}
