import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { User } from "../../../entities/inbox/model";
import { AUTH_TOKEN_QUERY_KEY } from "../../../shared/api/queryKeys";

const { reportFrontendWarningMock } = vi.hoisted(() => ({
  reportFrontendWarningMock: vi.fn(),
}));

vi.mock("../../../shared/lib/sentry", () => ({
  reportFrontendWarning: reportFrontendWarningMock,
}));

import { resolveAuthenticatedUser } from "./resolveAuthenticatedUser";

const USER_FIXTURE: User = {
  id: 1,
  username: "me",
  name: "Me",
  avatarUrl: null,
};

describe("resolveAuthenticatedUser", () => {
  it("recovers session with refreshed token after invalid token error", async () => {
    const queryClient = new QueryClient();

    const verifyTokenFn = vi.fn(async (_token: string) => USER_FIXTURE);
    verifyTokenFn.mockRejectedValueOnce({ type: "invalidToken" });
    verifyTokenFn.mockResolvedValueOnce(USER_FIXTURE);

    const user = await resolveAuthenticatedUser({
      token: "old-token",
      queryClient,
      verifyTokenFn,
      fetchInboxFn: vi.fn().mockResolvedValue(undefined),
      getTokenFn: vi.fn().mockResolvedValue("new-token"),
      deleteTokenFn: vi.fn().mockResolvedValue(undefined),
    });

    expect(user).toEqual(USER_FIXTURE);
    expect(verifyTokenFn).toHaveBeenNthCalledWith(1, "old-token");
    expect(verifyTokenFn).toHaveBeenNthCalledWith(2, "new-token");
    expect(queryClient.getQueryData(AUTH_TOKEN_QUERY_KEY)).toBe("new-token");
  });

  it("clears token on insufficient scope error", async () => {
    const queryClient = new QueryClient();
    const deleteTokenFn = vi.fn().mockResolvedValue(undefined);

    await expect(
      resolveAuthenticatedUser({
        token: "scope-token",
        queryClient,
        verifyTokenFn: vi
          .fn(async (_token: string) => USER_FIXTURE)
          .mockRejectedValue({
            type: "insufficientScope",
          }),
        fetchInboxFn: vi.fn().mockResolvedValue(undefined),
        getTokenFn: vi.fn().mockResolvedValue(null),
        deleteTokenFn,
      }),
    ).rejects.toEqual({ type: "insufficientScope" });

    expect(deleteTokenFn).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryData(AUTH_TOKEN_QUERY_KEY)).toBeNull();
  });

  it("reports a warning when inbox refresh fails during auth recovery", async () => {
    const queryClient = new QueryClient();
    const refreshError = new Error("refresh failed");

    const verifyTokenFn = vi.fn(async (_token: string) => USER_FIXTURE);
    verifyTokenFn.mockRejectedValueOnce({ type: "invalidToken" });
    verifyTokenFn.mockResolvedValueOnce(USER_FIXTURE);

    await resolveAuthenticatedUser({
      token: "old-token",
      queryClient,
      verifyTokenFn,
      fetchInboxFn: vi.fn().mockRejectedValue(refreshError),
      getTokenFn: vi.fn().mockResolvedValue("new-token"),
      deleteTokenFn: vi.fn().mockResolvedValue(undefined),
    });

    expect(reportFrontendWarningMock).toHaveBeenCalledWith(
      "Inbox refresh failed during auth recovery",
      expect.objectContaining({
        action: "refresh-inbox",
        error: refreshError,
        feature: "auth-session",
      }),
    );
  });
});
