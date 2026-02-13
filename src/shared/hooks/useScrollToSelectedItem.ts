import { useEffect } from "react";

export const useScrollToSelectedItem = (
  container: HTMLDivElement | null,
  selectedItemId: string | number,
) => {
  useEffect(() => {
    if (selectedItemId === -1) {
      return;
    }
    if (!container) {
      return;
    }

    const selectedNode = container.querySelector<HTMLElement>(
      `[data-item-id="${String(selectedItemId)}"]`,
    );

    if (!selectedNode) {
      return;
    }

    selectedNode.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [container, selectedItemId]);
};
