import { openUrl } from "@tauri-apps/plugin-opener";
import { clsx } from "clsx";
import { formatDistanceToNow } from "date-fns";

import { Avatar } from "../../components/ui/Avatar";
import type { IconType } from "../../components/ui/StatusIcon";
import { StatusIcon } from "../../components/ui/StatusIcon";
import type { Author } from "../../schemas";

interface InboxItemProps {
  type?: IconType;
  status?: string;
  icons?: Array<{ type: IconType; status: string }>;
  title: string;
  author: Author;
  updatedAt: string;
  webUrl: string;
  onClick?: () => void;
  className?: string;
}

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
}: InboxItemProps) {
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

  const statusIcons = icons || (type && status ? [{ type, status }] : []);

  return (
    <div
      onClick={handleClick}
      className={clsx(
        "group flex items-center h-12 px-4 gap-3 bg-zinc-900 hover:bg-zinc-800 cursor-pointer border-b border-zinc-800/50 transition-colors",
        className,
      )}
    >
      <div className="flex items-center gap-2 shrink-0">
        {statusIcons.map((icon, index) => (
          <StatusIcon
            key={`${icon.type}-${index}`}
            type={icon.type}
            status={icon.status}
            className="w-5 h-5"
          />
        ))}
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
