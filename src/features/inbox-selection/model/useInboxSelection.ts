import { openUrl } from "@tauri-apps/plugin-opener";
import type { MouseEvent } from "react";
import { useEffect, useRef, useState } from "react";

import {
  NO_SELECTION_ID,
  type InboxFilter,
  type SelectedItemId,
} from "../../../entities/inbox/model";

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

type ActiveItemUrlResolver = (activeItemId: SelectedItemId) => string | null;

type FilterSelectionContext = {
  itemIds: string[];
  resolveActiveItemUrl: ActiveItemUrlResolver;
};

type SelectionContextByFilter = Partial<Record<InboxFilter, FilterSelectionContext>>;

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

export const getNextSelectionId = ({
  key,
  activeItemId,
  currentItemIds,
}: {
  key: string;
  activeItemId: SelectedItemId;
  currentItemIds: string[];
}) => {
  if (currentItemIds.length === 0) {
    return activeItemId;
  }

  const currentIndex =
    activeItemId === NO_SELECTION_ID ? NO_SELECTION_ID : currentItemIds.indexOf(activeItemId);
  const lastIndex = currentItemIds.length - SELECTION_STEP;

  if (key === ARROW_DOWN_KEY) {
    if (activeItemId === NO_SELECTION_ID || currentIndex === NO_SELECTION_ID) {
      return currentItemIds[FIRST_INDEX] ?? NO_SELECTION_ID;
    }

    if (currentIndex >= lastIndex) {
      return activeItemId;
    }

    return currentItemIds[currentIndex + SELECTION_STEP] ?? activeItemId;
  }

  if (key === ARROW_UP_KEY) {
    if (activeItemId === NO_SELECTION_ID || currentIndex <= FIRST_INDEX) {
      return activeItemId;
    }

    return currentItemIds[currentIndex - SELECTION_STEP] ?? activeItemId;
  }

  return activeItemId;
};

export const useInboxSelection = ({
  filter,
  currentItemIds,
}: {
  filter: InboxFilter;
  currentItemIds: string[];
}) => {
  const [selectedItemIdByFilter, setSelectedItemIdByFilter] = useState(
    () => DEFAULT_SELECTION_BY_FILTER,
  );
  const [hoveredItemIdByFilter, setHoveredItemIdByFilter] = useState(
    () => DEFAULT_SELECTION_BY_FILTER,
  );
  const [isHoverSuppressedByFilter, setIsHoverSuppressedByFilter] = useState(
    () => DEFAULT_HOVER_SUPPRESSED_BY_FILTER,
  );
  const selectionContextByFilterRef = useRef<SelectionContextByFilter>({});

  const selectedItemId = selectedItemIdByFilter[filter];
  const hoveredItemId = hoveredItemIdByFilter[filter];
  const hasHover = hoveredItemId !== NO_SELECTION_ID;
  const isHoverSuppressed = isHoverSuppressedByFilter[filter];
  const activeItemId = hasHover ? hoveredItemId : selectedItemId;

  const setFilterSelectionContext = (
    contextFilter: InboxFilter,
    itemIds: string[],
    resolveActiveItemUrl: ActiveItemUrlResolver,
  ) => {
    selectionContextByFilterRef.current[contextFilter] = {
      itemIds,
      resolveActiveItemUrl,
    };
  };

  useEffect(() => {
    if (selectedItemId === NO_SELECTION_ID || currentItemIds.includes(selectedItemId)) {
      return;
    }

    setSelectedItemIdByFilter((previousState) => {
      if (previousState[filter] === NO_SELECTION_ID) {
        return previousState;
      }

      return { ...previousState, [filter]: NO_SELECTION_ID };
    });
  }, [currentItemIds, filter, selectedItemId]);

  useEffect(() => {
    if (hoveredItemId === NO_SELECTION_ID || currentItemIds.includes(hoveredItemId)) {
      return;
    }

    setHoveredItemIdByFilter((previousState) => {
      if (previousState[filter] === NO_SELECTION_ID) {
        return previousState;
      }

      return { ...previousState, [filter]: NO_SELECTION_ID };
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

      const selectionContext = selectionContextByFilterRef.current[filter];
      const itemIds = selectionContext?.itemIds ?? currentItemIds;

      if (event.key === ENTER_KEY) {
        const activeItemUrl = selectionContext?.resolveActiveItemUrl(activeItemId) ?? null;
        if (!activeItemUrl) {
          return;
        }

        event.preventDefault();
        void openUrl(activeItemUrl);
        return;
      }

      if (itemIds.length === 0) {
        return;
      }

      event.preventDefault();

      if (hoveredItemId !== NO_SELECTION_ID) {
        setHoveredItemIdByFilter((previousState) => ({
          ...previousState,
          [filter]: NO_SELECTION_ID,
        }));
      }

      if (!isHoverSuppressed) {
        setIsHoverSuppressedByFilter((previousState) => ({
          ...previousState,
          [filter]: true,
        }));
      }

      const nextSelectionId = getNextSelectionId({
        key: event.key,
        activeItemId,
        currentItemIds: itemIds,
      });

      if (nextSelectionId === activeItemId) {
        return;
      }

      setSelectedItemIdByFilter((previousState) => ({
        ...previousState,
        [filter]: nextSelectionId,
      }));
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeItemId, currentItemIds, filter, hoveredItemId, isHoverSuppressed]);

  const onListMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    if (isHoverSuppressed) {
      setIsHoverSuppressedByFilter((previousState) => ({
        ...previousState,
        [filter]: false,
      }));
    }

    const itemId = getItemIdFromTarget(event.target);
    if (!itemId) {
      if (hoveredItemId !== NO_SELECTION_ID) {
        setHoveredItemIdByFilter((previousState) => ({
          ...previousState,
          [filter]: NO_SELECTION_ID,
        }));
      }
      return;
    }

    if (hoveredItemId !== itemId) {
      setHoveredItemIdByFilter((previousState) => ({
        ...previousState,
        [filter]: itemId,
      }));
    }
  };

  const onListMouseLeave = () => {
    if (hoveredItemId !== NO_SELECTION_ID) {
      setHoveredItemIdByFilter((previousState) => ({
        ...previousState,
        [filter]: NO_SELECTION_ID,
      }));
    }
  };

  return {
    selectedItemId,
    hoveredItemId,
    activeItemId,
    hasHover,
    onListMouseMove,
    onListMouseLeave,
    setFilterSelectionContext,
  };
};
