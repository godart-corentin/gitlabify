import { useEffect, useMemo } from "react";

import {
  getActiveItemUrl,
  getGroupedItems,
  getPipelineItems,
  type InboxData,
  type InboxFilter,
  type SelectedItemId,
} from "../../../entities/inbox/model";
import { useInboxSelection } from "../../../features/inbox-selection/model";

import { InboxEmptyState } from "./InboxEmptyState";
import { InboxItemList } from "./InboxItemList";
import { InboxLoadingState } from "./InboxLoadingState";
import { PipelineList } from "./PipelineList";

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

  const currentItemIds = useMemo(() => {
    if (filter === "pipelines") {
      return pipelineItems.map((pipeline) => String(pipeline.id));
    }

    return items.map((item) => item.id);
  }, [filter, items, pipelineItems]);

  const {
    selectedItemId,
    hoveredItemId,
    hasHover,
    onListMouseMove,
    onListMouseLeave,
    setFilterSelectionContext,
  } = useInboxSelection({
    filter,
    currentItemIds,
  });

  useEffect(() => {
    const resolveActiveItemUrl = (activeItemId: SelectedItemId) =>
      getActiveItemUrl({
        filter,
        activeItemId,
        items,
        pipelineItems,
      });

    setFilterSelectionContext(filter, currentItemIds, resolveActiveItemUrl);
  }, [currentItemIds, filter, items, pipelineItems, setFilterSelectionContext]);

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
    return (
      <PipelineList
        pipelines={pipelineItems}
        selectedPipelineId={selectedItemId}
        hoveredPipelineId={hoveredItemId}
        hasHover={hasHover}
        onListMouseMove={onListMouseMove}
        onListMouseLeave={onListMouseLeave}
      />
    );
  }

  return (
    <InboxItemList
      items={items}
      filter={filter}
      selectedItemId={selectedItemId}
      hoveredItemId={hoveredItemId}
      hasHover={hasHover}
      onListMouseMove={onListMouseMove}
      onListMouseLeave={onListMouseLeave}
    />
  );
}
