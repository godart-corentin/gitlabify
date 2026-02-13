import type { MouseEvent } from "react";
import { useRef } from "react";

import { type Pipeline, type SelectedItemId } from "../../../entities/inbox/model";
import { PipelineRow } from "../../../entities/inbox/ui";
import { useScrollToSelectedItem } from "../../../shared/hooks/useScrollToSelectedItem";

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
  useScrollToSelectedItem(listRef.current, selectedPipelineId);

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
