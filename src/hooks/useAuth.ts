import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useGitlabSettings } from "./useGitlabSettings";
import {
  getToken,
  saveToken,
  verifyToken,
  User,
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
    queryFn: getToken,
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: true,
  });

  const { gitlabHost } = useGitlabSettings();

  // Query to get the current user profile (after authentication)
  const { data: user, isLoading: isLoadingUser } = useQuery({
    queryKey: ["auth-user"],
    queryFn: async () => {
      // 1. Try to get from cache first (set during login)
      const cached = queryClient.getQueryData<User>(["auth-user"]);
      if (cached) return cached;

      // 2. If not in cache but we have token/host, fetch from GitLab
      if (token && gitlabHost) {
        return await verifyToken(token, gitlabHost);
      }
      return null;
    },
    enabled: !!token && !!gitlabHost,
    staleTime: 1000 * 60 * 60, // 1 hour cache
  });

  // Mutation to verify and save token
  const verifyAndSaveMutation = useMutation({
    mutationFn: async ({ token, host }: { token: string; host: string }) => {
      const user = await verifyToken(token, host);
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
    onError: (_error) => {
      // handled by UI
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
    verifyAndSaveMutation.error ||
    exchangeCodeMutation.error ||
    startOauthMutation.error;

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
