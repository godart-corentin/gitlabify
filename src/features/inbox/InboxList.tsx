import { useMemo } from "react";

import type { InboxData } from "../../schemas";

import { InboxEmptyState } from "./InboxEmptyState";
import { InboxItemList } from "./InboxItemList";
import { InboxLoadingState } from "./InboxLoadingState";
import { PipelineList } from "./PipelineList";
import { getGroupedItems, getPipelineItems } from "./inboxListUtils";
import type { InboxFilter } from "./types";

type InboxListProps = {
  data?: InboxData | null;
  isLoading: boolean;
  filter?: InboxFilter;
  currentUsername?: string;
};

export function InboxList({
  data,
  isLoading,
  filter = "notifications",
  currentUsername,
}: InboxListProps) {
  const pipelineItems = useMemo(() => getPipelineItems(data), [data]);
  const items = useMemo(
    () => getGroupedItems(data, filter, currentUsername),
    [data, filter, currentUsername],
  );

  if (isLoading && !data) {
    return <InboxLoadingState />;
  }

  if (!data) {
    return null;
  }

  const isEmpty = filter === "pipelines" ? pipelineItems.length === 0 : items.length === 0;

  if (isEmpty) {
    return <InboxEmptyState />;
  }

  if (filter === "pipelines") {
    return <PipelineList pipelines={pipelineItems} />;
  }

  return <InboxItemList items={items} filter={filter} />;
}
