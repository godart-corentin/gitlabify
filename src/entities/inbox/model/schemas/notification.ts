import { obj, str, num, nullable, type ExtractValidatorType } from "sibyl-ts";

import { MergeRequestSchema } from "./project";
import { AuthorSchema } from "./user";

export const TodoSchema = obj({
  id: num(),
  projectId: nullable(num()),
  author: AuthorSchema,
  actionName: str(),
  targetType: str(),
  targetUrl: nullable(str()),
  target: nullable(MergeRequestSchema),
  body: nullable(str()),
  state: str(),
  createdAt: str(),
});

export type Todo = ExtractValidatorType<typeof TodoSchema>;
