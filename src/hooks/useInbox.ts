import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";

import { MOCK_INBOX_DATA } from "../features/inbox/mockInboxData";
import { getInbox } from "../lib/commands";
import type { InboxData } from "../schemas";

const INBOX_CACHE_TTL_MS = 1000 * 60 * 30;
const MOCK_INBOX_ENV_FLAG = "true";

export const useInbox = () => {
  const queryClient = useQueryClient();
  const isMockMode = import.meta.env.VITE_MOCK_INBOX === MOCK_INBOX_ENV_FLAG;

  const query = useQuery({
    queryKey: ["inbox", isMockMode ? "mock" : "live"],
    queryFn: isMockMode ? async () => MOCK_INBOX_DATA : getInbox,
    staleTime: Infinity, // Data is pushed via events
    gcTime: INBOX_CACHE_TTL_MS,
  });

  useEffect(() => {
    if (isMockMode) {
      return;
    }
    const unlisten = listen<InboxData>("inbox-updated", (event) => {
      queryClient.setQueryData(["inbox"], event.payload);
    });

    return () => {
      unlisten.then((f) => f());
    };
  }, [isMockMode, queryClient]);

  return query;
};
