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
          sourceBranch: "main",
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
          isReviewer: true,
          approvedByMe: false,
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
          sourceBranch: "main",
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
          isReviewer: true,
          approvedByMe: false,
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
            sourceBranch: "main",
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
            isReviewer: true,
            approvedByMe: false,
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
          sourceBranch: "main",
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
          isReviewer: true,
          approvedByMe: false,
        },
        {
          id: 2,
          iid: 2,
          projectId: 1,
          sourceBranch: "main",
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
          isReviewer: false,
          approvedByMe: false,
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
    // No pipelines in data yet
    expect(screen.getByText("Inbox Zero")).toBeInTheDocument();
  });

  it("hides reviewer MRs already approved by me", () => {
    const mockData: InboxData = {
      mergeRequests: [
        {
          id: 10,
          iid: 10,
          projectId: 1,
          sourceBranch: "main",
          title: "Needs review but already approved",
          description: "desc",
          state: "opened",
          createdAt: "2023-01-01T00:00:00Z",
          updatedAt: new Date().toISOString(),
          webUrl: "http://gitlab.com/mr/10",
          author: { id: 2, name: "Bob", username: "bob", avatarUrl: null },
          hasConflicts: false,
          blockingDiscussionsResolved: true,
          headPipeline: null,
          draft: false,
          workInProgress: false,
          isReviewer: true,
          approvedByMe: true,
        },
      ],
      todos: [],
      pipelines: [],
    };

    render(
      <InboxList
        isLoading={false}
        data={mockData}
        filter="notifications"
        currentUsername="alice"
      />,
    );

    expect(screen.queryByText("Needs review but already approved")).not.toBeInTheDocument();
  });

  it("shows comments and mentions even on draft MRs", () => {
    const mockData: InboxData = {
      mergeRequests: [],
      todos: [
        {
          id: 200,
          projectId: 1,
          author: { id: 2, name: "Bob", username: "bob", avatarUrl: null },
          actionName: "commented",
          targetType: "MergeRequest",
          targetUrl: "http://gitlab.com/mr/200",
          body: "Looks good",
          state: "pending",
          createdAt: new Date().toISOString(),
          target: {
            id: 200,
            iid: 200,
            projectId: 1,
            sourceBranch: "main",
            title: "Draft MR with comment",
            description: "desc",
            state: "opened",
            createdAt: "2023-01-01T00:00:00Z",
            updatedAt: new Date().toISOString(),
            webUrl: "http://gitlab.com/mr/200",
            author: { id: 1, name: "Alice", username: "alice", avatarUrl: null },
            hasConflicts: false,
            blockingDiscussionsResolved: true,
            headPipeline: null,
            draft: true,
            workInProgress: false,
            isReviewer: false,
            approvedByMe: false,
          },
        },
        {
          id: 201,
          projectId: 1,
          author: { id: 3, name: "Cara", username: "cara", avatarUrl: null },
          actionName: "mentioned",
          targetType: "MergeRequest",
          targetUrl: "http://gitlab.com/mr/201",
          body: "@alice take a look",
          state: "pending",
          createdAt: new Date().toISOString(),
          target: {
            id: 201,
            iid: 201,
            projectId: 1,
            sourceBranch: "main",
            title: "Draft MR with mention",
            description: "desc",
            state: "opened",
            createdAt: "2023-01-01T00:00:00Z",
            updatedAt: new Date().toISOString(),
            webUrl: "http://gitlab.com/mr/201",
            author: { id: 1, name: "Alice", username: "alice", avatarUrl: null },
            hasConflicts: false,
            blockingDiscussionsResolved: true,
            headPipeline: null,
            draft: true,
            workInProgress: false,
            isReviewer: false,
            approvedByMe: false,
          },
        },
      ],
      pipelines: [],
    };

    render(
      <InboxList
        isLoading={false}
        data={mockData}
        filter="notifications"
        currentUsername="alice"
      />,
    );

    expect(screen.getByText("Draft MR with comment")).toBeInTheDocument();
    expect(screen.getByText("Draft MR with mention")).toBeInTheDocument();
  });

  it("shows comment todo even when target is missing", () => {
    const mockData: InboxData = {
      mergeRequests: [],
      todos: [
        {
          id: 300,
          projectId: 1,
          author: { id: 2, name: "Bob", username: "bob", avatarUrl: null },
          actionName: "commented",
          targetType: "MergeRequest",
          targetUrl: "http://gitlab.com/mr/300",
          body: "Please check this",
          state: "pending",
          createdAt: new Date().toISOString(),
          target: null,
        },
      ],
      pipelines: [],
    };

    render(
      <InboxList
        isLoading={false}
        data={mockData}
        filter="notifications"
        currentUsername="alice"
      />,
    );

    expect(screen.getByText("Please check this")).toBeInTheDocument();
  });

  it("renders pipelines view with branch and pipeline id", () => {
    const mockData: InboxData = {
      mergeRequests: [],
      todos: [],
      pipelines: [
        {
          id: 101,
          iid: 5,
          projectId: 1,
          status: "success",
          source: "push",
          ref: "refs/merge-requests/42/head",
          sha: "abc",
          webUrl: "http://gitlab.com/pipelines/101",
          createdAt: "2023-01-01T00:00:00Z",
          updatedAt: "2023-01-02T00:00:00Z",
        },
      ],
    };

    render(<InboxList isLoading={false} data={mockData} filter="pipelines" />);
    expect(screen.getByText("Merge Request #42")).toBeInTheDocument();
    expect(screen.getByText("Pipeline #5")).toBeInTheDocument();
  });

  it("renders pipeline status icons for success and failure", () => {
    const mockData: InboxData = {
      mergeRequests: [],
      todos: [],
      pipelines: [
        {
          id: 201,
          iid: null,
          projectId: 1,
          status: "success",
          source: "push",
          ref: "main",
          sha: "abc",
          webUrl: "http://gitlab.com/pipelines/201",
          createdAt: "2023-01-01T00:00:00Z",
          updatedAt: "2023-01-02T00:00:00Z",
        },
        {
          id: 202,
          iid: null,
          projectId: 1,
          status: "failed",
          source: "push",
          ref: "develop",
          sha: "def",
          webUrl: "http://gitlab.com/pipelines/202",
          createdAt: "2023-01-01T00:00:00Z",
          updatedAt: "2023-01-03T00:00:00Z",
        },
      ],
    };

    const { container } = render(
      <InboxList isLoading={false} data={mockData} filter="pipelines" />,
    );

    const failedIcon = container.querySelector("svg.text-rose-500");

    expect(failedIcon).toBeInTheDocument();
  });

  it("renders feature branch name when ref does not match MR pattern", () => {
    const mockData: InboxData = {
      mergeRequests: [],
      todos: [],
      pipelines: [
        {
          id: 301,
          iid: null,
          projectId: 1,
          status: "running",
          source: "push",
          ref: "feature/new-login-flow",
          sha: "ghi",
          webUrl: "http://gitlab.com/pipelines/301",
          createdAt: "2023-01-01T00:00:00Z",
          updatedAt: "2023-01-02T00:00:00Z",
        },
      ],
    };

    render(<InboxList isLoading={false} data={mockData} filter="pipelines" />);
    expect(screen.getByText("feature/new-login-flow")).toBeInTheDocument();
    expect(screen.queryByText(/Merge Request #/)).not.toBeInTheDocument();
  });
});
