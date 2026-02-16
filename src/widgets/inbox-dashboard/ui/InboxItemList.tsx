import { useEffect, useRef, useState, type MouseEvent } from "react";

import {
  type GroupedItem,
  getNormalizedAction,
  TODO_ACTION,
  type InboxFilter,
  type SelectedItemId,
} from "../../../entities/inbox/model";
import { InboxItem } from "../../../entities/inbox/ui";
import { markTodoAsDone } from "../../../shared/api/tauri/inboxActions";
import { useScrollToSelectedItem } from "../../../shared/hooks/useScrollToSelectedItem";
import type { IconType } from "../../../shared/ui/status-icon/StatusIcon";

const MERGE_REQUEST_URL_PATTERN = /merge_requests\/(\d+)/;

type InboxItemListProps = {
  items: GroupedItem[];
  filter: InboxFilter;
  selectedItemId: SelectedItemId;
  hoveredItemId: SelectedItemId;
  hasHover: boolean;
  onListMouseMove: (event: MouseEvent<HTMLDivElement>) => void;
  onListMouseLeave: () => void;
};

export const InboxItemList = ({
  items,
  filter,
  selectedItemId,
  hoveredItemId,
  hasHover,
  onListMouseMove,
  onListMouseLeave,
}: InboxItemListProps) => {
  const listRef = useRef<HTMLDivElement | null>(null);
  const [dismissedItemIds, setDismissedItemIds] = useState<Set<string>>(() => new Set());
  const [markingItemIds, setMarkingItemIds] = useState<Set<string>>(() => new Set());
  useScrollToSelectedItem(listRef.current, selectedItemId);

  useEffect(() => {
    setDismissedItemIds((current) => {
      if (current.size === 0) {
        return current;
      }

      const itemIdsWithTodo = new Set(items.filter((item) => item.todo).map((item) => item.id));
      const next = new Set([...current].filter((itemId) => !itemIdsWithTodo.has(itemId)));

      return next.size === current.size ? current : next;
    });
  }, [items]);

  const handleMarkAsDone = async (itemId: string, todoId: number) => {
    setMarkingItemIds((current) => {
      if (current.has(itemId)) {
        return current;
      }

      return new Set([...current, itemId]);
    });

    try {
      await markTodoAsDone(todoId);
      setDismissedItemIds((current) => {
        if (current.has(itemId)) {
          return current;
        }

        return new Set([...current, itemId]);
      });
    } catch {
      // Keep item visible when marking as done fails.
    } finally {
      setMarkingItemIds((current) => {
        if (!current.has(itemId)) {
          return current;
        }

        return new Set([...current].filter((currentItemId) => currentItemId !== itemId));
      });
    }
  };

  const inboxItemNodes = items.map((item) => {
    if (dismissedItemIds.has(item.id)) {
      return null;
    }

    const { mr, todo } = item;
    const normalizedAction = getNormalizedAction(todo?.actionName);
    const isMention =
      normalizedAction === TODO_ACTION.MENTIONED ||
      normalizedAction === TODO_ACTION.DIRECTLY_ADDRESSED;
    const isComment = normalizedAction === TODO_ACTION.COMMENTED;
    const iconType: IconType =
      filter === "mrs" ? "merge-request" : isMention ? "mention" : isComment ? "comment" : "review";
    const iconStatus = filter === "mrs" ? "opened" : (todo?.state ?? mr?.state ?? "open");
    const icons: Array<{ key: string; type: IconType; status: string }> = [
      { key: `${iconType}-${item.id}`, type: iconType, status: iconStatus },
    ];

    const displayData = mr || todo?.target;

    if (!displayData && (!todo?.targetUrl || !todo?.author)) {
      return null;
    }

    const fallbackTitle = todo?.body?.trim();
    const mergeRequestId =
      displayData?.iid ??
      displayData?.id ??
      todo?.target?.iid ??
      todo?.target?.id ??
      (todo?.targetUrl ? MERGE_REQUEST_URL_PATTERN.exec(todo.targetUrl)?.[1] : null);
    const titleText =
      displayData?.title ||
      fallbackTitle ||
      (isMention ? "Mentioned in a merge request" : "New comment on a merge request") ||
      "Notification";
    const idLabel = mergeRequestId ? `#${mergeRequestId}` : null;
    const branchName = displayData?.sourceBranch ?? null;
    const subtitle =
      branchName ??
      (isMention
        ? "Mentioned in merge request"
        : isComment
          ? "Commented on merge request"
          : (todo?.targetType ?? null));

    const author = displayData?.author || todo!.author;
    const webUrl = displayData?.webUrl || todo!.targetUrl!;
    const updatedAt = displayData ? item.date.toISOString() : todo!.createdAt;
    const isSelected = !hasHover && selectedItemId === item.id;
    const isHovered = hoveredItemId === item.id;
    const todoId = todo?.id;
    const canMarkAsDone = filter === "notifications" && typeof todoId === "number";
    const isMarkingAsDone = markingItemIds.has(item.id);
    const handleTodoDone = () => {
      if (!canMarkAsDone || todoId === undefined || isMarkingAsDone) {
        return;
      }

      void handleMarkAsDone(item.id, todoId);
    };

    return (
      <InboxItem
        key={item.id}
        icons={icons}
        idLabel={idLabel}
        title={titleText}
        subtitle={subtitle}
        branchName={branchName}
        author={author}
        updatedAt={updatedAt}
        webUrl={webUrl}
        isSelected={isSelected}
        dataItemId={item.id}
        isHovered={isHovered}
        onMarkAsDone={canMarkAsDone ? handleTodoDone : undefined}
      />
    );
  });

  return (
    <div
      ref={listRef}
      className="flex flex-col w-full pb-4"
      onMouseMove={onListMouseMove}
      onMouseLeave={onListMouseLeave}
    >
      {inboxItemNodes}
    </div>
  );
};
