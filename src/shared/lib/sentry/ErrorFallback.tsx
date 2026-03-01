import { RotateCcw } from "lucide-react";

const ERROR_HEADING = "Something went wrong";
const RELOAD_LABEL = "Reload";

type ErrorFallbackProps = { error: unknown };

const handleReload = (): void => {
  window.location.reload();
};

export const ErrorFallback = ({ error }: ErrorFallbackProps) => (
  <div
    role="alert"
    className="flex min-h-screen flex-col items-center justify-center gap-3 bg-base-100 px-6 text-center text-base-content"
  >
    <p className="text-sm font-semibold">{ERROR_HEADING}</p>
    <p className="max-w-xs truncate text-xs text-base-content/60">
      {error instanceof Error ? error.message : String(error)}
    </p>
    <button type="button" className="btn btn-xs btn-ghost gap-1" onClick={handleReload}>
      <RotateCcw className="h-3 w-3" />
      {RELOAD_LABEL}
    </button>
  </div>
);
