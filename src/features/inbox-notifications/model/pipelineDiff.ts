import type { Pipeline } from "../../../entities/inbox/model";

import type { NotificationConfig } from "./notificationDiff";

const TERMINAL_PIPELINE_STATUSES = new Set(["success", "failed", "canceled", "skipped", "manual"]);
const HIGH_URGENCY_STATUSES = new Set(["failed"]);

const normalizeStatus = (status?: string | null) => (status ? status.toLowerCase() : "");

export const getPipelineStatusMap = (pipelines: Pipeline[]) => {
  const statusMap = new Map<number, string>();
  pipelines.forEach((pipeline) => {
    statusMap.set(pipeline.id, pipeline.status);
  });
  return statusMap;
};

export const isTerminalPipelineStatus = (status?: string | null) => {
  return TERMINAL_PIPELINE_STATUSES.has(normalizeStatus(status));
};

export const getFinishedPipelines = (
  previousStatusMap: Map<number, string>,
  pipelines: Pipeline[],
) => {
  return pipelines.filter((pipeline) => {
    const previousStatus = previousStatusMap.get(pipeline.id);
    if (!previousStatus) {
      return false;
    }

    return !isTerminalPipelineStatus(previousStatus) && isTerminalPipelineStatus(pipeline.status);
  });
};

export const getPipelineNotificationConfig = (pipelines: Pipeline[]): NotificationConfig => {
  if (pipelines.length === 1) {
    const pipeline = pipelines[0];
    const pipelineId = pipeline.id;
    const status = normalizeStatus(pipeline.status);
    const isSuccess = status === "success";

    return {
      title: isSuccess ? "Pipeline passed" : `Pipeline finished: ${pipeline.status}`,
      body: `#${pipelineId} on ${pipeline.ref}${isSuccess ? " finished successfully" : ""}`,
      importance: HIGH_URGENCY_STATUSES.has(status) ? "High" : undefined,
      url: pipeline.webUrl,
    };
  }

  const allSuccess = pipelines.every((p) => normalizeStatus(p.status) === "success");
  const hasFailure = pipelines.some((p) => HIGH_URGENCY_STATUSES.has(normalizeStatus(p.status)));

  return {
    title: `${pipelines.length} pipelines finished`,
    body: allSuccess ? "All pipelines finished successfully." : "Open Gitlabify to view results.",
    importance: hasFailure ? "High" : undefined,
  };
};
