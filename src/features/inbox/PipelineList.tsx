import type { Pipeline } from "../../schemas";

import { PipelineRow } from "./PipelineRow";

type PipelineListProps = {
  pipelines: Pipeline[];
};

export const PipelineList = ({ pipelines }: PipelineListProps) => {
  const pipelineRows = pipelines.map((pipeline) => (
    <PipelineRow key={pipeline.id} pipeline={pipeline} />
  ));

  return <div className="flex flex-col w-full pb-4">{pipelineRows}</div>;
};
