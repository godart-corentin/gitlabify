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

export type IconType = "merge-request" | "todo" | "pipeline" | "comment" | "mention";

interface StatusIconProps {
  type: IconType;
  status?: string;
  className?: string;
}

export function StatusIcon({ type, status, className }: StatusIconProps) {
  const normalizedStatus = status?.toLowerCase() || "";

  if (type === "merge-request") {
    if (normalizedStatus === "merged")
      return <GitPullRequest className={clsx("text-indigo-400", className)} />;
    if (normalizedStatus === "closed")
      return <GitPullRequest className={clsx("text-rose-400", className)} />;
    if (normalizedStatus === "draft")
      return <GitPullRequest className={clsx("text-zinc-500", className)} />;
    return <GitPullRequest className={clsx("text-emerald-500", className)} />;
  }

  if (type === "todo") {
    return <CheckSquare className={clsx("text-blue-400", className)} />;
  }

  if (type === "comment") {
    return <MessageCircle className={clsx("text-blue-400", className)} />;
  }

  if (type === "mention") {
    return <AtSign className={clsx("text-fuchsia-400", className)} />;
  }

  if (type === "pipeline") {
    switch (normalizedStatus) {
      case "success":
        return <CheckCircle2 className={clsx("text-emerald-500", className)} />;
      case "failed":
        return <XCircle className={clsx("text-rose-500", className)} />;
      case "running":
        return <PlayCircle className={clsx("text-blue-500 animate-pulse", className)} />;
      case "pending":
        return <Clock className={clsx("text-zinc-500", className)} />;
      case "canceled":
        return <CircleDashed className={clsx("text-zinc-500", className)} />;
      default:
        return <CircleDashed className={clsx("text-zinc-500", className)} />;
    }
  }

  return <AlertCircle className={clsx("text-zinc-500", className)} />;
}
