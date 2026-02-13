import { useQueryClient } from "@tanstack/react-query";

import { MOCK_INBOX_DATA } from "../../../entities/inbox/model";

import { MOCK_INBOX_ENV_FLAG } from "./constants";
import { useAuthMutations } from "./useAuthMutations";
import { useAuthTokenQuery } from "./useAuthTokenQuery";
import { useAuthUserQuery } from "./useAuthUserQuery";

export const useAuthSession = () => {
  const queryClient = useQueryClient();

  const isMockMode = import.meta.env.VITE_MOCK_INBOX === MOCK_INBOX_ENV_FLAG;
  const mockUser = MOCK_INBOX_DATA.mergeRequests[0]?.author ?? null;

  const {
    data: token,
    isLoading: isLoadingToken,
    refetch: refetchToken,
  } = useAuthTokenQuery(isMockMode);

  const {
    data: user,
    isLoading: isLoadingUser,
    error: authUserError,
  } = useAuthUserQuery({
    token,
    isMockMode,
    mockUser,
    queryClient,
  });

  const { verifyAndSaveMutation, startOauthMutation, exchangeCodeMutation, logoutMutation } =
    useAuthMutations(queryClient);

  const authError =
    verifyAndSaveMutation.error ||
    exchangeCodeMutation.error ||
    startOauthMutation.error ||
    authUserError;

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
};
