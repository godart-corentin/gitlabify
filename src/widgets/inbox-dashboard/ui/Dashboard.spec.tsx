import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { InboxData } from "../../../entities/inbox/model";

import { Dashboard } from "./Dashboard";

const { useInboxDataMock, useInboxNotificationsMock } = vi.hoisted(() => ({
  useInboxDataMock: vi.fn(),
  useInboxNotificationsMock: vi.fn(),
}));

vi.mock("../../../features/inbox-data/model/useInbox", () => ({
  useInboxData: useInboxDataMock,
}));

vi.mock("../../../features/inbox-notifications/model/useInboxNotifications", () => ({
  useInboxNotifications: useInboxNotificationsMock,
}));

vi.mock("../../../shared/hooks/useTauriEventListener", () => ({
  useTauriEventListener: vi.fn(),
}));

const DASHBOARD_DATA_FIXTURE: InboxData = {
  mergeRequests: [],
  todos: [],
  pipelines: [
    {
      id: 100,
      iid: 100,
      projectId: 1,
      status: "success",
      source: "push",
      ref: "main",
      sha: "abc123",
      webUrl: "https://gitlab.com/example/repo/-/pipelines/100",
      createdAt: "2026-02-10T10:00:00.000Z",
      updatedAt: "2026-02-10T11:00:00.000Z",
    },
  ],
};

describe("Dashboard", () => {
  beforeEach(() => {
    useInboxNotificationsMock.mockReset();
    useInboxDataMock.mockReset();
  });

  it("renders loading state", () => {
    useInboxDataMock.mockReturnValue({
      data: null,
      isLoading: true,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<Dashboard currentUsername="me" />);

    expect(screen.queryByText("Loading inbox...")).not.toBeNull();
  });

  it("switches tabs and renders pipeline list", () => {
    useInboxDataMock.mockReturnValue({
      data: DASHBOARD_DATA_FIXTURE,
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<Dashboard currentUsername="me" />);

    expect(screen.queryByText("Inbox Zero")).not.toBeNull();

    fireEvent.click(screen.getByTitle("My Pipelines"));

    expect(screen.queryByText("Pipeline")).not.toBeNull();
  });
});
