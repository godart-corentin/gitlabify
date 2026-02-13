import { useQuery } from "@tanstack/react-query";

import { AUTH_TOKEN_QUERY_KEY } from "../../../shared/api/queryKeys";
import { getToken } from "../../../shared/api/tauri/commands";

import { MOCK_TOKEN } from "./constants";

export const useAuthTokenQuery = (isMockMode: boolean) => {
  return useQuery({
    queryKey: AUTH_TOKEN_QUERY_KEY,
    queryFn: async () => {
      if (isMockMode) {
        return MOCK_TOKEN;
      }

      return getToken();
    },
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: true,
  });
};
