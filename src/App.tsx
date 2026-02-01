import { useState } from "react";
import { useGitlabSettings } from "./hooks/useGitlabSettings";
import { useAuth } from "./hooks/useAuth";
import { SetupScreen } from "./features/onboarding/SetupScreen";
import { AuthScreen } from "./features/auth/AuthScreen";

function App() {
  const { gitlabHost, isLoading: isLoadingSettings } = useGitlabSettings();
  const { isAuthenticated, isLoadingToken, user, logout } = useAuth();
  const [isChangingHost, setIsChangingHost] = useState(false);

  const isLoading = isLoadingSettings || isLoadingToken;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-base-100">
        <span className="loading loading-spinner loading-md text-zinc-900"></span>
      </div>
    );
  }

  if (!gitlabHost || isChangingHost) {
    return <SetupScreen onComplete={() => setIsChangingHost(false)} />;
  }

  if (!isAuthenticated) {
    return (
      <AuthScreen
        onComplete={() => {}}
        onBack={() => setIsChangingHost(true)}
      />
    );
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
          <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-lg space-y-3">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Connected as
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-zinc-100 border border-zinc-200 overflow-hidden flex items-center justify-center flex-shrink-0">
                  {user?.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xs font-bold text-zinc-400">
                      {user?.name?.charAt(0) || "U"}
                    </span>
                  )}
                </div>
                <p className="text-sm font-medium text-zinc-900">
                  {user?.name}{" "}
                  <span className="text-zinc-400 font-normal">
                    @{user?.username}
                  </span>
                </p>
              </div>
            </div>

            <div className="space-y-1 border-t border-zinc-100 pt-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Instance URL
              </p>
              <p className="font-mono text-[10px] truncate text-zinc-600">
                {gitlabHost}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button className="w-full py-2 bg-zinc-900 text-white rounded-md font-medium hover:bg-zinc-800 transition-all cursor-pointer">
              Continue to Dashboard
            </button>
            <button
              className="w-full py-2 bg-transparent text-zinc-500 hover:text-zinc-400 text-sm font-medium transition-colors cursor-pointer"
              onClick={() => logout()}
            >
              Logout
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

export default App;
