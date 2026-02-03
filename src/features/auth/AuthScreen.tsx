import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useGitlabSettings } from "../../hooks/useGitlabSettings";
import { listen } from "@tauri-apps/api/event";
import { isAuthError } from "../../lib/types";

interface AuthScreenProps {
  onComplete: () => void;
  onBack: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onComplete,
  onBack,
}) => {
  const { gitlabHost } = useGitlabSettings();
  const {
    verifyAndSave,
    isVerifying,
    verifyError,
    startOauth,
    exchangeCode,
    isStartingOauth,
    isExchanging,
    authError,
    refetchToken,
  } = useAuth();
  const [token, setToken] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [showManualCode, setShowManualCode] = useState(false);
  const [debugClicks, setDebugClicks] = useState(0);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    // Listen for deep link callbacks from the backend
    const unlisten = listen<string>(
      "oauth-callback-received",
      async (event) => {
        const urlString = event.payload;
        try {
          const url = new URL(urlString);
          const code = url.searchParams.get("code");
          if (code) {
            await exchangeCode(code);
            onComplete();
          }
        } catch (err: any) {
          setValidationError(`OAuth Error: ${err.message || "Unknown error"}`);
        }
      },
    );

    return () => {
      unlisten.then((f) => f());
    };
  }, [exchangeCode, onComplete]);

  // Poll for token in case authentication happened in another window
  useEffect(() => {
    const handleFocus = () => {
      refetchToken();
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [refetchToken]);

  const handleSecretClick = () => {
    const newClicks = debugClicks + 1;
    setDebugClicks(newClicks);
    if (newClicks >= 5) {
      setShowManualCode(true);
      setDebugClicks(0);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const trimmedToken = token.trim();
    if (!trimmedToken) {
      setValidationError("Please enter your Personal Access Token");
      return;
    }

    if (!gitlabHost) {
      setValidationError("GitLab host is not configured. Please go back.");
      return;
    }

    try {
      await verifyAndSave({ token: trimmedToken, host: gitlabHost });
      onComplete();
    } catch (err) {
      // already handled by mutation
    }
  };

  const handleManualCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    const trimmedCode = manualCode.trim();
    if (!trimmedCode) {
      setValidationError("Please enter the OAuth code");
      return;
    }
    try {
      await exchangeCode(trimmedCode);
      onComplete();
    } catch (err: any) {
      setValidationError(err.message || "Failed to verify code");
    }
  };

  const handleOAuth = async () => {
    try {
      await startOauth();
    } catch (err) {
      // already handled by mutation
    }
  };

  const isPending = isVerifying || isStartingOauth || isExchanging;

  // Type-safe error message resolution
  const getErrorMessage = () => {
    if (validationError) return validationError;

    const error = authError || verifyError;
    if (!error) return null;

    if (isAuthError(error)) {
      if (error.type === "invalidToken") return "Invalid Personal Access Token";
      return error.message || "Authentication failed";
    }

    if (error instanceof Error) return error.message;
    return "Authentication failed";
  };

  const errorMessage = getErrorMessage();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-base-100 p-8 text-base-content">
      <div className="w-full max-w-sm space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <header className="space-y-4">
          <div className="flex items-center gap-3">
            <span
              className="text-4xl cursor-default select-none active:scale-95 transition-transform"
              onClick={handleSecretClick}
              title="Authenticate"
            >
              🔑
            </span>
            <h1 className="text-2xl font-semibold tracking-tight">
              Authenticate
            </h1>
          </div>
          <p className="text-sm text-zinc-500 leading-relaxed">
            Choose an authentication method for{" "}
            <span className="font-medium text-zinc-900">{gitlabHost}</span>.
          </p>
        </header>

        <div className="space-y-6">
          <button
            onClick={handleOAuth}
            disabled={isPending}
            className="w-full py-3 bg-zinc-900 text-white rounded-md font-medium hover:bg-zinc-800 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
          >
            {isStartingOauth || isExchanging ? (
              <span className="loading loading-spinner loading-xs"></span>
            ) : (
              <span className="text-xl">🦊</span>
            )}
            Login with GitLab (OAuth)
          </button>

          {showManualCode && (
            <form
              onSubmit={handleManualCodeSubmit}
              className="space-y-4 p-4 bg-zinc-50 rounded-md border border-zinc-200 animate-in slide-in-from-top-2 duration-300"
            >
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Manual OAuth Code
                </label>
                <button
                  type="button"
                  onClick={() => setShowManualCode(false)}
                  className="text-[10px] text-zinc-400 hover:text-zinc-600"
                >
                  Cancel
                </button>
              </div>
              <div className="space-y-2">
                <p className="text-[10px] text-zinc-500">
                  <strong>Important:</strong> You must click "Login with GitLab"
                  above <em>first</em> to initialize the secure session.
                </p>
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="e.g. 6f3a..."
                  className={`w-full text-zinc-600 bg-transparent border-b-2 py-2 focus:outline-none transition-colors ${
                    errorMessage
                      ? "border-error text-error"
                      : "border-zinc-200 focus:border-zinc-900"
                  }`}
                  disabled={isPending}
                />
                {errorMessage && (
                  <p className="text-xs text-error mt-1 font-medium">
                    {errorMessage}
                  </p>
                )}
              </div>
              <button
                type="submit"
                className="w-full py-2 bg-zinc-200 text-zinc-900 rounded-md font-medium hover:bg-zinc-300 transition-all disabled:opacity-50"
                disabled={isPending}
              >
                {isExchanging ? "Verifying..." : "Verify Code"}
              </button>
            </form>
          )}

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-zinc-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-base-100 px-2 text-zinc-400">Or use PAT</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Personal Access Token
              </label>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="glpat-..."
                className={`w-full text-zinc-100 bg-transparent border-b-2 py-2 focus:outline-none transition-colors ${
                  errorMessage
                    ? "border-error text-error"
                    : "border-zinc-200 focus:border-zinc-100"
                }`}
                disabled={isPending}
              />
              {errorMessage && (
                <p className="text-xs text-error mt-1">{errorMessage}</p>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-zinc-100 text-zinc-900 rounded-md font-medium hover:bg-zinc-200 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              disabled={isPending}
            >
              {isVerifying ? (
                <span className="loading loading-spinner loading-xs"></span>
              ) : (
                "Connect with PAT"
              )}
            </button>
          </form>

          <button
            type="button"
            onClick={onBack}
            className="w-full py-2.5 text-zinc-500 text-sm font-medium hover:text-zinc-900 transition-colors"
            disabled={isPending}
          >
            Back to Host Settings
          </button>
        </div>
      </div>
    </div>
  );
};
