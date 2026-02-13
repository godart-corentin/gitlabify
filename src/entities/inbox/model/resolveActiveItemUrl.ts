import type { GroupedItem } from "./inboxListUtils";
import type { Pipeline } from "./schemas";
import { NO_SELECTION_ID, type InboxFilter, type SelectedItemId } from "./types";

export const getActiveItemUrl = ({
  filter,
  activeItemId,
  items,
  pipelineItems,
}: {
  filter: InboxFilter;
  activeItemId: SelectedItemId;
  items: GroupedItem[];
  pipelineItems: Pipeline[];
}) => {
  if (activeItemId === NO_SELECTION_ID) {
    return null;
  }

  if (filter === "pipelines") {
    const selectedPipeline = pipelineItems.find((pipeline) => String(pipeline.id) === activeItemId);
    return selectedPipeline?.webUrl ?? null;
  }

  const selectedItem = items.find((item) => item.id === activeItemId);
  if (!selectedItem) {
    return null;
  }

  const displayData = selectedItem.mr || selectedItem.todo?.target;
  return displayData?.webUrl ?? selectedItem.todo?.targetUrl ?? null;
};
