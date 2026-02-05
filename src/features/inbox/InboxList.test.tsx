import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import type { InboxData } from "../../schemas";

import { InboxList } from "./InboxList";

import "@testing-library/jest-dom";

describe("InboxList", () => {
  it("shows loading state", () => {
    render(<InboxList isLoading={true} data={undefined} />);
    expect(screen.getByText("Loading inbox...")).toBeInTheDocument();
  });

  it("shows empty state", () => {
    const emptyData: InboxData = { mergeRequests: [], todos: [], pipelines: [] };
    render(<InboxList isLoading={false} data={emptyData} />);
    expect(screen.getByText("Inbox Zero")).toBeInTheDocument();
  });

  it("renders items", () => {
    const mockData: InboxData = {
      mergeRequests: [
        {
          id: 1,
          iid: 1,
          projectId: 1,
          title: "Fix bug",
          description: "Fixing a bug",
          state: "opened",
          createdAt: "2023-01-01T00:00:00Z",
          updatedAt: new Date().toISOString(), // recent
          webUrl: "http://gitlab.com/mr/1",
          author: { id: 1, name: "Alice", username: "alice", avatarUrl: null },
          hasConflicts: false,
          blockingDiscussionsResolved: true,
          headPipeline: null,
          draft: false,
          workInProgress: false,
        },
      ],
      todos: [],
      pipelines: [],
    };

    render(<InboxList isLoading={false} data={mockData} />);
    expect(screen.getByText("Fix bug")).toBeInTheDocument();
  });

  it("deduplicates MR and Todo", () => {
    const mockData: InboxData = {
      mergeRequests: [
        {
          id: 1,
          iid: 1,
          projectId: 1,
          title: "Double item check",
          description: "desc",
          state: "opened",
          createdAt: "2023-01-01T00:00:00Z",
          updatedAt: new Date().toISOString(),
          webUrl: "http://gitlab.com/mr/1",
          author: { id: 1, name: "Alice", username: "alice", avatarUrl: null },
          hasConflicts: false,
          blockingDiscussionsResolved: true,
          headPipeline: null,
          draft: false,
          workInProgress: false,
        },
      ],
      todos: [
        {
          id: 100,
          projectId: 1,
          author: { id: 2, name: "Bob", username: "bob", avatarUrl: null },
          actionName: "assigned",
          targetType: "MergeRequest",
          targetUrl: "http://gitlab.com/mr/1",
          body: "Fix bug",
          state: "pending",
          createdAt: new Date().toISOString(),
          target: {
            id: 1,
            iid: 1,
            projectId: 1,
            title: "Double item check",
            description: "desc",
            state: "opened",
            createdAt: "2023-01-01T00:00:00Z",
            updatedAt: new Date().toISOString(),
            webUrl: "http://gitlab.com/mr/1",
            author: { id: 1, name: "Alice", username: "alice", avatarUrl: null },
            hasConflicts: false,
            blockingDiscussionsResolved: true,
            headPipeline: null,
            draft: false,
            workInProgress: false,
          },
        },
      ],
      pipelines: [],
    };

    render(<InboxList isLoading={false} data={mockData} />);
    // getByText throws if more than one element is found
    expect(screen.getByText("Double item check")).toBeInTheDocument();
    // Ensure we don't have multiple
    expect(screen.getAllByText("Double item check")).toHaveLength(1);
  });

  it("filters by notifications vs mrs", () => {
    const mockData: InboxData = {
      mergeRequests: [
        {
          id: 1,
          iid: 1,
          projectId: 1,
          title: "Other's MR",
          description: "desc",
          state: "opened",
          createdAt: "2023-01-01T00:00:00Z",
          updatedAt: new Date().toISOString(),
          webUrl: "http://gitlab.com/mr/1",
          author: { id: 2, name: "Bob", username: "bob", avatarUrl: null },
          hasConflicts: false,
          blockingDiscussionsResolved: true,
          headPipeline: null,
          draft: false,
          workInProgress: false,
        },
        {
          id: 2,
          iid: 2,
          projectId: 1,
          title: "My MR",
          description: "desc",
          state: "opened",
          createdAt: "2023-01-01T00:00:00Z",
          updatedAt: new Date().toISOString(),
          webUrl: "http://gitlab.com/mr/2",
          author: { id: 1, name: "Alice", username: "alice", avatarUrl: null },
          hasConflicts: false,
          blockingDiscussionsResolved: true,
          headPipeline: null,
          draft: false,
          workInProgress: false,
        },
      ],
      todos: [],
      pipelines: [],
    };

    const currentUsername = "alice";

    // 1. Notifications tab
    const { rerender } = render(
      <InboxList
        isLoading={false}
        data={mockData}
        filter="notifications"
        currentUsername={currentUsername}
      />,
    );
    expect(screen.getByText("Other's MR")).toBeInTheDocument();
    expect(screen.queryByText("My MR")).not.toBeInTheDocument();

    // 2. My MRs tab
    rerender(
      <InboxList
        isLoading={false}
        data={mockData}
        filter="mrs"
        currentUsername={currentUsername}
      />,
    );
    expect(screen.queryByText("Other's MR")).not.toBeInTheDocument();
    expect(screen.getByText("My MR")).toBeInTheDocument();

    // 3. My Pipelines tab
    rerender(
      <InboxList
        isLoading={false}
        data={mockData}
        filter="pipelines"
        currentUsername={currentUsername}
      />,
    );
    // Neither should show because none have headPipeline
    expect(screen.queryByText("Other's MR")).not.toBeInTheDocument();
    expect(screen.queryByText("My MR")).not.toBeInTheDocument();

    // Update My MR to have a pipeline
    const mockDataWithPipeline: InboxData = {
      ...mockData,
      mergeRequests: [
        mockData.mergeRequests[0],
        {
          ...mockData.mergeRequests[1],
          headPipeline: {
            id: 10,
            iid: 1,
            projectId: 1,
            status: "success",
            source: "push",
            ref: "main",
            sha: "abc",
            webUrl: "url",
            createdAt: "now",
            updatedAt: "now",
          },
        },
      ],
    };

    rerender(
      <InboxList
        isLoading={false}
        data={mockDataWithPipeline}
        filter="pipelines"
        currentUsername={currentUsername}
      />,
    );
    expect(screen.queryByText("Other's MR")).not.toBeInTheDocument();
    expect(screen.getByText("My MR")).toBeInTheDocument();
  });
});
