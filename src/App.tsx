import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";

import { AuthScreen } from "./features/auth/AuthScreen";
import { Dashboard } from "./features/inbox/Dashboard";
import { useAuth } from "./hooks/useAuth";

function App() {
  const { isAuthenticated, isLoadingToken, isLoadingUser, user, logout } = useAuth();
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const unlisten = listen<boolean>("connection-status-changed", (event) => {
      setIsOffline(event.payload);
    });

    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  const isLoading = isLoadingToken || isLoadingUser;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950">
        <span className="loading loading-spinner loading-md text-orange-500"></span>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <AuthScreen onComplete={() => {}} />;
  }

  return (
    <main
      className="flex flex-col h-screen bg-zinc-950 text-zinc-200 overflow-hidden"
      data-theme="zinc"
    >
      <header className="flex items-center justify-between p-3 border-b border-zinc-800 flex-shrink-0 bg-zinc-950 z-20">
        <div className="flex items-center gap-2">
          <span className="text-xl">🦊</span>
          <div className="flex flex-col leading-none">
            <h1 className="text-sm font-semibold tracking-tight">gitlabify</h1>
            {isOffline && (
              <span className="text-[9px] font-bold text-rose-500 uppercase tracking-tighter">
                Offline
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end leading-none">
            <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wide">
              {user.username}
            </span>
          </div>

          <div className="w-6 h-6 rounded-full bg-zinc-800 overflow-hidden flex items-center justify-center flex-shrink-0 border border-zinc-700">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name || "User"}
                className="w-full h-full object-cover"
              />
            ) : null}
          </div>

          <button
            onClick={() => logout()}
            className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer border-l border-zinc-800 pl-3"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-hidden relative">
        <Dashboard />
      </div>
    </main>
  );
}

export default App;
