import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { CONNECTION_STATUS_QUERY_KEY } from "../../../shared/api/queryKeys";
import { getConnectionStatus } from "../../../shared/api/tauri/commands";
import { useTauriEventListener } from "../../../shared/hooks/useTauriEventListener";

const CONNECTION_STATUS_CACHE_TTL_MS = 1000 * 60 * 60;

export const useConnectionStatus = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: CONNECTION_STATUS_QUERY_KEY,
    queryFn: getConnectionStatus,
    staleTime: Infinity,
    gcTime: CONNECTION_STATUS_CACHE_TTL_MS,
  });

  const handleConnectionStatusChange = useCallback(
    (event: { payload: boolean }) => {
      queryClient.setQueryData(CONNECTION_STATUS_QUERY_KEY, event.payload);
    },
    [queryClient],
  );

  useTauriEventListener("connection-status-changed", handleConnectionStatusChange);

  return query;
};
