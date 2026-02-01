import { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useGitlabSettings } from "../../hooks/useGitlabSettings";

interface AuthScreenProps {
  onComplete: () => void;
  onBack: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onComplete,
  onBack,
}) => {
  const { gitlabHost } = useGitlabSettings();
  const { verifyAndSave, isVerifying, verifyError } = useAuth();
  const [token, setToken] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

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
    } catch (err: any) {
      // Error is already captured by react-query mutation's error state
      console.error("Auth failed:", err);
    }
  };

  const error: any = validationError || verifyError;
  const errorMessage =
    typeof error === "string"
      ? error
      : error?.message ||
        (error?.type === "invalidToken"
          ? "Invalid Personal Access Token"
          : "Authentication failed");

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-base-100 p-8 text-base-content">
      <div className="w-full max-w-sm space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <header className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-4xl">🔑</span>
            <h1 className="text-2xl font-semibold tracking-tight">
              Authenticate
            </h1>
          </div>
          <p className="text-sm text-zinc-500 leading-relaxed">
            Enter a Personal Access Token with{" "}
            <code className="bg-zinc-100 px-1 rounded">api</code> and{" "}
            <code className="bg-zinc-100 px-1 rounded">read_user</code> scopes
            for <span className="font-medium text-zinc-900">{gitlabHost}</span>.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Personal Access Token
            </label>
            <input
              type="password"
              autoFocus
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="glpat-..."
              className={`w-full bg-transparent border-b-2 py-2 focus:outline-none transition-colors ${
                error
                  ? "border-error text-error"
                  : "border-zinc-200 focus:border-zinc-900"
              }`}
              disabled={isVerifying}
            />
            {errorMessage && (
              <p className="text-xs text-error mt-1">{errorMessage}</p>
            )}
          </div>

          <div className="flex flex-col gap-3 pt-2">
            <button
              type="submit"
              className={`w-full py-2.5 bg-zinc-900 text-white rounded-md font-medium hover:bg-zinc-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
              disabled={isVerifying}
            >
              {isVerifying ? (
                <span className="loading loading-spinner loading-xs"></span>
              ) : (
                "Connect Account"
              )}
            </button>
            <button
              type="button"
              onClick={onBack}
              className="w-full py-2.5 text-zinc-500 text-sm font-medium hover:text-zinc-900 transition-colors"
              disabled={isVerifying}
            >
              Back to Host Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
