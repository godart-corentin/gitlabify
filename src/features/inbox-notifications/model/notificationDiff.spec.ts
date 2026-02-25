import { describe, expect, it } from "vitest";

import type { GroupedItem, Pipeline } from "../../../entities/inbox/model";

import {
  getNewNotifications,
  getNotificationTitle,
  getNotificationBody,
  isUrgentNotification,
} from "./notificationDiff";
import {
  getFinishedPipelines,
  getPipelineStatusMap,
  getPipelineNotificationConfig,
} from "./pipelineDiff";

const createAuthor = (name: string) => ({
  id: 1,
  username: "user1",
  name,
  avatarUrl: "https://avatar.com/1",
});

const createGroupedItem = (id: string): GroupedItem => ({
  id,
  date: new Date("2026-02-10T10:00:00.000Z"),
});

const createPipeline = (id: number, status: string): Pipeline => ({
  id,
  iid: id,
  projectId: 1,
  status,
  source: "push",
  ref: "main",
  sha: "abc123",
  webUrl: `https://gitlab.com/pipelines/${id}`,
  createdAt: "2026-02-10T10:00:00.000Z",
  updatedAt: "2026-02-10T11:00:00.000Z",
});

describe("notification diff", () => {
  describe("getNotificationTitle", () => {
    it("returns correct title for single generic notification", () => {
      expect(getNotificationTitle(1, createGroupedItem("1"))).toBe("New notification");
    });

    it("returns correct title for single mention notification", () => {
      const item: GroupedItem = {
        ...createGroupedItem("1"),
        todo: {
          id: 1,
          projectId: 1,
          author: createAuthor("John Doe"),
          actionName: "mentioned",
          targetType: "MergeRequest",
          targetUrl: "url",
          target: null,
          body: "Hello",
          state: "pending",
          createdAt: "2026-02-10T10:00:00.000Z",
        },
      };
      expect(getNotificationTitle(1, item)).toBe("Mention from John Doe");
    });

    it("returns correct title for single assignment notification", () => {
      const item: GroupedItem = {
        ...createGroupedItem("1"),
        todo: {
          id: 1,
          projectId: 1,
          author: createAuthor("John Doe"),
          actionName: "assigned",
          targetType: "MergeRequest",
          targetUrl: "url",
          target: null,
          body: null,
          state: "pending",
          createdAt: "2026-02-10T10:00:00.000Z",
        },
      };
      expect(getNotificationTitle(1, item)).toBe("Assigned by John Doe");
    });

    it("returns correct title for single MR-only notification", () => {
      const item: GroupedItem = {
        ...createGroupedItem("1"),
        mr: {
          id: 1,
          iid: 1,
          projectId: 1,
          sourceBranch: "branch",
          title: "MR Title",
          description: "desc",
          state: "opened",
          createdAt: "2026-02-10T10:00:00.000Z",
          updatedAt: "2026-02-10T10:00:00.000Z",
          webUrl: "url",
          author: createAuthor("Jane Doe"),
          hasConflicts: false,
          blockingDiscussionsResolved: true,
          headPipeline: null,
          draft: false,
          workInProgress: false,
          isReviewer: true,
          approvedByMe: false,
          reviewedByMe: false,
        },
      };
      expect(getNotificationTitle(1, item)).toBe("Review request from Jane Doe");
    });

    it("returns correct title for single comment notification", () => {
      const item: GroupedItem = {
        ...createGroupedItem("1"),
        todo: {
          id: 1,
          projectId: 1,
          author: createAuthor("John Doe"),
          actionName: "commented",
          targetType: "MergeRequest",
          targetUrl: "url",
          target: null,
          body: "Nice work!",
          state: "pending",
          createdAt: "2026-02-10T10:00:00.000Z",
        },
      };
      expect(getNotificationTitle(1, item)).toBe("Comment from John Doe");
    });

    it("returns correct title for multiple notifications", () => {
      expect(getNotificationTitle(3)).toBe("3 new notifications");
    });
  });

  describe("getNotificationBody", () => {
    it("combines mr title and todo body if both available", () => {
      const item: GroupedItem = {
        ...createGroupedItem("1"),
        mr: {
          id: 1,
          iid: 1,
          projectId: 1,
          sourceBranch: "branch",
          title: "MR Title",
          description: "desc",
          state: "opened",
          createdAt: "2026-02-10T10:00:00.000Z",
          updatedAt: "2026-02-10T10:00:00.000Z",
          webUrl: "url",
          author: createAuthor("Jane Doe"),
          hasConflicts: false,
          blockingDiscussionsResolved: true,
          headPipeline: null,
          draft: false,
          workInProgress: false,
          isReviewer: true,
          approvedByMe: false,
          reviewedByMe: false,
        },
        todo: {
          id: 1,
          projectId: 1,
          author: createAuthor("John Doe"),
          actionName: "mentioned",
          targetType: "MergeRequest",
          targetUrl: "url",
          target: null,
          body: "Hello world",
          state: "pending",
          createdAt: "2026-02-10T10:00:00.000Z",
        },
      };
      expect(getNotificationBody(item)).toBe("MR Title: Hello world");
    });

    it("uses mr title if todo body is not available", () => {
      const item: GroupedItem = {
        ...createGroupedItem("1"),
        mr: {
          id: 1,
          iid: 1,
          projectId: 1,
          sourceBranch: "branch",
          title: "MR Title",
          description: "desc",
          state: "opened",
          createdAt: "2026-02-10T10:00:00.000Z",
          updatedAt: "2026-02-10T10:00:00.000Z",
          webUrl: "url",
          author: createAuthor("Jane Doe"),
          hasConflicts: false,
          blockingDiscussionsResolved: true,
          headPipeline: null,
          draft: false,
          workInProgress: false,
          isReviewer: true,
          approvedByMe: false,
          reviewedByMe: false,
        },
      };
      expect(getNotificationBody(item)).toBe("MR Title");
    });

    it("returns default body if neither todo body nor mr title is available", () => {
      const item = createGroupedItem("1");
      expect(getNotificationBody(item)).toBe("Open Gitlabify to view details.");
    });
  });

  describe("isUrgentNotification", () => {
    it("returns true for mentions", () => {
      const item: GroupedItem = {
        ...createGroupedItem("1"),
        todo: {
          id: 1,
          projectId: 1,
          author: createAuthor("John"),
          actionName: "mentioned",
          targetType: "MR",
          targetUrl: "url",
          target: null,
          body: "Hello",
          state: "pending",
          createdAt: "2026",
        },
      };
      expect(isUrgentNotification(item)).toBe(true);
    });

    it("returns true for assignments", () => {
      const item: GroupedItem = {
        ...createGroupedItem("1"),
        todo: {
          id: 1,
          projectId: 1,
          author: createAuthor("John"),
          actionName: "assigned",
          targetType: "MR",
          targetUrl: "url",
          target: null,
          body: "Hello",
          state: "pending",
          createdAt: "2026",
        },
      };
      expect(isUrgentNotification(item)).toBe(true);
    });

    it("returns true for MR-only notifications", () => {
      const item: GroupedItem = {
        ...createGroupedItem("1"),
        mr: {
          id: 1,
          iid: 1,
          projectId: 1,
          sourceBranch: "branch",
          title: "MR Title",
          description: "desc",
          state: "opened",
          createdAt: "2026",
          updatedAt: "2026",
          webUrl: "url",
          author: createAuthor("Jane Doe"),
          hasConflicts: false,
          blockingDiscussionsResolved: true,
          headPipeline: null,
          draft: false,
          workInProgress: false,
          isReviewer: true,
          approvedByMe: false,
          reviewedByMe: false,
        },
      };
      expect(isUrgentNotification(item)).toBe(true);
    });

    it("returns false for generic notifications", () => {
      const item: GroupedItem = {
        ...createGroupedItem("1"),
        todo: {
          id: 1,
          projectId: 1,
          author: createAuthor("John"),
          actionName: "something_else",
          targetType: "MR",
          targetUrl: "url",
          target: null,
          body: "Hello",
          state: "pending",
          createdAt: "2026",
        },
      };
      expect(isUrgentNotification(item)).toBe(false);
    });
  });

  it("detects only unseen notifications", () => {
    const notifications = [createGroupedItem("a"), createGroupedItem("b")];
    const previousIds = new Set(["a"]);

    const result = getNewNotifications(notifications, previousIds);

    expect(result.map((item) => item.id)).toEqual(["b"]);
  });

  it("detects pipelines that moved into terminal status", () => {
    const previousStatusMap = getPipelineStatusMap([
      createPipeline(1, "running"),
      createPipeline(2, "pending"),
    ]);

    const currentPipelines = [createPipeline(1, "success"), createPipeline(2, "running")];

    const finished = getFinishedPipelines(previousStatusMap, currentPipelines);

    expect(finished.map((pipeline) => pipeline.id)).toEqual([1]);
  });

  it("formats config for a single successful pipeline", () => {
    const pipelines = [createPipeline(1, "success")];
    const config = getPipelineNotificationConfig(pipelines);

    expect(config.title).toBe("Pipeline passed");
    expect(config.body).toBe("#1 on main finished successfully");
    expect(config.importance).toBeUndefined();
  });

  it("formats config for a single failed pipeline", () => {
    const pipelines = [createPipeline(2, "failed")];
    const config = getPipelineNotificationConfig(pipelines);

    expect(config.title).toBe("Pipeline finished: failed");
    expect(config.body).toBe("#2 on main");
    expect(config.importance).toBe("High");
  });

  it("formats config for a single canceled pipeline (standard urgency)", () => {
    const pipelines = [createPipeline(3, "canceled")];
    const config = getPipelineNotificationConfig(pipelines);

    expect(config.title).toBe("Pipeline finished: canceled");
    expect(config.body).toBe("#3 on main");
    expect(config.importance).toBeUndefined();
  });

  it("formats config for multiple finished pipelines with failure", () => {
    const pipelines = [createPipeline(1, "success"), createPipeline(2, "failed")];
    const config = getPipelineNotificationConfig(pipelines);

    expect(config.title).toBe("2 pipelines finished");
    expect(config.body).toBe("Open Gitlabify to view results.");
    expect(config.importance).toBe("High");
  });

  it("formats config for multiple finished pipelines (all successful)", () => {
    const pipelines = [createPipeline(1, "success"), createPipeline(4, "SUCCESS")];
    const config = getPipelineNotificationConfig(pipelines);

    expect(config.title).toBe("2 pipelines finished");
    expect(config.body).toBe("All pipelines finished successfully.");
    expect(config.importance).toBeUndefined();
  });
});
