import { clsx } from "clsx";
import {
  GitPullRequest,
  CheckSquare,
  MessageCircle,
  AtSign,
  PlayCircle,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  CircleDashed,
} from "lucide-react";

export type IconType = "merge-request" | "review" | "todo" | "pipeline" | "comment" | "mention";

type StatusIconProps = {
  type: IconType;
  status?: string;
  className?: string;
};

export function StatusIcon({ type, status, className }: StatusIconProps) {
  const normalizedStatus = status?.toLowerCase() || "";

  if (type === "merge-request") {
    if (normalizedStatus === "merged")
      return <GitPullRequest className={clsx("text-success", className)} />;
    if (normalizedStatus === "closed")
      return <GitPullRequest className={clsx("text-error", className)} />;
    if (normalizedStatus === "draft")
      return <GitPullRequest className={clsx("text-base-content/50", className)} />;
    return <GitPullRequest className={clsx("text-primary", className)} />;
  }

  if (type === "review" || type === "todo") {
    return <CheckSquare className={clsx("text-info", className)} />;
  }

  if (type === "comment") {
    return <MessageCircle className={clsx("text-info", className)} />;
  }

  if (type === "mention") {
    return <AtSign className={clsx("text-info", className)} />;
  }

  if (type === "pipeline") {
    switch (normalizedStatus) {
      case "success":
        return <CheckCircle2 className={clsx("text-success", className)} />;
      case "failed":
        return <XCircle className={clsx("text-error", className)} />;
      case "running":
        return <PlayCircle className={clsx("text-info animate-pulse", className)} />;
      case "pending":
        return <Clock className={clsx("text-base-content/50", className)} />;
      case "canceled":
        return <CircleDashed className={clsx("text-base-content/50", className)} />;
      default:
        return <CircleDashed className={clsx("text-base-content/50", className)} />;
    }
  }

  return <AlertCircle className={clsx("text-base-content/50", className)} />;
}
