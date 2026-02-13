import { useEffect, useRef } from "react";

import { getGroupedItems, type InboxData } from "../../../entities/inbox/model";

import { ensureNotificationPermission, showDesktopNotification } from "./notificationDelivery";
import {
  getNewNotifications,
  getNotificationBody,
  getNotificationItemIds,
  getNotificationTitle,
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
      audio.currentTime = AUDIO_START_TIME_SEC;
      audio.play().catch((error) => {
        console.warn("Unable to play notification sound", error);
      });
    };

    const maybeNotify = async (title: string, body?: string) => {
      playNotificationSound();

      const hasPermission = await ensureNotificationPermission();
      if (!hasPermission) {
        return;
      }

      await showDesktopNotification({ title, body });
    };

    if (newNotifications.length > 0) {
      const title = getNotificationTitle(newNotifications.length);
      const body =
        newNotifications.length === 1 ? getNotificationBody(newNotifications[0]) : undefined;
      void maybeNotify(title, body);
    }

    if (finishedPipelines.length > 0) {
      const pipelineNotification = getPipelineNotificationConfig(finishedPipelines);
      void maybeNotify(pipelineNotification.title, pipelineNotification.body);
    }

    previousNotificationIdsRef.current = currentNotificationIds;
    previousPipelineStatusRef.current = currentPipelineStatusMap;
  }, [currentUsername, inboxData]);
};
