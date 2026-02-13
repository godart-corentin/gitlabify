import type { ChangeEvent, SubmitEvent } from "react";
import { useState } from "react";

type PatSectionProps = {
  isPending: boolean;
  isVerifying: boolean;
  errorMessage: string | null;
  onSubmitToken: (token: string) => Promise<void>;
  onBack: () => void;
};

export const PatSection = ({
  isPending,
  isVerifying,
  errorMessage,
  onSubmitToken,
  onBack,
}: PatSectionProps) => {
  const [token, setToken] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const handleTokenChange = (event: ChangeEvent<HTMLInputElement>) => {
    setToken(event.target.value);
  };

  const handleBack = () => {
    onBack();
  };

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalError(null);
    const trimmedToken = token.trim();
    if (!trimmedToken) {
      setLocalError("Please enter your Personal Access Token");
      return;
    }
    onSubmitToken(trimmedToken).catch(() => {
      // handled by upstream mutation
    });
  };

  const combinedError = localError || errorMessage;

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 flex-shrink-0 animate-in fade-in slide-in-from-bottom-2 duration-300"
    >
      <div className="space-y-1">
        <label className="text-[10px] uppercase tracking-widest font-semibold text-base-content/50 mb-1 block">
          Personal Access Token
        </label>
        <input
          type="password"
          value={token}
          onChange={handleTokenChange}
          placeholder="glpat-..."
          className={`w-full h-10 rounded-md bg-base-100 border text-sm px-3 text-base-content placeholder:text-base-content/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/60 ${
            combinedError ? "border-error text-error placeholder:text-error/60" : "border-base-300"
          }`}
          disabled={isPending}
          autoFocus
        />
        {combinedError && <p className="text-xs text-error">{combinedError}</p>}
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="submit"
          className="w-full h-10 bg-primary text-primary-content text-sm font-semibold rounded-md transition-colors hover:bg-primary/90 disabled:opacity-60"
          disabled={isPending}
        >
          {isVerifying ? (
            <span className="loading loading-spinner loading-xs"></span>
          ) : (
            "Connect with Token"
          )}
        </button>
        <button
          type="button"
          onClick={handleBack}
          className="text-xs text-base-content/60 hover:text-base-content text-center py-1"
          disabled={isPending}
        >
          Back to OAuth Login
        </button>
      </div>
    </form>
  );
};
