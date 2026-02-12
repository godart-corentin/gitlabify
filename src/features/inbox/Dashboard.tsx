import { listen } from "@tauri-apps/api/event";
import { useEffect, useRef, useState } from "react";

import { useAuth } from "../../hooks/useAuth";
import { useInbox } from "../../hooks/useInbox";
import { useInboxNotifications } from "../../hooks/useInboxNotifications";

import { DashboardHeader } from "./DashboardHeader";
import { InboxList } from "./InboxList";
import type { InboxFilter } from "./types";

export const REFRESH_SPINNER_MIN_MS = 500;
const INBOX_STALE_BANNER_TEXT = "Offline / Cached data";

type InboxStalePayload = {
  isStale: boolean;
  isOffline: boolean;
  lastUpdatedAtMs?: number | null;
  lastError?: string | null;
};

type InboxStaleState = {
  isStale: boolean;
  isOffline: boolean;
  lastUpdatedAtMs: number | null;
  lastError: string | null;
};

const DEFAULT_STALE_STATE: InboxStaleState = {
  isStale: false,
  isOffline: false,
  lastUpdatedAtMs: null,
  lastError: null,
};

export function Dashboard() {
  const { data, isLoading, isFetching, error, refetch } = useInbox();
  const { user } = useAuth();
  const currentUsername = user?.username;
  useInboxNotifications(data, currentUsername);
  const [filter, setFilter] = useState<InboxFilter>("notifications");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [staleState, setStaleState] = useState<InboxStaleState>(DEFAULT_STALE_STATE);
  const refreshTimeoutIdRef = useRef<number | null>(null);
  const isInboxLoading = isLoading || isFetching;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
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

  const handleTabChange = (tabId: InboxFilter) => {
    setFilter(tabId);
  };

  useEffect(() => {
    return () => {
      if (refreshTimeoutIdRef.current !== null) {
        window.clearTimeout(refreshTimeoutIdRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const unlisten = listen<InboxStalePayload>("inbox-stale", (event) => {
      const payload = event.payload;
      setStaleState({
        isStale: payload.isStale,
        isOffline: payload.isOffline,
        lastUpdatedAtMs: payload.lastUpdatedAtMs ?? null,
        lastError: payload.lastError ?? null,
      });
    });

    return () => {
      unlisten.then((stop) => stop());
    };
  }, []);

  if (error) {
    return <div className="p-4 text-error">Error loading inbox: {error.message}</div>;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header / Tabs */}
      <DashboardHeader
        filter={filter}
        isRefreshing={isRefreshing}
        onRefresh={handleRefresh}
        onTabChange={handleTabChange}
      />

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {staleState.isStale && (
          <div className="text-[10px] uppercase tracking-widest font-semibold text-base-content/60 bg-base-200 border-b border-base-300 px-4 py-2">
            {INBOX_STALE_BANNER_TEXT}
          </div>
        )}
        <InboxList
          data={data}
          isLoading={isInboxLoading}
          filter={filter}
          currentUsername={currentUsername}
        />
      </div>
    </div>
  );
}
