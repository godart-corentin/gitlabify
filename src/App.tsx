import { useState } from "react";
import { useGitlabSettings } from "./hooks/useGitlabSettings";
import { SetupScreen } from "./features/onboarding/SetupScreen";

function App() {
  const { gitlabHost, isLoading } = useGitlabSettings();
  const [isSettingUp, setIsSettingUp] = useState(false);

  const onChangeURLClick = () => {
    setIsSettingUp(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-base-100">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }

  if (!gitlabHost || isSettingUp) {
    return <SetupScreen onComplete={() => setIsSettingUp(false)} />;
  }

  return (
    <main
      className="flex flex-col items-center justify-center min-h-screen bg-base-100 text-base-content p-8"
      data-theme="zinc"
    >
      <div className="w-full max-w-sm space-y-8">
        <header className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-4xl">🦊</span>
            <h1 className="text-2xl font-semibold tracking-tight">gitlabify</h1>
          </div>
          <p className="text-sm text-zinc-500 leading-relaxed">
            Successfully connected to your GitLab instance.
          </p>
        </header>

        <section className="space-y-6">
          <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-lg space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Instance URL
            </p>
            <p className="font-mono text-sm truncate text-zinc-600">
              {gitlabHost}
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <button className="w-full py-2 bg-zinc-900 text-white rounded-md font-medium hover:bg-zinc-800 transition-all cursor-pointer">
              Continue to Dashboard
            </button>
            <button
              className="w-full py-2 bg-transparent text-zinc-500 hover:text-zinc-400 text-sm font-medium transition-colors cursor-pointer"
              onClick={onChangeURLClick}
            >
              Change URL
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

export default App;
