import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";

import { getInbox } from "../lib/commands";
import type { InboxData } from "../schemas";

const INBOX_CACHE_TTL_MS = 1000 * 60 * 30;

export const useInbox = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["inbox"],
    queryFn: getInbox,
    staleTime: Infinity, // Data is pushed via events
    gcTime: INBOX_CACHE_TTL_MS,
  });

  useEffect(() => {
    const unlisten = listen<InboxData>("inbox-updated", (event) => {
      // console.log("Inbox updated via event:", event.payload);
      queryClient.setQueryData(["inbox"], event.payload);
    });

    return () => {
      unlisten.then((f) => f());
    };
  }, [queryClient]);

  return query;
};
