import type { MouseEvent } from "react";
import { useEffect, useRef } from "react";

import type { IconType } from "../../components/ui/StatusIcon";

import { InboxItem } from "./InboxItem";
import { getNormalizedAction, TODO_ACTION, type GroupedItem } from "./inboxListUtils";
import { NO_SELECTION_ID, type InboxFilter, type SelectedItemId } from "./types";

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

  useEffect(() => {
    if (selectedItemId === NO_SELECTION_ID) {
      return;
    }
    const container = listRef.current;
    if (!container) {
      return;
    }
    const selectedNode = container.querySelector<HTMLElement>(`[data-item-id="${selectedItemId}"]`);
    if (!selectedNode) {
      return;
    }
    selectedNode.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [selectedItemId]);

  const inboxItemNodes = items.map((item) => {
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
    const subtitle =
      displayData?.sourceBranch ||
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

    return (
      <InboxItem
        key={item.id}
        icons={icons}
        idLabel={idLabel}
        title={titleText}
        subtitle={subtitle}
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
