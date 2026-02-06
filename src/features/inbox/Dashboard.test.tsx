// @vitest-environment jsdom

import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import "@testing-library/jest-dom";

const refreshInboxMock = vi.hoisted(() => vi.fn());

vi.mock("../../lib/commands", () => ({
  refreshInbox: refreshInboxMock,
}));

vi.mock("../../hooks/useInbox", () => ({
  useInbox: () => ({
    data: { mergeRequests: [], todos: [], pipelines: [] },
    isLoading: false,
    error: null,
  }),
}));

vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({
    user: { username: "alice" },
  }),
}));

import { Dashboard, REFRESH_SPINNER_MIN_MS } from "./Dashboard";

describe("Dashboard", () => {
  it("triggers refresh and shows loading state", async () => {
    refreshInboxMock.mockResolvedValue(undefined);
    vi.useFakeTimers();

    render(<Dashboard />);

    const button = screen.getByTitle("Refresh Inbox");

    await act(async () => {
      fireEvent.click(button);
    });

    expect(refreshInboxMock).toHaveBeenCalledTimes(1);

    const icon = button.querySelector("svg");
    expect(icon).toHaveClass("animate-spin");

    await act(async () => {
      vi.advanceTimersByTime(REFRESH_SPINNER_MIN_MS);
    });

    expect(icon).not.toHaveClass("animate-spin");

    vi.useRealTimers();
  });
});
