import { getGroupedItems, type GroupedItem, type InboxData } from "../../../entities/inbox/model";
export type { NotificationConfig } from "./notificationDelivery";

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

export const getNotificationTitle = (count: number, item?: GroupedItem) => {
  if (count === 1 && item) {
    if (item.todo) {
      const { author, actionName } = item.todo;
      const action = actionName.toLowerCase();

      if (action === "mentioned" || action === "directly_addressed") {
        return `Mention from ${author.name}`;
      }
      if (action === "commented") {
        return `Comment from ${author.name}`;
      }
      if (action === "assigned") {
        return `Assigned by ${author.name}`;
      }
      if (action === "approval_required") {
        return `Review requested by ${author.name}`;
      }
    }

    if (item.mr) {
      return `Review request from ${item.mr.author.name}`;
    }

    return "New notification";
  }

  return `${count} new notifications`;
};

export const getNotificationBody = (item: GroupedItem) => {
  const todoBody = item.todo?.body;
  const mrTitle = item.mr?.title;

  if (todoBody && mrTitle) {
    return `${mrTitle}: ${todoBody}`;
  }

  if (todoBody) {
    return todoBody;
  }

  if (mrTitle) {
    return mrTitle;
  }

  return "Open Gitlabify to view details.";
};

export const isUrgentNotification = (item: GroupedItem) => {
  if (item.todo) {
    const action = item.todo.actionName.toLowerCase();
    return ["mentioned", "directly_addressed", "assigned", "approval_required"].includes(action);
  }
  if (item.mr) {
    return true; // MR review requests are high priority
  }
  return false;
};
