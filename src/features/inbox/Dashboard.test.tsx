// @vitest-environment jsdom

import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import "@testing-library/jest-dom";

vi.mock("../../lib/commands", () => ({
  refreshInbox: vi.fn(),
}));

vi.mock("../../hooks/useInbox", () => ({
  useInbox: vi.fn(),
}));

vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({
    user: { username: "alice" },
  }),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(),
}));

import * as commands from "../../lib/commands";
import * as inboxHook from "../../hooks/useInbox";
import * as tauriEvents from "@tauri-apps/api/event";

import { Dashboard, REFRESH_SPINNER_MIN_MS } from "./Dashboard";

describe("Dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  const defaultInbox = {
    mergeRequests: [
      {
        id: 1,
        iid: 1,
        projectId: 1,
        sourceBranch: null,
        title: "Review me",
        description: null,
        state: "opened",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-02T00:00:00Z",
        webUrl: "https://gitlab.example.com/mr/1",
        author: {
          id: 2,
          username: "bob",
          name: "Bob",
          avatarUrl: null,
        },
        hasConflicts: false,
        blockingDiscussionsResolved: true,
        headPipeline: null,
        draft: false,
        workInProgress: false,
        isReviewer: true,
        approvedByMe: false,
      },
    ],
    todos: [],
    pipelines: [],
  };

  const setupMocks = () => {
    const useInboxMock = vi.mocked(inboxHook.useInbox);
    useInboxMock.mockReturnValue({
      data: defaultInbox,
      isLoading: false,
      error: null,
    });

    const listenMock = vi.mocked(tauriEvents.listen);
    listenMock.mockResolvedValue(() => undefined);
  };

  it("triggers refresh and shows loading state", async () => {
    setupMocks();
    const refreshInboxMock = vi.mocked(commands.refreshInbox);
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

  it("shows cached data immediately", () => {
    setupMocks();
    render(<Dashboard />);

    expect(screen.getByText("Review me")).toBeInTheDocument();
  });

  it("shows and clears the offline banner based on inbox-stale events", async () => {
    setupMocks();
    const unlistenMock = vi.fn();
    const listenHandler: { current?: (event: { payload: unknown }) => void } = {};

    const listenMock = vi.mocked(tauriEvents.listen);
    listenMock.mockImplementation((_event, handler) => {
      listenHandler.current = handler;
      return Promise.resolve(unlistenMock);
    });

    render(<Dashboard />);

    await act(async () => {
      listenHandler.current?.({
        payload: {
          isStale: true,
          isOffline: true,
          lastUpdatedAtMs: 1000,
          lastError: "Network",
        },
      });
    });

    expect(screen.getByText("Offline / Cached data")).toBeInTheDocument();

    await act(async () => {
      listenHandler.current?.({
        payload: {
          isStale: false,
          isOffline: false,
          lastUpdatedAtMs: 2000,
          lastError: null,
        },
      });
    });

    expect(screen.queryByText("Offline / Cached data")).not.toBeInTheDocument();
  });
});
