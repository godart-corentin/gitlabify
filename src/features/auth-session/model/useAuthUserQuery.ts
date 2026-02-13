import { useQuery, type QueryClient } from "@tanstack/react-query";

import type { User } from "../../../entities/inbox/model";
import { AUTH_USER_QUERY_KEY } from "../../../shared/api/queryKeys";
import { deleteToken, fetchInbox, getToken, verifyToken } from "../../../shared/api/tauri/commands";

import { AUTH_USER_CACHE_TTL_MS } from "./constants";
import { resolveAuthenticatedUser } from "./resolveAuthenticatedUser";

export const useAuthUserQuery = ({
  token,
  isMockMode,
  mockUser,
  queryClient,
}: {
  token: string | null | undefined;
  isMockMode: boolean;
  mockUser: User | null;
  queryClient: QueryClient;
}) => {
  return useQuery({
    queryKey: AUTH_USER_QUERY_KEY,
    queryFn: async () => {
      if (isMockMode) {
        return mockUser;
      }

      const cachedUser = queryClient.getQueryData<User>(AUTH_USER_QUERY_KEY);
      if (cachedUser) {
        return cachedUser;
      }

      if (!token) {
        return null;
      }

      return resolveAuthenticatedUser({
        token,
        queryClient,
        verifyTokenFn: verifyToken,
        fetchInboxFn: fetchInbox,
        getTokenFn: getToken,
        deleteTokenFn: deleteToken,
      });
    },
    enabled: isMockMode ? !!mockUser : !!token,
    retry: false,
    staleTime: AUTH_USER_CACHE_TTL_MS,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
};
