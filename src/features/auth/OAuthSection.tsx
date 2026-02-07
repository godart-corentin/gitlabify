import type { ChangeEvent, FormEvent } from "react";
import { useState } from "react";

type OAuthSectionProps = {
  isPending: boolean;
  isStartingOauth: boolean;
  isExchanging: boolean;
  showManualCode: boolean;
  errorMessage?: string | null;
  onManualCodeSubmit: (code: string) => Promise<void>;
  onHideManualCode: () => void;
  onStartOauth: () => Promise<void>;
  onShowPat: () => void;
};

export const OAuthSection = ({
  isPending,
  isStartingOauth,
  isExchanging,
  showManualCode,
  errorMessage,
  onManualCodeSubmit,
  onHideManualCode,
  onStartOauth,
  onShowPat,
}: OAuthSectionProps) => {
  const [manualCode, setManualCode] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const handleManualCodeChange = (event: ChangeEvent<HTMLInputElement>) => {
    setManualCode(event.target.value);
  };

  const handleShowPat = () => {
    onShowPat();
  };

  const handleHideManualCode = () => {
    onHideManualCode();
  };

  const handleStartOauth = () => {
    setLocalError(null);
    onStartOauth().catch(() => {
      // handled by upstream mutation
    });
  };

  const handleManualCodeSubmit = (event: FormEvent) => {
    event.preventDefault();
    setLocalError(null);
    const trimmedCode = manualCode.trim();
    if (!trimmedCode) {
      setLocalError("Please enter the OAuth code");
      return;
    }
    onManualCodeSubmit(trimmedCode).catch(() => {
      // handled by upstream mutation
    });
  };

  const combinedError = localError || errorMessage;

  return (
    <>
      <button
        onClick={handleStartOauth}
        disabled={isPending}
        type="button"
        className="w-full py-2.5 bg-zinc-900 text-white rounded-md text-sm font-medium hover:bg-zinc-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2 flex-shrink-0 shadow-sm"
      >
        {isStartingOauth || isExchanging ? (
          <span className="loading loading-spinner loading-xs"></span>
        ) : (
          <span className="text-xl">🦊</span>
        )}
        Login with GitLab.com
      </button>

      {showManualCode && (
        <form
          onSubmit={handleManualCodeSubmit}
          className="flex items-center gap-2 animate-in slide-in-from-top-2 duration-300 flex-shrink-0 mt-1"
        >
          <div className="relative flex-1">
            <input
              type="text"
              value={manualCode}
              onChange={handleManualCodeChange}
              placeholder="Paste OAuth code..."
              className="w-full bg-zinc-50 border border-zinc-200 rounded-md py-1.5 pl-2 pr-7 text-xs focus:outline-none focus:border-zinc-900 transition-colors"
              disabled={isPending}
              autoFocus
            />
            <button
              type="button"
              onClick={handleHideManualCode}
              className="absolute right-1 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 p-1 leading-none text-sm"
              title="Cancel"
            >
              ✕
            </button>
          </div>
          <button
            type="submit"
            className="px-3 py-1.5 bg-zinc-900 text-white rounded-md text-xs font-medium hover:bg-zinc-800 transition-all disabled:opacity-50 shadow-sm whitespace-nowrap"
            disabled={isPending}
          >
            Verify
          </button>
        </form>
      )}

      {combinedError ? (
        <p className="text-[10px] text-error leading-tight text-center">{combinedError}</p>
      ) : null}

      <button
        onClick={handleShowPat}
        type="button"
        className="text-[10px] text-zinc-400 hover:text-zinc-600 underline decoration-dotted transition-colors text-center py-2"
      >
        Use Personal Access Token instead
      </button>
    </>
  );
};
