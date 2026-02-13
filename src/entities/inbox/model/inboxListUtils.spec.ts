import { describe, expect, it } from "vitest";

import { getGroupedItems, type InboxData, type MergeRequest, type Todo } from "./index";

const createMergeRequest = (overrides: Partial<MergeRequest>): MergeRequest => ({
  id: 1,
  iid: 1,
  projectId: 1,
  sourceBranch: "feature/test",
  title: "My merge request",
  description: null,
  state: "opened",
  createdAt: "2026-02-10T10:00:00.000Z",
  updatedAt: "2026-02-10T11:00:00.000Z",
  webUrl: "https://gitlab.com/example/repo/-/merge_requests/1",
  author: {
    id: 10,
    username: "alice",
    name: "Alice",
    avatarUrl: null,
  },
  hasConflicts: false,
  blockingDiscussionsResolved: true,
  headPipeline: null,
  draft: false,
  workInProgress: false,
  isReviewer: false,
  approvedByMe: false,
  ...overrides,
});

const createTodo = (overrides: Partial<Todo>): Todo => ({
  id: 500,
  projectId: 1,
  author: {
    id: 11,
    username: "bob",
    name: "Bob",
    avatarUrl: null,
  },
  actionName: "commented",
  targetType: "MergeRequest",
  targetUrl: "https://gitlab.com/example/repo/-/merge_requests/1",
  target: null,
  body: "new comment",
  state: "pending",
  createdAt: "2026-02-10T12:00:00.000Z",
  ...overrides,
});

describe("getGroupedItems", () => {
  it("returns notifications for review requests and comments on my merge request", () => {
    const mrByMe = createMergeRequest({
      id: 1,
      iid: 101,
      author: { id: 42, username: "me", name: "Me", avatarUrl: null },
      updatedAt: "2026-02-10T10:00:00.000Z",
      isReviewer: false,
    });

    const reviewMr = createMergeRequest({
      id: 2,
      iid: 102,
      author: { id: 50, username: "teammate", name: "Teammate", avatarUrl: null },
      updatedAt: "2026-02-10T11:00:00.000Z",
      isReviewer: true,
      approvedByMe: false,
      draft: false,
    });

    const commentOnMyMr = createTodo({
      id: 700,
      actionName: "commented",
      author: { id: 50, username: "teammate", name: "Teammate", avatarUrl: null },
      createdAt: "2026-02-10T13:00:00.000Z",
      target: mrByMe,
    });

    const byMeComment = createTodo({
      id: 701,
      actionName: "commented",
      author: { id: 42, username: "me", name: "Me", avatarUrl: null },
      target: reviewMr,
      createdAt: "2026-02-10T14:00:00.000Z",
    });

    const data: InboxData = {
      mergeRequests: [mrByMe, reviewMr],
      todos: [commentOnMyMr, byMeComment],
      pipelines: [],
    };

    const result = getGroupedItems(data, "notifications", "me");

    expect(result.map((item) => item.id)).toEqual(["mr-2", "mr-1"]);
    expect(result[0]?.mr?.id).toBe(2);
    expect(result[1]?.todo?.id).toBe(700);
  });

  it("returns only authored merge requests in mrs filter and keeps descending date order", () => {
    const myOlderMr = createMergeRequest({
      id: 10,
      iid: 210,
      author: { id: 42, username: "me", name: "Me", avatarUrl: null },
      updatedAt: "2026-02-09T10:00:00.000Z",
    });

    const myNewerMr = createMergeRequest({
      id: 11,
      iid: 211,
      author: { id: 42, username: "me", name: "Me", avatarUrl: null },
      updatedAt: "2026-02-10T10:00:00.000Z",
    });

    const someoneElseMr = createMergeRequest({
      id: 12,
      iid: 212,
      author: { id: 80, username: "other", name: "Other", avatarUrl: null },
      updatedAt: "2026-02-11T10:00:00.000Z",
    });

    const data: InboxData = {
      mergeRequests: [myOlderMr, myNewerMr, someoneElseMr],
      todos: [],
      pipelines: [],
    };

    const result = getGroupedItems(data, "mrs", "me");

    expect(result.map((item) => item.id)).toEqual(["mr-11", "mr-10"]);
  });
});
