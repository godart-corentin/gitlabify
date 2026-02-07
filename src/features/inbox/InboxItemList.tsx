import type { IconType } from "../../components/ui/StatusIcon";

import { InboxItem } from "./InboxItem";
import type { InboxFilter } from "./types";
import {
  getNormalizedAction,
  isDraftTitle,
  TODO_ACTION,
  type GroupedItem,
} from "./inboxListUtils";

type InboxItemListProps = {
  items: GroupedItem[];
  filter: InboxFilter;
};

export const InboxItemList = ({ items, filter }: InboxItemListProps) => {
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

    return (
      <InboxItem
        key={item.id}
        icons={icons}
        title={title}
        author={author}
        updatedAt={updatedAt}
        webUrl={webUrl}
      />
    );
  });

  return <div className="flex flex-col w-full pb-4">{inboxItemNodes}</div>;
};
