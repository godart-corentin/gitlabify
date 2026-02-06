import { clsx } from "clsx";
import { Inbox, GitMerge, Rocket, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useAuth } from "../../hooks/useAuth";
import { useInbox } from "../../hooks/useInbox";
import { refreshInbox } from "../../lib/commands";

import { InboxList } from "./InboxList";

export const REFRESH_SPINNER_MIN_MS = 500;

type DashboardFilter = "notifications" | "mrs" | "pipelines";

export function Dashboard() {
  const { data, isLoading, error } = useInbox();
  const { user } = useAuth();
  const [filter, setFilter] = useState<DashboardFilter>("notifications");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshTimeoutIdRef = useRef<number | null>(null);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshInbox();
      // The backend will emit "inbox-updated", but we can also invalidate
      // to show a loading state if preferred, though the event-driven approach is smoother.
    } finally {
      // Small delay to make the rotation visible if it's too fast
      if (refreshTimeoutIdRef.current !== null) {
        window.clearTimeout(refreshTimeoutIdRef.current);
      }
      refreshTimeoutIdRef.current = window.setTimeout(() => {
        setIsRefreshing(false);
        refreshTimeoutIdRef.current = null;
      }, REFRESH_SPINNER_MIN_MS);
    }
  };

  const handleTabClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    const tabId = event.currentTarget.dataset.tabId as DashboardFilter | undefined;
    if (!tabId) {
      return;
    }
    setFilter(tabId);
  };

  useEffect(() => {
    return () => {
      if (refreshTimeoutIdRef.current !== null) {
        window.clearTimeout(refreshTimeoutIdRef.current);
      }
    };
  }, []);

  // Initialize authorFilter to current user once user is loaded
  const currentUsername = user?.username;

  if (error) {
    return <div className="p-4 text-red-500">Error loading inbox: {error.message}</div>;
  }

  const tabs: {
    id: DashboardFilter;
    label: string;
    shortLabel: string;
    icon: React.ReactNode;
  }[] = [
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

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Header / Tabs */}
      <div className="flex flex-col border-b border-zinc-800 bg-zinc-900 sticky top-0 z-10">
        <div className="flex items-center justify-between p-2">
          <div className="flex items-center gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                data-tab-id={tab.id}
                onClick={handleTabClick}
                title={tab.label}
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
            ))}
          </div>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="h-8 w-8 flex items-center justify-center rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-all disabled:opacity-50"
            title="Refresh Inbox"
          >
            <RefreshCw
              className={clsx("w-3.5 h-3.5", isRefreshing && "animate-spin text-orange-500")}
            />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <InboxList
          data={data}
          isLoading={isLoading}
          filter={filter}
          currentUsername={currentUsername}
        />
      </div>
    </div>
  );
}
