import { useMutation, type QueryClient } from "@tanstack/react-query";

import { AUTH_TOKEN_QUERY_KEY, AUTH_USER_QUERY_KEY } from "../../../shared/api/queryKeys";
import {
  deleteToken,
  exchangeCodeForToken,
  saveToken,
  startOauthFlow,
  verifyToken,
} from "../../../shared/api/tauri/commands";

export const useAuthMutations = (queryClient: QueryClient) => {
  const verifyAndSaveMutation = useMutation({
    mutationFn: async ({ token }: { token: string }) => {
      const user = await verifyToken(token);
      await saveToken(token);
      return user;
    },
    onSuccess: (user) => {
      queryClient.setQueryData(AUTH_USER_QUERY_KEY, user);
      void queryClient.invalidateQueries({ queryKey: AUTH_TOKEN_QUERY_KEY });
    },
  });

  const startOauthMutation = useMutation({
    mutationFn: startOauthFlow,
  });

  const exchangeCodeMutation = useMutation({
    mutationFn: exchangeCodeForToken,
    onSuccess: (user) => {
      queryClient.setQueryData(AUTH_USER_QUERY_KEY, user);
      void queryClient.invalidateQueries({ queryKey: AUTH_TOKEN_QUERY_KEY });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: deleteToken,
    onSuccess: () => {
      queryClient.setQueryData(AUTH_TOKEN_QUERY_KEY, null);
      queryClient.setQueryData(AUTH_USER_QUERY_KEY, null);
    },
    onError: () => {
      queryClient.setQueryData(AUTH_TOKEN_QUERY_KEY, null);
      queryClient.setQueryData(AUTH_USER_QUERY_KEY, null);
    },
  });

  return {
    verifyAndSaveMutation,
    startOauthMutation,
    exchangeCodeMutation,
    logoutMutation,
  };
};
