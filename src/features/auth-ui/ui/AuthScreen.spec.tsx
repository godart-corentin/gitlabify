import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AuthScreen } from "./AuthScreen";

const { useAuthSessionMock } = vi.hoisted(() => ({
  useAuthSessionMock: vi.fn(),
}));

vi.mock("../../auth-session/model/useAuthSession", () => ({
  useAuthSession: useAuthSessionMock,
}));

vi.mock("../model/useAuthScreenListeners", () => ({
  useAuthScreenListeners: vi.fn(),
}));

describe("AuthScreen", () => {
  it("switches between OAuth and PAT modes", () => {
    useAuthSessionMock.mockReturnValue({
      verifyAndSave: vi.fn(),
      isVerifying: false,
      verifyError: null,
      startOauth: vi.fn(),
      exchangeCode: vi.fn(),
      isStartingOauth: false,
      isExchanging: false,
      authError: null,
      refetchToken: vi.fn(),
    });

    render(<AuthScreen />);

    expect(screen.queryByText("Login with GitLab.com")).not.toBeNull();

    fireEvent.click(screen.getByText("Use Personal Access Token instead"));
    expect(screen.queryByText("Personal Access Token")).not.toBeNull();

    fireEvent.click(screen.getByText("Back to OAuth Login"));
    expect(screen.queryByText("Login with GitLab.com")).not.toBeNull();
  });
});
