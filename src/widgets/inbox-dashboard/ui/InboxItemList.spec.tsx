import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GroupedItem } from "../../../entities/inbox/model";

import { InboxItemList } from "./InboxItemList";

const { openUrlMock } = vi.hoisted(() => ({
  openUrlMock: vi.fn(),
}));

const { markTodoAsDoneMock } = vi.hoisted(() => ({
  markTodoAsDoneMock: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: openUrlMock,
}));

vi.mock("../../../shared/api/tauri/inboxActions", () => ({
  markTodoAsDone: markTodoAsDoneMock,
}));

const createItem = (): GroupedItem => ({
  id: "todo-901",
  date: new Date("2026-02-13T12:00:00.000Z"),
  todo: {
    id: 901,
    projectId: 1,
    author: {
      id: 11,
      username: "reviewer",
      name: "Reviewer",
      avatarUrl: null,
    },
    actionName: "mentioned",
    targetType: "MergeRequest",
    targetUrl: "https://gitlab.com/example/repo/-/merge_requests/10",
    target: null,
    body: "Please check this",
    state: "pending",
    createdAt: "2026-02-13T12:00:00.000Z",
  },
});

describe("InboxItemList", () => {
  beforeEach(() => {
    openUrlMock.mockReset();
    markTodoAsDoneMock.mockReset();
  });

  it("renders a mark-as-done action for todo items", () => {
    render(
      <InboxItemList
        items={[createItem()]}
        filter="notifications"
        selectedItemId="-1"
        hoveredItemId="-1"
        hasHover={false}
        onListMouseMove={vi.fn()}
        onListMouseLeave={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Mark as done" })).not.toBeNull();
  });

  it("does not open external URL when mark-as-done action is clicked", async () => {
    markTodoAsDoneMock.mockResolvedValue(undefined);

    render(
      <InboxItemList
        items={[createItem()]}
        filter="notifications"
        selectedItemId="-1"
        hoveredItemId="-1"
        hasHover={false}
        onListMouseMove={vi.fn()}
        onListMouseLeave={vi.fn()}
      />,
    );

    const button = screen.getByRole("button", { name: "Mark as done" });
    fireEvent.click(button);

    await waitFor(() => {
      expect(markTodoAsDoneMock).toHaveBeenCalledWith(901);
    });

    expect(openUrlMock).not.toHaveBeenCalled();
  });

  it("hides the row when mark-as-done succeeds", async () => {
    markTodoAsDoneMock.mockResolvedValue(undefined);

    render(
      <InboxItemList
        items={[createItem()]}
        filter="notifications"
        selectedItemId="-1"
        hoveredItemId="-1"
        hasHover={false}
        onListMouseMove={vi.fn()}
        onListMouseLeave={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Mark as done" }));

    await waitFor(() => {
      expect(screen.queryByText("Please check this")).toBeNull();
    });
  });

  it("keeps the row visible when mark-as-done fails", async () => {
    markTodoAsDoneMock.mockRejectedValue(new Error("mark as done failed"));

    render(
      <InboxItemList
        items={[createItem()]}
        filter="notifications"
        selectedItemId="-1"
        hoveredItemId="-1"
        hasHover={false}
        onListMouseMove={vi.fn()}
        onListMouseLeave={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Mark as done" }));

    await waitFor(() => {
      expect(markTodoAsDoneMock).toHaveBeenCalledWith(901);
    });

    expect(screen.queryByText("Please check this")).not.toBeNull();
  });

  it("shows a dismissed row again when refetched data includes the todo", async () => {
    markTodoAsDoneMock.mockResolvedValue(undefined);

    const { rerender } = render(
      <InboxItemList
        items={[createItem()]}
        filter="notifications"
        selectedItemId="-1"
        hoveredItemId="-1"
        hasHover={false}
        onListMouseMove={vi.fn()}
        onListMouseLeave={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Mark as done" }));

    await waitFor(() => {
      expect(screen.queryByText("Please check this")).toBeNull();
    });

    rerender(
      <InboxItemList
        items={[createItem()]}
        filter="notifications"
        selectedItemId="-1"
        hoveredItemId="-1"
        hasHover={false}
        onListMouseMove={vi.fn()}
        onListMouseLeave={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByText("Please check this")).not.toBeNull();
    });
  });
});
