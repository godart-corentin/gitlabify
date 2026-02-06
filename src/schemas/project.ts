import { obj, str, num, bool, nullable, type ExtractValidatorType } from "sibyl-ts";

import { AuthorSchema } from "./user";

export const PipelineSchema = obj({
  id: num(),
  iid: nullable(num()),
  projectId: num(),
  status: str(),
  source: str(),
  ref: str(),
  sha: str(),
  webUrl: str(),
  createdAt: str(),
  updatedAt: str(),
});

export type Pipeline = ExtractValidatorType<typeof PipelineSchema>;

export const MergeRequestSchema = obj({
  id: num(),
  iid: num(),
  projectId: num(),
  sourceBranch: nullable(str()),
  title: str(),
  description: nullable(str()),
  state: str(),
  createdAt: str(),
  updatedAt: str(),
  webUrl: str(),
  author: AuthorSchema,
  hasConflicts: bool(),
  blockingDiscussionsResolved: bool(),
  headPipeline: nullable(PipelineSchema),
  draft: bool(),
  workInProgress: bool(),
});

export type MergeRequest = ExtractValidatorType<typeof MergeRequestSchema>;
