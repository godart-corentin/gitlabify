import type { InboxData, MergeRequest, Pipeline, Todo } from "../../schemas";

import type { InboxFilter } from "./types";

export const TODO_ACTION = {
  COMMENTED: "commented",
  MENTIONED: "mentioned",
  DIRECTLY_ADDRESSED: "directly_addressed",
} as const;

const DRAFT_TITLE_PREFIXES = ["Draft:", "WIP:"] as const;
const EPOCH_START_MS = 0;

export type GroupedItem = {
  id: string;
  date: Date;
  mr?: MergeRequest;
  todo?: Todo;
  pipeline?: Pipeline;
};

export const isDraftTitle = (title: string) => {
  return DRAFT_TITLE_PREFIXES.some((prefix) => title.startsWith(prefix));
};

export const getNormalizedAction = (actionName?: string | null) =>
  actionName ? actionName.toLowerCase() : "";

export const getPipelineItems = (data?: InboxData | null) => {
  if (!data) return [];
  return [...data.pipelines].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
};

export const getGroupedItems = (
  data: InboxData | null | undefined,
  filter: InboxFilter,
  currentUsername?: string,
) => {
  if (!data) return [];

  const { mergeRequests, todos } = data;
  const grouped = new Map<number, GroupedItem>();

  const getGroup = (id: number) => {
    if (!grouped.has(id)) {
      grouped.set(id, { id: `mr-${id}`, date: new Date(EPOCH_START_MS) });
    }
    return grouped.get(id)!;
  };

  mergeRequests.forEach((mr) => {
    const group = getGroup(mr.id);
    group.mr = mr;
    if (new Date(mr.updatedAt) > group.date) {
      group.date = new Date(mr.updatedAt);
    }
  });

  todos.forEach((todo) => {
    if (todo.target) {
      const group = getGroup(todo.target.id);
      group.todo = todo;
      if (!group.mr) {
        group.mr = todo.target;
      }
      if (new Date(todo.createdAt) > group.date) {
        group.date = new Date(todo.createdAt);
      }
      return;
    }

    grouped.set(todo.id, {
      id: `todo-${todo.id}`,
      date: new Date(todo.createdAt),
      todo,
    });
  });

  const result: GroupedItem[] = Array.from(grouped.values());

  const filteredResult = result.filter((item) => {
    const { mr, todo } = item;

    const isAuthor = currentUsername && mr?.author.username === currentUsername;
    const isTodoAuthor = currentUsername && todo?.author.username === currentUsername;
    const targetMrAuthor = todo?.target?.author.username;
    const isTargetMrMine = currentUsername && targetMrAuthor === currentUsername;
    const isTargetMrNotMine = currentUsername && targetMrAuthor && targetMrAuthor !== currentUsername;
    const isDraft =
      mr?.draft || mr?.workInProgress || (mr?.title ? isDraftTitle(mr.title) : false);
    const normalizedAction = getNormalizedAction(todo?.actionName);
    const isCommentTodo = normalizedAction === TODO_ACTION.COMMENTED;
    const isMentionTodo =
      normalizedAction === TODO_ACTION.MENTIONED ||
      normalizedAction === TODO_ACTION.DIRECTLY_ADDRESSED;

    if (filter === "notifications") {
      const needsReview = !!mr && mr.isReviewer && !mr.approvedByMe && !isAuthor && !isDraft;
      const commentsOnMyMr = !!todo && isCommentTodo && isTargetMrMine && !isTodoAuthor;
      const repliesToMyComments = !!todo && isCommentTodo && isTargetMrNotMine && !isTodoAuthor;
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
      return !!mr && isAuthor;
    }

    return true;
  });

  filteredResult.sort((a, b) => b.date.getTime() - a.date.getTime());
  return filteredResult;
};
