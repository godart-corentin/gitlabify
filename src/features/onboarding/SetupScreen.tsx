import { useState } from "react";
import { useGitlabSettings } from "../../hooks/useGitlabSettings";
import { validateGitlabUrl } from "../../lib/validation";

interface SetupScreenProps {
  onComplete: () => void;
}

export const SetupScreen: React.FC<SetupScreenProps> = ({ onComplete }) => {
  const {
    gitlabHost,
    setGitlabHost,
    isSettingHost: loading,
    setHostError,
  } = useGitlabSettings();
  const [host, setHost] = useState(gitlabHost || "https://gitlab.com");
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!validateGitlabUrl(host)) {
      setValidationError("Please enter a valid HTTP/HTTPS URL");
      return;
    }

    setGitlabHost(host, {
      onSuccess: () => {
        onComplete();
      },
    });
  };

  const error =
    validationError ||
    (typeof setHostError === "string"
      ? setHostError
      : setHostError
        ? "Failed to save host"
        : null);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-base-100 p-8 text-base-content">
      <div className="w-full max-w-sm space-y-8">
        <header className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-4xl">🦊</span>
            <h1 className="text-2xl font-semibold tracking-tight">gitlabify</h1>
          </div>
          <h2 className="text-lg font-medium">Setup your instance</h2>
          <p className="text-sm text-zinc-500 leading-relaxed">
            Connect to your GitLab instance to start receiving notifications.
            Use{" "}
            <code className="bg-zinc-100 px-1 rounded">https://gitlab.com</code>{" "}
            for the public instance.
          </p>
        </header>

        <form onSubmit={handleSave} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Host URL
            </label>
            <input
              type="text"
              autoFocus
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="https://gitlab.example.com"
              className={`w-full bg-transparent border-b-2 py-2 focus:outline-none transition-colors ${
                error
                  ? "border-error text-error"
                  : "border-zinc-200 focus:border-zinc-900"
              }`}
              disabled={loading}
            />
            {error && <p className="text-xs text-error mt-1">{error}</p>}
          </div>

          <button
            type="submit"
            className={`w-full py-2.5 bg-zinc-900 text-white rounded-md font-medium hover:bg-zinc-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
            disabled={loading}
          >
            {loading ? (
              <span className="loading loading-spinner loading-xs"></span>
            ) : (
              "Continue"
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
