import { CheckCircle2 } from "lucide-react";
import { useMemo } from "react";

import type { IconType } from "../../components/ui/StatusIcon";
import type { InboxData, MergeRequest, Todo, Pipeline } from "../../schemas";

import { InboxItem } from "./InboxItem";
import { PipelineRow } from "./PipelineRow";

interface InboxListProps {
  data?: InboxData | null;
  isLoading: boolean;
  filter?: "notifications" | "mrs" | "pipelines";
  currentUsername?: string;
}

export function InboxList({
  data,
  isLoading,
  filter = "notifications",
  currentUsername,
}: InboxListProps) {
  const TODO_ACTION_COMMENTED = "commented";
  const TODO_ACTION_MENTIONED = "mentioned";
  const TODO_ACTION_DIRECTLY_ADDRESSED = "directly_addressed";

  const pipelineItems = useMemo(() => {
    if (!data) return [];
    return [...data.pipelines].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }, [data]);

  const items = useMemo(() => {
    if (!data) return [];

    const { mergeRequests, todos } = data;

    type GroupedItem = {
      id: string; // MR ID or unique ID
      date: Date;
      mr?: MergeRequest;
      todo?: Todo;
      pipeline?: Pipeline;
    };

    const grouped = new Map<number, GroupedItem>();

    // Helper to get or create group
    const getGroup = (id: number) => {
      if (!grouped.has(id)) {
        grouped.set(id, { id: `mr-${id}`, date: new Date(0) });
      }
      return grouped.get(id)!;
    };

    // 1. Process MRs
    mergeRequests.forEach((mr) => {
      const group = getGroup(mr.id);
      group.mr = mr;
      if (new Date(mr.updatedAt) > group.date) {
        group.date = new Date(mr.updatedAt);
      }
    });

    // 2. Process Todos
    todos.forEach((todo) => {
      if (todo.target) {
        // If todo targets an MR, group it
        const group = getGroup(todo.target.id);
        group.todo = todo;
        // Use todo target as MR data fallback if missing
        if (!group.mr) {
          group.mr = todo.target;
        }
        if (new Date(todo.createdAt) > group.date) {
          group.date = new Date(todo.createdAt);
        }
        return;
      }

      // Todo without target: keep as its own item (fallback)
      grouped.set(todo.id, {
        id: `todo-${todo.id}`,
        date: new Date(todo.createdAt),
        todo,
      });
    });

    const result: GroupedItem[] = Array.from(grouped.values());

    // Filter
    const filteredResult = result.filter((item) => {
      const { mr, todo } = item;

      const isAuthor = currentUsername && mr?.author.username === currentUsername;
      const isTodoAuthor = currentUsername && todo?.author.username === currentUsername;
      const targetMrAuthor = todo?.target?.author.username;
      const isTargetMrMine = currentUsername && targetMrAuthor === currentUsername;
      const isTargetMrNotMine =
        currentUsername && targetMrAuthor && targetMrAuthor !== currentUsername;
      const isDraft =
        mr?.draft ||
        mr?.workInProgress ||
        mr?.title.startsWith("Draft:") ||
        mr?.title.startsWith("WIP:");
      const normalizedAction = todo?.actionName?.toLowerCase();
      const isCommentTodo = normalizedAction === TODO_ACTION_COMMENTED;
      const isMentionTodo =
        normalizedAction === TODO_ACTION_MENTIONED ||
        normalizedAction === TODO_ACTION_DIRECTLY_ADDRESSED;

      // Filter by Tab
      if (filter === "notifications") {
        const needsReview = !!mr && mr.isReviewer && !mr.approvedByMe && !isAuthor && !isDraft;
        const commentsOnMyMr = !!todo && isCommentTodo && isTargetMrMine && !isTodoAuthor;
        const repliesToMyComments =
          !!todo && isCommentTodo && isTargetMrNotMine && !isTodoAuthor;
        const mentions = !!todo && isMentionTodo && !isTodoAuthor;
        const hasCommentOrMention = commentsOnMyMr || repliesToMyComments || mentions;

        if (hasCommentOrMention) {
          return true;
        }

        if (todo && !todo.target && !isTodoAuthor && (isCommentTodo || isMentionTodo)) {
          return true;
        }

        return needsReview;
      }

      if (filter === "mrs") {
        // My MRs: I am the author
        return !!mr && isAuthor;
      }

      return true;
    });

    filteredResult.sort((a, b) => b.date.getTime() - a.date.getTime());
    return filteredResult;
  }, [data, filter, currentUsername]);

  if (isLoading && !data) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-500 p-8">
        <span className="loading loading-spinner loading-md text-orange-500 mb-2"></span>
        <p>Loading inbox...</p>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const isEmpty =
    filter === "pipelines" ? pipelineItems.length === 0 : items.length === 0;

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-500 p-8">
        <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-4 opacity-50" />
        <p className="text-lg font-medium text-zinc-300">Inbox Zero</p>
        <p className="text-sm">You're all caught up!</p>
      </div>
    );
  }

  if (filter === "pipelines") {
    return (
      <div className="flex flex-col w-full pb-4">
        {pipelineItems.map((pipeline) => (
          <PipelineRow key={pipeline.id} pipeline={pipeline} />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full pb-4">
      {items.map((item) => {
        const { mr, todo } = item;
        // Construct icons list
        const icons: Array<{ type: IconType; status: string }> = [];

        // 1. MR Icon
        if (mr) {
          const isDraft =
            mr.draft ||
            mr.workInProgress ||
            mr.title.startsWith("Draft:") ||
            mr.title.startsWith("WIP:");
          icons.push({ type: "merge-request", status: isDraft ? "draft" : mr.state });
        }

        // 2. Todo Icon
        if (todo && filter !== "mrs") {
          const normalizedAction = todo.actionName.toLowerCase();
          const isMention =
            normalizedAction === TODO_ACTION_MENTIONED ||
            normalizedAction === TODO_ACTION_DIRECTLY_ADDRESSED;
          const isComment = normalizedAction === TODO_ACTION_COMMENTED;

          if (isMention) {
            icons.push({ type: "mention", status: todo.state });
          } else if (isComment) {
            icons.push({ type: "comment", status: todo.state });
          } else {
            icons.push({ type: "todo", status: todo.state });
          }
        }

        // 3. Pipeline Icon
        if (mr?.headPipeline) {
          icons.push({ type: "pipeline", status: mr.headPipeline.status });
        }

        // Fallback for data (prefer MR, then Todo target)
        const displayData = mr || todo?.target;

        if (!displayData && (!todo?.targetUrl || !todo?.author)) {
          return null;
        }

        const fallbackTitle = todo?.body?.trim();
        const normalizedAction = todo?.actionName?.toLowerCase();
        const isMention =
          normalizedAction === TODO_ACTION_MENTIONED ||
          normalizedAction === TODO_ACTION_DIRECTLY_ADDRESSED;
        const title =
          displayData?.title ||
          fallbackTitle ||
          (isMention ? "Mentioned in a merge request" : "New comment on a merge request");

        const author = displayData?.author || todo!.author;
        const webUrl = displayData?.webUrl || todo!.targetUrl!;
        const updatedAt = displayData ? item.date.toISOString() : todo!.createdAt;

        return (
          <InboxItem
            key={item.id}
            icons={icons}
            title={title}
            author={author}
            updatedAt={updatedAt}
            webUrl={webUrl}
          />
        );
      })}
    </div>
  );
}
