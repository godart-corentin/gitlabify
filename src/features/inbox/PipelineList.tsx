import type { MouseEvent } from "react";
import { useEffect, useRef } from "react";

import type { Pipeline } from "../../schemas";

import { PipelineRow } from "./PipelineRow";
import { NO_SELECTION_ID, type SelectedItemId } from "./types";

type PipelineListProps = {
  pipelines: Pipeline[];
  selectedPipelineId: SelectedItemId;
  hoveredPipelineId: SelectedItemId;
  hasHover: boolean;
  onListMouseMove: (event: MouseEvent<HTMLDivElement>) => void;
  onListMouseLeave: () => void;
};

const getPipelineSelectionId = (pipeline: Pipeline) => String(pipeline.id);

export const PipelineList = ({
  pipelines,
  selectedPipelineId,
  hoveredPipelineId,
  hasHover,
  onListMouseMove,
  onListMouseLeave,
}: PipelineListProps) => {
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (selectedPipelineId === NO_SELECTION_ID) {
      return;
    }
    const container = listRef.current;
    if (!container) {
      return;
    }
    const selectedNode = container.querySelector<HTMLElement>(
      `[data-item-id="${selectedPipelineId}"]`,
    );
    if (!selectedNode) {
      return;
    }
    selectedNode.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [selectedPipelineId]);

  const pipelineRows = pipelines.map((pipeline) => {
    const pipelineSelectionId = getPipelineSelectionId(pipeline);
    const isSelected = !hasHover && selectedPipelineId === pipelineSelectionId;
    const isHovered = hoveredPipelineId === pipelineSelectionId;

    return (
      <PipelineRow
        key={pipeline.id}
        pipeline={pipeline}
        isSelected={isSelected}
        dataItemId={pipelineSelectionId}
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
      {pipelineRows}
    </div>
  );
};
