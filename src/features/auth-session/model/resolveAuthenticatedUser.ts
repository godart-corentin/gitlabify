import type { QueryClient } from "@tanstack/react-query";

import type { User } from "../../../entities/inbox/model";
import { AUTH_TOKEN_QUERY_KEY } from "../../../shared/api/queryKeys";

import { isInsufficientScopeError, isInvalidTokenError } from "./authErrorGuards";

type ResolveAuthenticatedUserArgs = {
  token: string;
  queryClient: QueryClient;
  verifyTokenFn: (token: string) => Promise<User>;
  fetchInboxFn: () => Promise<unknown>;
  getTokenFn: () => Promise<string | null>;
  deleteTokenFn: () => Promise<void>;
};

export const resolveAuthenticatedUser = async ({
  token,
  queryClient,
  verifyTokenFn,
  fetchInboxFn,
  getTokenFn,
  deleteTokenFn,
}: ResolveAuthenticatedUserArgs) => {
  try {
    return await verifyTokenFn(token);
  } catch (error) {
    if (isInvalidTokenError(error)) {
      try {
        await fetchInboxFn();
      } catch (refreshError) {
        console.warn("Inbox refresh failed during auth recovery", refreshError);
      }

      const latestToken = await getTokenFn();
      if (latestToken && latestToken !== token) {
        queryClient.setQueryData(AUTH_TOKEN_QUERY_KEY, latestToken);
        return verifyTokenFn(latestToken);
      }

      await deleteTokenFn();
      queryClient.setQueryData(AUTH_TOKEN_QUERY_KEY, null);
    }

    if (isInsufficientScopeError(error)) {
      await deleteTokenFn();
      queryClient.setQueryData(AUTH_TOKEN_QUERY_KEY, null);
    }

    throw error;
  }
};
