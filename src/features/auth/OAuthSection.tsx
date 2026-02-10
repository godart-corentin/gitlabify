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
        className="w-full h-10 bg-primary text-primary-content text-sm font-semibold rounded-md flex items-center justify-center gap-2 flex-shrink-0 transition-colors hover:bg-primary/90 disabled:opacity-60"
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
              className="w-full h-8 rounded-md bg-base-100 border border-base-300 text-sm px-3 pr-9 text-base-content placeholder:text-base-content/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/60 disabled:opacity-60"
              disabled={isPending}
              autoFocus
            />
            <button
              type="button"
              onClick={handleHideManualCode}
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 rounded-md text-base-content/50 hover:bg-base-200 transition-colors"
              title="Cancel"
            >
              ✕
            </button>
          </div>
          <button
            type="submit"
            className="h-8 px-3 rounded-md border border-base-300 text-xs font-semibold text-base-content/70 hover:bg-base-200 transition-colors whitespace-nowrap"
            disabled={isPending}
          >
            Verify
          </button>
        </form>
      )}

      {combinedError ? <p className="text-xs text-error text-center">{combinedError}</p> : null}

      <button
        onClick={handleShowPat}
        type="button"
        className="text-xs text-base-content/60 hover:text-base-content text-center py-2"
      >
        Use Personal Access Token instead
      </button>
    </>
  );
};
