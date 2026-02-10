import { openUrl } from "@tauri-apps/plugin-opener";
import type { MouseEvent } from "react";
import { useEffect, useMemo, useState } from "react";

import type { InboxData } from "../../schemas";

import { InboxEmptyState } from "./InboxEmptyState";
import { InboxItemList } from "./InboxItemList";
import { getGroupedItems, getPipelineItems } from "./inboxListUtils";
import { InboxLoadingState } from "./InboxLoadingState";
import { PipelineList } from "./PipelineList";
import { NO_SELECTION_ID, type InboxFilter, type SelectedItemId } from "./types";
const FIRST_INDEX = 0;
const SELECTION_STEP = 1;
const ARROW_DOWN_KEY = "ArrowDown";
const ARROW_UP_KEY = "ArrowUp";
const ENTER_KEY = "Enter";
const DEFAULT_SELECTION_BY_FILTER: Record<InboxFilter, SelectedItemId> = {
  notifications: NO_SELECTION_ID,
  mrs: NO_SELECTION_ID,
  pipelines: NO_SELECTION_ID,
};

const DEFAULT_HOVER_SUPPRESSED_BY_FILTER: Record<InboxFilter, boolean> = {
  notifications: false,
  mrs: false,
  pipelines: false,
};
const isEditableTarget = (target: EventTarget | null) => {
  if (!target || !(target instanceof HTMLElement)) {
    return false;
  }
  if (target.isContentEditable) {
    return true;
  }
  const tagName = target.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select";
};

const getItemIdFromTarget = (target: EventTarget | null) => {
  if (!target || !(target instanceof HTMLElement)) {
    return null;
  }
  const itemElement = target.closest<HTMLElement>("[data-item-id]");
  return itemElement?.dataset.itemId ?? null;
};
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
  const [selectedItemIdByFilter, setSelectedItemIdByFilter] = useState(
    () => DEFAULT_SELECTION_BY_FILTER,
  );
  const [hoveredItemIdByFilter, setHoveredItemIdByFilter] = useState(
    () => DEFAULT_SELECTION_BY_FILTER,
  );
  const [isHoverSuppressedByFilter, setIsHoverSuppressedByFilter] = useState(
    () => DEFAULT_HOVER_SUPPRESSED_BY_FILTER,
  );
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
  const selectedItemId = selectedItemIdByFilter[filter];
  const hoveredItemId = hoveredItemIdByFilter[filter];
  const hasHover = hoveredItemId !== NO_SELECTION_ID;
  const isHoverSuppressed = isHoverSuppressedByFilter[filter];
  const activeItemId = hasHover ? hoveredItemId : selectedItemId;
  const activeItemUrl = useMemo(() => {
    if (activeItemId === NO_SELECTION_ID) {
      return null;
    }
    if (filter === "pipelines") {
      const selectedPipeline = pipelineItems.find(
        (pipeline) => String(pipeline.id) === activeItemId,
      );
      return selectedPipeline?.webUrl ?? null;
    }
    const selectedItem = items.find((item) => item.id === activeItemId);
    if (!selectedItem) {
      return null;
    }
    const displayData = selectedItem.mr || selectedItem.todo?.target;
    return displayData?.webUrl ?? selectedItem.todo?.targetUrl ?? null;
  }, [activeItemId, filter, items, pipelineItems]);

  useEffect(() => {
    if (selectedItemId === NO_SELECTION_ID) {
      return;
    }
    const hasSelection = currentItemIds.includes(selectedItemId);
    if (hasSelection) {
      return;
    }
    setSelectedItemIdByFilter((prev) => {
      if (prev[filter] === NO_SELECTION_ID) {
        return prev;
      }
      return { ...prev, [filter]: NO_SELECTION_ID };
    });
  }, [currentItemIds, filter, selectedItemId]);

  useEffect(() => {
    if (hoveredItemId === NO_SELECTION_ID) {
      return;
    }
    const hasHoverItem = currentItemIds.includes(hoveredItemId);
    if (hasHoverItem) {
      return;
    }
    setHoveredItemIdByFilter((prev) => {
      if (prev[filter] === NO_SELECTION_ID) {
        return prev;
      }
      return { ...prev, [filter]: NO_SELECTION_ID };
    });
  }, [currentItemIds, filter, hoveredItemId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== ARROW_DOWN_KEY && event.key !== ARROW_UP_KEY && event.key !== ENTER_KEY) {
        return;
      }
      if (isEditableTarget(event.target)) {
        return;
      }
      if (event.key === ENTER_KEY) {
        if (!activeItemUrl) {
          return;
        }
        event.preventDefault();
        void openUrl(activeItemUrl);
        return;
      }
      if (currentItemIds.length === 0) {
        return;
      }
      event.preventDefault();
      if (hoveredItemId !== NO_SELECTION_ID) {
        setHoveredItemIdByFilter((prev) => ({ ...prev, [filter]: NO_SELECTION_ID }));
      }
      if (!isHoverSuppressed) {
        setIsHoverSuppressedByFilter((prev) => ({ ...prev, [filter]: true }));
      }

      const currentIndex =
        activeItemId === NO_SELECTION_ID ? NO_SELECTION_ID : currentItemIds.indexOf(activeItemId);
      const lastIndex = currentItemIds.length - SELECTION_STEP;

      if (event.key === ARROW_DOWN_KEY) {
        if (activeItemId === NO_SELECTION_ID || currentIndex === NO_SELECTION_ID) {
          setSelectedItemIdByFilter((prev) => ({
            ...prev,
            [filter]: currentItemIds[FIRST_INDEX] ?? NO_SELECTION_ID,
          }));
          return;
        }
        if (currentIndex >= lastIndex) {
          return;
        }
        const nextIndex = currentIndex + SELECTION_STEP;
        setSelectedItemIdByFilter((prev) => ({
          ...prev,
          [filter]: currentItemIds[nextIndex] ?? prev[filter],
        }));
        return;
      }

      if (activeItemId === NO_SELECTION_ID || currentIndex <= FIRST_INDEX) {
        return;
      }

      const prevIndex = currentIndex - SELECTION_STEP;
      setSelectedItemIdByFilter((prev) => ({
        ...prev,
        [filter]: currentItemIds[prevIndex] ?? prev[filter],
      }));
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeItemId, activeItemUrl, currentItemIds, filter, hoveredItemId, isHoverSuppressed]);

  const handleListMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    if (isHoverSuppressed) {
      setIsHoverSuppressedByFilter((prev) => ({ ...prev, [filter]: false }));
    }
    const itemId = getItemIdFromTarget(event.target);
    if (!itemId) {
      if (hoveredItemId !== NO_SELECTION_ID) {
        setHoveredItemIdByFilter((prev) => ({ ...prev, [filter]: NO_SELECTION_ID }));
      }
      return;
    }
    if (hoveredItemId !== itemId) {
      setHoveredItemIdByFilter((prev) => ({ ...prev, [filter]: itemId }));
    }
  };

  const handleListMouseLeave = () => {
    if (hoveredItemId !== NO_SELECTION_ID) {
      setHoveredItemIdByFilter((prev) => ({ ...prev, [filter]: NO_SELECTION_ID }));
    }
  };

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
        onListMouseMove={handleListMouseMove}
        onListMouseLeave={handleListMouseLeave}
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
      onListMouseMove={handleListMouseMove}
      onListMouseLeave={handleListMouseLeave}
    />
  );
}
