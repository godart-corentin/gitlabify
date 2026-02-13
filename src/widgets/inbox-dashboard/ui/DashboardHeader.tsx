import { clsx } from "clsx";
import { GitMerge, Inbox, RefreshCw, Rocket } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";

import type { InboxFilter } from "../../../entities/inbox/model";

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
    icon: <Inbox className="h-4 w-4" />,
  },
  {
    id: "mrs",
    label: "My MRs",
    shortLabel: "My MRs",
    icon: <GitMerge className="h-4 w-4" />,
  },
  {
    id: "pipelines",
    label: "My Pipelines",
    shortLabel: "My Pipelines",
    icon: <Rocket className="h-4 w-4" />,
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

  const tabButtons = TABS.map((tab) => {
    const isActive = filter === tab.id;

    return (
      <button
        key={tab.id}
        data-tab-id={tab.id}
        onClick={handleTabClick}
        title={tab.label}
        type="button"
        aria-pressed={isActive}
        className={clsx(
          "h-8 px-3 text-xs font-semibold rounded-full flex items-center gap-2 transition-colors",
          isActive
            ? "bg-base-200 text-base-content"
            : "text-base-content/60 hover:bg-base-200 hover:text-base-content",
        )}
      >
        <span className="shrink-0">{tab.icon}</span>
        {isActive ? <span className="whitespace-nowrap">{tab.shortLabel}</span> : null}
      </button>
    );
  });

  return (
    <div className="flex flex-col sticky top-0 z-10 bg-base-100 border-b border-base-300">
      <div className="flex items-center justify-between px-4 py-2">
        <div className="inline-flex items-center gap-1 rounded-full border border-base-300 bg-base-100 p-1">
          {tabButtons}
        </div>

        <button
          onClick={handleRefreshClick}
          disabled={isRefreshing}
          type="button"
          className="h-8 w-8 rounded-md border border-base-300 text-base-content/60 hover:bg-base-200 transition-colors disabled:opacity-60 flex items-center justify-center"
          title="Refresh Inbox"
        >
          <RefreshCw className={clsx("h-4 w-4", isRefreshing && "animate-spin text-primary")} />
        </button>
      </div>
    </div>
  );
};
