import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { User } from "../lib/commands";
import {
  getToken,
  saveToken,
  verifyToken,
  deleteToken,
  startOauthFlow,
  exchangeCodeForToken,
} from "../lib/commands";

export function useAuth() {
  const queryClient = useQueryClient();

  // Query to get the current token (check if authenticated)
  const {
    data: token,
    isLoading: isLoadingToken,
    refetch: refetchToken,
  } = useQuery({
    queryKey: ["auth-token"],
    queryFn: async () => {
      console.log("Frontend: calling getToken");
      try {
        const t = await getToken();
        console.log("Frontend: getToken result:", t ? "found" : "null");
        return t;
      } catch (e) {
        console.error("Frontend: getToken error:", e);
        throw e;
      }
    },
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: true,
  });

  // Query to get the current user profile (after authentication)
  const { data: user, isLoading: isLoadingUser } = useQuery({
    queryKey: ["auth-user"],
    queryFn: async () => {
      // 1. Try to get from cache first (set during login)
      const cached = queryClient.getQueryData<User>(["auth-user"]);
      if (cached) {
        console.log("Frontend: user found in cache");
        return cached;
      }

      // 2. If not in cache but we have token, fetch from GitLab
      if (token) {
        console.log("Frontend: verifying token for user");
        try {
          const u = await verifyToken(token);
          console.log("Frontend: user verified");
          return u;
        } catch (e) {
          console.error("Frontend: verifyToken error:", e);
          // If token is invalid/unauthorized, we should clear it
          // We can't use the mutation here directly as it might cause a loop or react warning
          // But throwing here will cause the query to be in error state
          await deleteToken();
          queryClient.setQueryData(["auth-token"], null);
          throw e;
        }
      }
      console.log("Frontend: no token to verify");
      return null;
    },
    enabled: !!token,
    retry: false,
    staleTime: 1000 * 60 * 60, // 1 hour cache
  });

  // Mutation to verify and save token
  const verifyAndSaveMutation = useMutation({
    mutationFn: async ({ token }: { token: string }) => {
      const user = await verifyToken(token);
      await saveToken(token);
      return user;
    },
    onSuccess: (user) => {
      queryClient.setQueryData(["auth-user"], user);
      queryClient.invalidateQueries({ queryKey: ["auth-token"] });
    },
  });

  // Mutation to start OAuth flow
  const startOauthMutation = useMutation({
    mutationFn: startOauthFlow,
  });

  // Mutation to exchange code for token
  const exchangeCodeMutation = useMutation({
    mutationFn: async (code: string) => {
      return await exchangeCodeForToken(code);
    },
    onSuccess: (user) => {
      queryClient.setQueryData(["auth-user"], user);
      queryClient.invalidateQueries({ queryKey: ["auth-token"] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: deleteToken,
    onSuccess: () => {
      queryClient.setQueryData(["auth-token"], null);
      queryClient.setQueryData(["auth-user"], null);
    },
  });

  const authError =
    verifyAndSaveMutation.error || exchangeCodeMutation.error || startOauthMutation.error;

  return {
    user,
    isAuthenticated: !!token,
    isLoadingToken,
    isLoadingUser,
    verifyAndSave: verifyAndSaveMutation.mutateAsync,
    isVerifying: verifyAndSaveMutation.isPending,
    verifyError: verifyAndSaveMutation.error,
    startOauth: startOauthMutation.mutateAsync,
    isStartingOauth: startOauthMutation.isPending,
    exchangeCode: exchangeCodeMutation.mutateAsync,
    isExchanging: exchangeCodeMutation.isPending,
    authError,
    logout: logoutMutation.mutate,
    refetchToken,
  };
}
