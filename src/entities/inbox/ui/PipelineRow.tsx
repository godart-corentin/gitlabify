import { openUrl } from "@tauri-apps/plugin-opener";
import { clsx } from "clsx";

import { formatShortRelativeTime } from "../../../shared/lib/date/formatShortRelativeTime";
import { StatusIcon } from "../../../shared/ui/status-icon/StatusIcon";
import type { Pipeline } from "../model/schemas";

const MERGE_REQUEST_REF_PATTERN = /^refs\/merge-requests\/(\d+)\/head$/;
const MERGE_REQUEST_LABEL_PREFIX = "Merge Request #";

type PipelineRowProps = {
  pipeline: Pipeline;
  isSelected?: boolean;
  dataItemId?: string;
  isHovered?: boolean;
};

export function PipelineRow({
  pipeline,
  isSelected = false,
  dataItemId,
  isHovered = false,
}: PipelineRowProps) {
  const pipelineId = pipeline.iid ?? pipeline.id;
  const idLabel = `#${pipelineId}`;
  const mergeRequestMatch = MERGE_REQUEST_REF_PATTERN.exec(pipeline.ref);
  const subtitle = mergeRequestMatch
    ? `${MERGE_REQUEST_LABEL_PREFIX}${mergeRequestMatch[1]}`
    : pipeline.ref;
  const timeAgo = formatShortRelativeTime(pipeline.updatedAt);

  const handleClick = async () => {
    await openUrl(pipeline.webUrl);
  };

  return (
    <div
      onClick={handleClick}
      aria-selected={isSelected}
      data-item-id={dataItemId}
      className={clsx(
        "w-full flex items-center gap-4 px-4 py-3 border-b border-base-300 hover:bg-base-200/50 transition-colors cursor-pointer border-l-2 border-transparent",
        isSelected && "bg-primary/10 border-l-primary",
        isHovered && "bg-base-200/60",
      )}
    >
      <div className="flex items-center shrink-0">
        <StatusIcon type="pipeline" status={pipeline.status} className="h-5 w-5" />
      </div>

      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="font-mono text-xs text-base-content/50 shrink-0">{idLabel}</span>
          <span className="text-sm font-medium text-base-content truncate">Pipeline</span>
        </div>
        <span className="text-xs font-mono text-base-content/50 truncate">{subtitle}</span>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <span className="text-xs font-mono text-base-content/40 whitespace-nowrap">{timeAgo}</span>
      </div>
    </div>
  );
}
