import { useAuth } from "./hooks/useAuth";
import { AuthScreen } from "./features/auth/AuthScreen";

function App() {
  const { isAuthenticated, isLoadingToken, isLoadingUser, user, logout } =
    useAuth();

  const isLoading = isLoadingToken || isLoadingUser;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-base-100">
        <span className="loading loading-spinner loading-md text-zinc-900"></span>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <AuthScreen onComplete={() => {}} />;
  }

  return (
    <main
      className="flex flex-col h-screen bg-base-100 text-base-content p-4"
      data-theme="zinc"
    >
      <div className="w-full h-full flex flex-col">
        <header className="flex items-center justify-between mb-4 flex-shrink-0 relative z-50">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🦊</span>
            <h1 className="text-lg font-semibold tracking-tight">gitlabify</h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end leading-none">
              <span className="text-[10px] text-zinc-400 font-medium uppercase tracking-wide">
                Connected as
              </span>
              <span className="text-xs font-semibold text-zinc-200 truncate max-w-[100px]">
                {user.username}
              </span>
            </div>

            <div className="w-8 h-8 rounded-full bg-zinc-100 overflow-hidden flex items-center justify-center flex-shrink-0">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name || "User"}
                  className="w-full h-full object-cover"
                />
              ) : null}
            </div>
          </div>
        </header>

        <section className="flex-1 flex flex-col items-center justify-center text-zinc-400 relative">
          <div className="text-center space-y-2">
            <span className="text-4xl block opacity-80">✨</span>
            <p className="text-sm font-medium">All caught up!</p>
          </div>
        </section>

        <footer className="flex-shrink-0 flex justify-end mt-2">
          <button
            onClick={() => logout()}
            className="text-[12px] text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
          >
            Sign out
          </button>
        </footer>
      </div>
    </main>
  );
}

export default App;
