import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { useEffect, useRef } from "react";

import { getGroupedItems } from "../features/inbox/inboxListUtils";
import type { GroupedItem } from "../features/inbox/inboxListUtils";
import type { InboxData, Pipeline } from "../schemas";

const NOTIFICATION_SOUND_SRC = "/notification-sound.mp3";
const AUDIO_START_TIME_SEC = 0;
const WINDOW_TAURI_GLOBAL = "__TAURI_INTERNALS__";

const TERMINAL_PIPELINE_STATUSES = new Set([
  "success",
  "failed",
  "canceled",
  "skipped",
  "manual",
]);

type NotificationConfig = {
  title: string;
  body?: string;
};

type TauriWindow = Window & {
  __TAURI_INTERNALS__?: unknown;
};

const getNotificationItemIds = (
  data: InboxData | null | undefined,
  currentUsername?: string,
  precomputedItems?: GroupedItem[],
) => {
  if (!data) {
    return new Set<string>();
  }
  const items = precomputedItems ?? getGroupedItems(data, "notifications", currentUsername);
  return new Set(items.map((item) => item.id));
};

const getPipelineStatusMap = (pipelines: Pipeline[]) => {
  const statusMap = new Map<number, string>();
  pipelines.forEach((pipeline) => {
    statusMap.set(pipeline.id, pipeline.status);
  });
  return statusMap;
};

const normalizeStatus = (status?: string | null) => (status ? status.toLowerCase() : "");

const isTerminalPipelineStatus = (status?: string | null) => {
  const normalized = normalizeStatus(status);
  return TERMINAL_PIPELINE_STATUSES.has(normalized);
};

const getFinishedPipelines = (
  previousStatusMap: Map<number, string>,
  pipelines: Pipeline[],
) => {
  const finished: Pipeline[] = [];

  pipelines.forEach((pipeline) => {
    const previousStatus = previousStatusMap.get(pipeline.id);
    if (!previousStatus) {
      return;
    }
    const wasTerminal = isTerminalPipelineStatus(previousStatus);
    const isTerminal = isTerminalPipelineStatus(pipeline.status);

    if (!wasTerminal && isTerminal) {
      finished.push(pipeline);
    }
  });

  return finished;
};

const getNotificationTitle = (count: number) => {
  if (count === 1) {
    return "New notification";
  }
  return `${count} new notifications`;
};

const getNotificationBody = (item: GroupedItem) => {
  if (item.todo?.body) {
    return item.todo.body;
  }
  if (item.mr?.title) {
    return item.mr.title;
  }
  return "Open Gitlabify to view details.";
};

const getPipelineNotificationConfig = (pipelines: Pipeline[]): NotificationConfig => {
  if (pipelines.length === 1) {
    const pipeline = pipelines[0];
    const pipelineId = pipeline.iid ?? pipeline.id;
    return {
      title: `Pipeline finished: ${pipeline.status}`,
      body: `#${pipelineId} on ${pipeline.ref}`,
    };
  }

  return {
    title: `${pipelines.length} pipelines finished`,
    body: "Open Gitlabify to view results.",
  };
};

const isTauriRuntime = () => {
  if (typeof window === "undefined") {
    return false;
  }
  return WINDOW_TAURI_GLOBAL in (window as TauriWindow);
};

const isWebNotificationSupported = () =>
  typeof window !== "undefined" && typeof Notification !== "undefined";

const ensureNotificationPermission = async () => {
  if (isTauriRuntime()) {
    try {
      const granted = await isPermissionGranted();
      if (granted) {
        return true;
      }
      const permission = await requestPermission();
      return permission === "granted";
    } catch (error) {
      console.warn("Tauri notification permission check/request failed", error);
      return false;
    }
  }

  if (!isWebNotificationSupported()) {
    return false;
  }

  if (Notification.permission === "granted") {
    return true;
  }
  if (Notification.permission === "denied") {
    return false;
  }
  const permission = await Notification.requestPermission();
  return permission === "granted";
};

const showDesktopNotification = async ({ title, body }: NotificationConfig) => {
  if (isTauriRuntime()) {
    try {
      await sendNotification(body ? { title, body } : { title });
      return;
    } catch (error) {
      console.warn("Tauri notification send failed", error);
    }
    return;
  }

  if (!isWebNotificationSupported()) {
    return;
  }
  if (Notification.permission !== "granted") {
    return;
  }
  const notification = new Notification(title, body ? { body } : undefined);
  notification.onclick = () => {
    window.focus();
    notification.close();
  };
};

export const useInboxNotifications = (
  inboxData: InboxData | null | undefined,
  currentUsername?: string,
) => {
  const previousNotificationIdsRef = useRef<Set<string> | null>(null);
  const previousPipelineStatusRef = useRef<Map<number, string> | null>(null);
  const hasInitializedRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!inboxData) {
      return;
    }

    const notificationItems = getGroupedItems(inboxData, "notifications", currentUsername);
    const currentNotificationIds = getNotificationItemIds(
      inboxData,
      currentUsername,
      notificationItems,
    );
    const currentPipelineStatusMap = getPipelineStatusMap(inboxData.pipelines);

    if (!hasInitializedRef.current) {
      previousNotificationIdsRef.current = currentNotificationIds;
      previousPipelineStatusRef.current = currentPipelineStatusMap;
      hasInitializedRef.current = true;
      return;
    }

    const previousNotificationIds = previousNotificationIdsRef.current ?? new Set<string>();
    const previousPipelineStatusMap =
      previousPipelineStatusRef.current ?? new Map<number, string>();

    const newNotifications = notificationItems.filter(
      (item) => !previousNotificationIds.has(item.id),
    );

    const finishedPipelines = getFinishedPipelines(
      previousPipelineStatusMap,
      inboxData.pipelines,
    );

    const playNotificationSound = () => {
      if (!audioRef.current) {
        audioRef.current = new Audio(NOTIFICATION_SOUND_SRC);
      }
      const audio = audioRef.current;
      audio.currentTime = AUDIO_START_TIME_SEC;
      audio.play().catch((error) => {
        console.warn("Unable to play notification sound", error);
      });
    };

    const maybeNotify = async (config: NotificationConfig) => {
      playNotificationSound();
      const hasPermission = await ensureNotificationPermission();
      if (!hasPermission) {
        return;
      }
      await showDesktopNotification(config);
    };

    if (newNotifications.length > 0) {
      const title = getNotificationTitle(newNotifications.length);
      const body =
        newNotifications.length === 1 ? getNotificationBody(newNotifications[0]) : undefined;
      void maybeNotify({ title, body });
    }

    if (finishedPipelines.length > 0) {
      void maybeNotify(getPipelineNotificationConfig(finishedPipelines));
    }

    previousNotificationIdsRef.current = currentNotificationIds;
    previousPipelineStatusRef.current = currentPipelineStatusMap;
  }, [currentUsername, inboxData]);

};
