import { clsx } from "clsx";
import { GitMerge, Inbox, RefreshCw, Rocket } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";

import type { InboxFilter } from "./types";

type DashboardHeaderProps = {
  filter: InboxFilter;
  isRefreshing: boolean;
  onTabChange: (filter: InboxFilter) => void;
  onRefresh: () => void;
};

const TABS: Array<{
  id: InboxFilter;
  label: string;
  shortLabel: string;
  icon: ReactNode;
}> = [
  {
    id: "notifications",
    label: "My Notifications",
    shortLabel: "Inbox",
    icon: <Inbox className="w-4 h-4" />,
  },
  {
    id: "mrs",
    label: "My MRs",
    shortLabel: "My MRs",
    icon: <GitMerge className="w-4 h-4" />,
  },
  {
    id: "pipelines",
    label: "My Pipelines",
    shortLabel: "My Pipelines",
    icon: <Rocket className="w-4 h-4" />,
  },
];

export const DashboardHeader = ({
  filter,
  isRefreshing,
  onTabChange,
  onRefresh,
}: DashboardHeaderProps) => {
  const handleTabClick = (event: MouseEvent<HTMLButtonElement>) => {
    const tabId = event.currentTarget.dataset.tabId as InboxFilter | undefined;
    if (!tabId) {
      return;
    }
    onTabChange(tabId);
  };

  const handleRefreshClick = () => {
    onRefresh();
  };

  const tabButtons = TABS.map((tab) => (
    <button
      key={tab.id}
      data-tab-id={tab.id}
      onClick={handleTabClick}
      title={tab.label}
      type="button"
      className={clsx(
        "h-8 px-2.5 rounded-md transition-all duration-200 flex items-center justify-center gap-2 overflow-hidden",
        filter === tab.id
          ? "bg-zinc-800 text-orange-500 w-auto"
          : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 w-9",
      )}
    >
      <span className="shrink-0">{tab.icon}</span>
      {filter === tab.id && (
        <span className="text-xs font-semibold whitespace-nowrap animate-in fade-in slide-in-from-left-1 duration-200">
          {tab.shortLabel}
        </span>
      )}
    </button>
  ));

  return (
    <div className="flex flex-col border-b border-zinc-800 bg-zinc-900 sticky top-0 z-10">
      <div className="flex items-center justify-between p-2">
        <div className="flex items-center gap-1">{tabButtons}</div>

        <button
          onClick={handleRefreshClick}
          disabled={isRefreshing}
          type="button"
          className="h-8 w-8 flex items-center justify-center rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-all disabled:opacity-50"
          title="Refresh Inbox"
        >
          <RefreshCw
            className={clsx("w-3.5 h-3.5", isRefreshing && "animate-spin text-orange-500")}
          />
        </button>
      </div>
    </div>
  );
};
