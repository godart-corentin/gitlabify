import { clsx } from "clsx";
import { Inbox, GitMerge, Rocket } from "lucide-react";
import { useState } from "react";

import { useAuth } from "../../hooks/useAuth";
import { useInbox } from "../../hooks/useInbox";

import { InboxList } from "./InboxList";

export function Dashboard() {
  const { data, isLoading, error } = useInbox();
  const { user } = useAuth();
  const [filter, setFilter] = useState<"notifications" | "mrs" | "pipelines">("notifications");

  // Initialize authorFilter to current user once user is loaded
  const currentUsername = user?.username;

  if (error) {
    return <div className="p-4 text-red-500">Error loading inbox: {error.message}</div>;
  }

  const tabs: {
    id: "notifications" | "mrs" | "pipelines";
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
        <div className="flex items-center gap-1 p-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
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
