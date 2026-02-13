import { useCallback, useEffect, useRef, useState } from "react";

import type { InboxFilter } from "../../../entities/inbox/model";
import { useInboxData } from "../../../features/inbox-data/model/useInbox";
import { useInboxNotifications } from "../../../features/inbox-notifications/model/useInboxNotifications";
import { useTauriEventListener } from "../../../shared/hooks/useTauriEventListener";

import { DashboardHeader } from "./DashboardHeader";
import { InboxList } from "./InboxList";

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

type DashboardProps = {
  currentUsername?: string;
};

export function Dashboard({ currentUsername }: DashboardProps) {
  const { data, isLoading, isFetching, error, refetch } = useInboxData();
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
    } finally {
      if (refreshTimeoutIdRef.current !== null) {
        window.clearTimeout(refreshTimeoutIdRef.current);
      }

      refreshTimeoutIdRef.current = window.setTimeout(() => {
        setIsRefreshing(false);
        refreshTimeoutIdRef.current = null;
      }, REFRESH_SPINNER_MIN_MS);
    }
  };

  const handleInboxStaleEvent = useCallback((event: { payload: InboxStalePayload }) => {
    const payload = event.payload;
    setStaleState({
      isStale: payload.isStale,
      isOffline: payload.isOffline,
      lastUpdatedAtMs: payload.lastUpdatedAtMs ?? null,
      lastError: payload.lastError ?? null,
    });
  }, []);

  useTauriEventListener("inbox-stale", handleInboxStaleEvent);

  useEffect(
    () => () => {
      if (refreshTimeoutIdRef.current !== null) {
        window.clearTimeout(refreshTimeoutIdRef.current);
      }
    },
    [],
  );

  if (error) {
    return <div className="p-4 text-error">Error loading inbox: {error.message}</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <DashboardHeader
        filter={filter}
        isRefreshing={isRefreshing}
        onRefresh={handleRefresh}
        onTabChange={setFilter}
      />

      <div className="flex-1 overflow-y-auto">
        {staleState.isStale ? (
          <div className="text-[10px] uppercase tracking-widest font-semibold text-base-content/60 bg-base-200 border-b border-base-300 px-4 py-2">
            {INBOX_STALE_BANNER_TEXT}
          </div>
        ) : null}

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
