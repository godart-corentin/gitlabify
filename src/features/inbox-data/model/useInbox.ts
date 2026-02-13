import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { MOCK_INBOX_DATA, type InboxData } from "../../../entities/inbox/model";
import { getInboxQueryKey } from "../../../shared/api/queryKeys";
import { fetchInbox } from "../../../shared/api/tauri/commands";
import { useTauriEventListener } from "../../../shared/hooks/useTauriEventListener";

const INBOX_CACHE_TTL_MS = 1000 * 60 * 30;
const MOCK_INBOX_ENV_FLAG = "true";

export const useInboxData = () => {
  const queryClient = useQueryClient();
  const isMockMode = import.meta.env.VITE_MOCK_INBOX === MOCK_INBOX_ENV_FLAG;
  const inboxQueryKey = getInboxQueryKey(isMockMode);

  const query = useQuery({
    queryKey: inboxQueryKey,
    queryFn: isMockMode ? async () => MOCK_INBOX_DATA : fetchInbox,
    staleTime: Infinity, // Data is pushed via events
    gcTime: INBOX_CACHE_TTL_MS,
    retry: false,
  });

  const handleInboxUpdate = useCallback(
    (event: { payload: InboxData }) => {
      if (isMockMode) {
        return;
      }
      queryClient.setQueryData(inboxQueryKey, event.payload);
    },
    [inboxQueryKey, isMockMode, queryClient],
  );

  useTauriEventListener("inbox-updated", handleInboxUpdate);

  return query;
};
