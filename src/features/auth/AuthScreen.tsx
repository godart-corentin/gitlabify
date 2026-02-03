import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useGitlabSettings } from "../../hooks/useGitlabSettings";
import { listen } from "@tauri-apps/api/event";
import { isAuthError } from "../../lib/types";

interface AuthScreenProps {
  onComplete: () => void;
  onBack?: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onComplete }) => {
  const { setGitlabHost } = useGitlabSettings();
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
  const [showPAT, setShowPAT] = useState(false);
  const [debugClicks, setDebugClicks] = useState(0);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Hardcode GitLab.com for MVP
  useEffect(() => {
    setGitlabHost("https://gitlab.com");
  }, []);

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

    try {
      await verifyAndSave({ token: trimmedToken, host: "https://gitlab.com" });
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
    <div
      className="flex flex-col h-screen bg-base-100 p-4 text-base-content"
      data-theme="zinc"
    >
      <div className="w-full h-full flex flex-col">
        <header className="flex items-center justify-between mb-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🦊</span>
            <h1 className="text-lg font-semibold tracking-tight">gitlabify</h1>
          </div>
        </header>

        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto pr-1">
          <div className="mb-6 flex-shrink-0">
            <h2
              className="text-lg font-medium cursor-default select-none"
              onClick={handleSecretClick}
            >
              Authenticate
            </h2>
            <p className="text-xs text-zinc-500">
              Sign in to your GitLab account to continue.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            {!showPAT ? (
              <>
                {/* OAuth Section */}
                <button
                  onClick={handleOAuth}
                  disabled={isPending}
                  className="w-full py-2.5 bg-zinc-900 text-white rounded-md text-sm font-medium hover:bg-zinc-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2 flex-shrink-0 shadow-sm"
                >
                  {isStartingOauth || isExchanging ? (
                    <span className="loading loading-spinner loading-xs"></span>
                  ) : (
                    <span className="text-xl">🦊</span>
                  )}
                  Login with GitLab.com
                </button>

                {/* Developer Manual Code Section (Appears when active) */}
                {showManualCode && (
                    <form
                    onSubmit={handleManualCodeSubmit}
                    className="flex items-center gap-2 animate-in slide-in-from-top-2 duration-300 flex-shrink-0 mt-1"
                    >
                        <div className="relative flex-1">
                            <input
                            type="text"
                            value={manualCode}
                            onChange={(e) => setManualCode(e.target.value)}
                            placeholder="Paste OAuth code..."
                            className="w-full bg-zinc-50 border border-zinc-200 rounded-md py-1.5 pl-2 pr-7 text-xs focus:outline-none focus:border-zinc-900 transition-colors"
                            disabled={isPending}
                            autoFocus
                            />
                            <button
                            type="button"
                            onClick={() => setShowManualCode(false)}
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

                <button 
                    onClick={() => setShowPAT(true)}
                    className="text-[10px] text-zinc-400 hover:text-zinc-600 underline decoration-dotted transition-colors text-center py-2"
                >
                    Use Personal Access Token instead
                </button>
              </>
            ) : (
              /* PAT Section */
              <form onSubmit={handleSubmit} className="flex flex-col gap-4 flex-shrink-0 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1 block">
                        Personal Access Token
                    </label>
                    <input
                      type="password"
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      placeholder="glpat-..."
                      className={`w-full bg-transparent border-b py-1.5 text-sm focus:outline-none transition-colors ${
                          errorMessage
                          ? "border-error text-error placeholder:text-error/50"
                          : "border-zinc-200 focus:border-zinc-900"
                      }`}
                      disabled={isPending}
                      autoFocus
                    />
                    {errorMessage && (
                    <p className="text-[10px] text-error leading-tight">{errorMessage}</p>
                    )}
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
                        onClick={() => setShowPAT(false)}
                        className="text-[10px] text-zinc-400 hover:text-zinc-600 underline decoration-dotted transition-colors text-center py-1"
                        disabled={isPending}
                    >
                        Back to OAuth Login
                    </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
