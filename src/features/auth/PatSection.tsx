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
        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1 block">
          Personal Access Token
        </label>
        <input
          type="password"
          value={token}
          onChange={handleTokenChange}
          placeholder="glpat-..."
          className={`w-full bg-transparent border-b py-1.5 text-sm focus:outline-none transition-colors ${
            combinedError
              ? "border-error text-error placeholder:text-error/50"
              : "border-zinc-200 focus:border-zinc-900"
          }`}
          disabled={isPending}
          autoFocus
        />
        {combinedError && <p className="text-[10px] text-error leading-tight">{combinedError}</p>}
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="submit"
          className="w-full py-2.5 bg-zinc-900 text-white rounded-md text-sm font-medium hover:bg-zinc-800 transition-all disabled:opacity-50 shadow-sm"
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
          className="text-[10px] text-zinc-400 hover:text-zinc-600 underline decoration-dotted transition-colors text-center py-1"
          disabled={isPending}
        >
          Back to OAuth Login
        </button>
      </div>
    </form>
  );
};
