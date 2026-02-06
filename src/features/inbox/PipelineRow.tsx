import { openUrl } from "@tauri-apps/plugin-opener";
import { clsx } from "clsx";
import type { CSSProperties } from "react";

import { StatusIcon } from "../../components/ui/StatusIcon";
import type { Pipeline } from "../../schemas";

const PIPELINE_ROW_HEIGHT_PX = 48;
const PIPELINE_ROW_PADDING_X_PX = 16;
const PIPELINE_ROW_GAP_PX = 12;
const PIPELINE_ICON_SIZE_PX = 20;
const PIPELINE_ID_PREFIX = "Pipeline #";
const MERGE_REQUEST_REF_PATTERN = /^refs\/merge-requests\/(\d+)\/head$/;
const MERGE_REQUEST_LABEL_PREFIX = "Merge Request #";

const PIPELINE_ROW_STYLE = {
  "--pipeline-row-height": `${PIPELINE_ROW_HEIGHT_PX}px`,
  "--pipeline-row-padding-x": `${PIPELINE_ROW_PADDING_X_PX}px`,
  "--pipeline-row-gap": `${PIPELINE_ROW_GAP_PX}px`,
  "--pipeline-icon-size": `${PIPELINE_ICON_SIZE_PX}px`,
} as CSSProperties;

type PipelineRowProps = {
  pipeline: Pipeline;
};

export function PipelineRow({ pipeline }: PipelineRowProps) {
  const pipelineId = pipeline.iid ?? pipeline.id;
  const pipelineIdLabel = `${PIPELINE_ID_PREFIX}${pipelineId}`;
  const mergeRequestMatch = MERGE_REQUEST_REF_PATTERN.exec(pipeline.ref);
  const title = mergeRequestMatch
    ? `${MERGE_REQUEST_LABEL_PREFIX}${mergeRequestMatch[1]}`
    : pipeline.ref;

  const handleClick = async () => {
    await openUrl(pipeline.webUrl);
  };

  return (
    <div
      onClick={handleClick}
      style={PIPELINE_ROW_STYLE}
      className={clsx(
        "group flex items-center h-[var(--pipeline-row-height)] px-[var(--pipeline-row-padding-x)] gap-[var(--pipeline-row-gap)]",
        "bg-zinc-900 hover:bg-zinc-800 cursor-pointer border-b border-zinc-800/50 transition-colors",
      )}
    >
      <div className="flex items-center shrink-0">
        <StatusIcon
          type="pipeline"
          status={pipeline.status}
          className="w-[var(--pipeline-icon-size)] h-[var(--pipeline-icon-size)]"
        />
      </div>

      <div className="flex-1 min-w-0 flex flex-col justify-center h-full">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-medium text-zinc-200 truncate group-hover:text-white transition-colors">
            {title}
          </span>
          <span className="text-xs text-zinc-500 shrink-0 whitespace-nowrap">
            {pipelineIdLabel}
          </span>
        </div>
      </div>
    </div>
  );
}
