import type { MouseEvent } from "react";
import { useEffect, useRef } from "react";

import type { IconType } from "../../components/ui/StatusIcon";

import { InboxItem } from "./InboxItem";
import { NO_SELECTION_ID, type InboxFilter, type SelectedItemId } from "./types";
import {
  getNormalizedAction,
  isDraftTitle,
  TODO_ACTION,
  type GroupedItem,
} from "./inboxListUtils";

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

  useEffect(() => {
    if (selectedItemId === NO_SELECTION_ID) {
      return;
    }
    const container = listRef.current;
    if (!container) {
      return;
    }
    const selectedNode = container.querySelector<HTMLElement>(
      `[data-item-id="${selectedItemId}"]`,
    );
    if (!selectedNode) {
      return;
    }
    selectedNode.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [selectedItemId]);

  const inboxItemNodes = items.map((item) => {
    const { mr, todo } = item;
    const icons: Array<{ key: string; type: IconType; status: string }> = [];

    if (mr) {
      const isDraft = mr.draft || mr.workInProgress || isDraftTitle(mr.title);
      const status = isDraft ? "draft" : mr.state;
      icons.push({ key: `mr-${mr.id}-${status}`, type: "merge-request", status });
    }

    if (todo && filter !== "mrs") {
      const normalizedAction = getNormalizedAction(todo.actionName);
      const isMention =
        normalizedAction === TODO_ACTION.MENTIONED ||
        normalizedAction === TODO_ACTION.DIRECTLY_ADDRESSED;
      const isComment = normalizedAction === TODO_ACTION.COMMENTED;

      if (isMention) {
        icons.push({ key: `todo-${todo.id}-mention`, type: "mention", status: todo.state });
      } else if (isComment) {
        icons.push({ key: `todo-${todo.id}-comment`, type: "comment", status: todo.state });
      } else {
        icons.push({ key: `todo-${todo.id}-todo`, type: "todo", status: todo.state });
      }
    }

    if (mr?.headPipeline) {
      icons.push({
        key: `pipeline-${mr.headPipeline.id}-${mr.headPipeline.status}`,
        type: "pipeline",
        status: mr.headPipeline.status,
      });
    }

    const displayData = mr || todo?.target;

    if (!displayData && (!todo?.targetUrl || !todo?.author)) {
      return null;
    }

    const fallbackTitle = todo?.body?.trim();
    const normalizedAction = getNormalizedAction(todo?.actionName);
    const isMention =
      normalizedAction === TODO_ACTION.MENTIONED ||
      normalizedAction === TODO_ACTION.DIRECTLY_ADDRESSED;
    const title =
      displayData?.title ||
      fallbackTitle ||
      (isMention ? "Mentioned in a merge request" : "New comment on a merge request");

    const author = displayData?.author || todo!.author;
    const webUrl = displayData?.webUrl || todo!.targetUrl!;
    const updatedAt = displayData ? item.date.toISOString() : todo!.createdAt;
    const isSelected = !hasHover && selectedItemId === item.id;
    const isHovered = hoveredItemId === item.id;

    return (
      <InboxItem
        key={item.id}
        icons={icons}
        title={title}
        author={author}
        updatedAt={updatedAt}
        webUrl={webUrl}
        isSelected={isSelected}
        dataItemId={item.id}
        isHovered={isHovered}
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
