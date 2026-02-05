import { obj, arr, type ExtractValidatorType } from "sibyl-ts";

import { TodoSchema } from "./notification";
import { PipelineSchema, MergeRequestSchema } from "./project";

export const InboxDataSchema = obj({
  mergeRequests: arr(MergeRequestSchema),
  todos: arr(TodoSchema),
  pipelines: arr(PipelineSchema),
});

export type InboxData = ExtractValidatorType<typeof InboxDataSchema>;
