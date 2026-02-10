import { Avatar } from "./components/ui/Avatar";
import { ThemeSettingsMenu } from "./components/ui/ThemeSettingsMenu";
import { AuthScreen } from "./features/auth/AuthScreen";
import { Dashboard } from "./features/inbox/Dashboard";
import { useAuth } from "./hooks/useAuth";
import { useConnectionStatus } from "./hooks/useConnectionStatus";
import { useLogoutOnAuthRequired } from "./hooks/useLogoutOnAuthRequired";
import { useTheme, type ThemeMode } from "./hooks/useTheme";

export const App = () => {
  const { isAuthenticated, isLoadingToken, isLoadingUser, user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { data: isOffline } = useConnectionStatus();
  const handleLogout = () => logout();
  const handleThemeChange = (mode: ThemeMode) => setTheme(mode);
  useLogoutOnAuthRequired(logout);

  const isLoading = isLoadingToken || isLoadingUser;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-base-100 text-base-content">
        <span className="loading loading-spinner loading-md text-primary"></span>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <AuthScreen />;
  }

  return (
    <main className="flex flex-col h-screen bg-base-100 text-base-content overflow-hidden">
      <header className="flex items-center justify-between h-14 px-4 border-b border-base-300 bg-base-100 flex-shrink-0 z-20">
        <div className="flex items-center gap-2">
          <span className="text-xl">🦊</span>
          <div className="flex flex-col leading-none">
            <h1 className="text-sm font-medium tracking-tight">gitlabify</h1>
            {isOffline && (
              <span className="text-[10px] uppercase tracking-widest font-semibold text-base-content/50 border border-base-300 rounded-full px-2 py-0.5">
                Offline
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end leading-none">
            <span className="text-xs font-mono text-base-content/60">{user.username}</span>
          </div>

          <ThemeSettingsMenu theme={theme} onThemeChange={handleThemeChange} />
          <Avatar src={user.avatarUrl} alt={user.name || "User"} size="sm" />

          <button
            onClick={handleLogout}
            type="button"
            className="text-xs font-medium text-base-content/60 hover:text-base-content border-l border-base-300 pl-3"
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
};
