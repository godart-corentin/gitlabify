import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { onAction } from "@tauri-apps/plugin-notification";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useEffect, useRef } from "react";

import { getGroupedItems, type InboxData } from "../../../entities/inbox/model";

import { ensureNotificationPermission, showDesktopNotification } from "./notificationDelivery";
import {
  getNewNotifications,
  getNotificationBody,
  getNotificationItemIds,
  getNotificationTitle,
  isUrgentNotification,
} from "./notificationDiff";
import {
  getFinishedPipelines,
  getPipelineNotificationConfig,
  getPipelineStatusMap,
} from "./pipelineDiff";

const NOTIFICATION_SOUND_SRC = "/notification-sound.mp3";
const AUDIO_START_TIME_SEC = 0;

export const useInboxNotifications = (
  inboxData: InboxData | null | undefined,
  currentUsername?: string,
) => {
  const previousNotificationIdsRef = useRef<Set<string> | null>(null);
  const previousPipelineStatusRef = useRef<Map<number, string> | null>(null);
  const hasInitializedRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isPlayingRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    let unregister: (() => void) | undefined;

    const setupListener = async () => {
      try {
        const listener = await onAction(async (notification) => {
          const window = getCurrentWebviewWindow();
          await window.show();
          await window.unminimize();
          await window.setFocus();

          // If the extra data contains a URL, open it in the browser
          const url = notification.extra?.url;
          if (typeof url === "string" && (url.startsWith("http://") || url.startsWith("https://"))) {
            await openUrl(url);
          }
        });

        if (!isMounted) {
          void listener.unregister();
          return;
        }

        unregister = () => {
          void listener.unregister();
        };
      } catch (error) {
        console.warn("Failed to register notification action listener", error);
      }
    };

    void setupListener();

    return () => {
      isMounted = false;
      if (unregister) unregister();
    };
  }, []);

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

    const newNotifications = getNewNotifications(notificationItems, previousNotificationIds);
    const finishedPipelines = getFinishedPipelines(previousPipelineStatusMap, inboxData.pipelines);

    const playNotificationSound = () => {
      if (!audioRef.current) {
        audioRef.current = new Audio(NOTIFICATION_SOUND_SRC);
      }

      const audio = audioRef.current;
      if (isPlayingRef.current) {
        audio.pause();
      }

      audio.currentTime = AUDIO_START_TIME_SEC;
      isPlayingRef.current = true;
      audio.play().then(() => {
        isPlayingRef.current = false;
      }).catch((error) => {
        isPlayingRef.current = false;
        console.warn("Unable to play notification sound", error);
      });
    };

    const maybeNotify = async (
      title: string,
      body?: string,
      importance?: "High" | "Default",
      url?: string,
      icon?: string,
    ) => {
      playNotificationSound();

      const hasPermission = await ensureNotificationPermission();
      if (!hasPermission) {
        return;
      }

      await showDesktopNotification({ title, body, importance, url, icon });
    };

    if (newNotifications.length > 0) {
      const isUrgent = newNotifications.some(isUrgentNotification);
      const firstItem = newNotifications[0];
      const title = getNotificationTitle(newNotifications.length, firstItem);
      const body =
        newNotifications.length === 1
          ? getNotificationBody(firstItem)
          : "Open Gitlabify to view details.";

      let url: string | undefined;
      let icon: string | undefined;

      if (newNotifications.length === 1) {
        const item = newNotifications[0];
        url = item.mr?.webUrl || item.todo?.targetUrl || item.todo?.target?.webUrl;
        icon = item.todo?.author.avatarUrl || item.mr?.author.avatarUrl || undefined;
      }

      void maybeNotify(title, body, isUrgent ? "High" : "Default", url, icon);
    }

    if (finishedPipelines.length > 0) {
      const pipelineNotification = getPipelineNotificationConfig(finishedPipelines);
      const firstPipeline = finishedPipelines[0];
      const url = finishedPipelines.length === 1 ? firstPipeline.webUrl : undefined;

      void maybeNotify(
        pipelineNotification.title,
        pipelineNotification.body,
        pipelineNotification.importance,
        url,
      );
    }

    previousNotificationIdsRef.current = currentNotificationIds;
    previousPipelineStatusRef.current = currentPipelineStatusMap;
  }, [currentUsername, inboxData]);
};
