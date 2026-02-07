import { listen } from "@tauri-apps/api/event";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { getConnectionStatus } from "../lib/commands";

const CONNECTION_STATUS_CACHE_TTL_MS = 1000 * 60 * 60;
const CONNECTION_STATUS_QUERY_KEY = ["connection-status"] as const;

export const useConnectionStatus = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: CONNECTION_STATUS_QUERY_KEY,
    queryFn: getConnectionStatus,
    staleTime: Infinity,
    gcTime: CONNECTION_STATUS_CACHE_TTL_MS,
  });

  useEffect(() => {
    const unlisten = listen<boolean>("connection-status-changed", (event) => {
      queryClient.setQueryData(CONNECTION_STATUS_QUERY_KEY, event.payload);
    });

    return () => {
      unlisten.then((stop) => stop());
    };
  }, [queryClient]);

  return query;
};
