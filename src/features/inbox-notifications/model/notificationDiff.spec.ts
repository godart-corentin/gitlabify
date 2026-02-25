import { describe, expect, it } from "vitest";

import type { GroupedItem, Pipeline } from "../../../entities/inbox/model";

import { getNewNotifications } from "./notificationDiff";
import {
  getFinishedPipelines,
  getPipelineStatusMap,
  getPipelineNotificationConfig,
} from "./pipelineDiff";

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
