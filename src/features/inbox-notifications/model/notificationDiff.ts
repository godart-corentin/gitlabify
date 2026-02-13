import { getGroupedItems, type GroupedItem, type InboxData } from "../../../entities/inbox/model";

export type NotificationConfig = {
  title: string;
  body?: string;
};

export const getNotificationItemIds = (
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

export const getNewNotifications = (items: GroupedItem[], previousIds: Set<string>) => {
  return items.filter((item) => !previousIds.has(item.id));
};

export const getNotificationTitle = (count: number) => {
  if (count === 1) {
    return "New notification";
  }

  return `${count} new notifications`;
};

export const getNotificationBody = (item: GroupedItem) => {
  if (item.todo?.body) {
    return item.todo.body;
  }

  if (item.mr?.title) {
    return item.mr.title;
  }

  return "Open Gitlabify to view details.";
};
