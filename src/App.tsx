import { useAppUpdater } from "./features/app-updater/model";
import { useAuthSession, useLogoutOnAuthRequired } from "./features/auth-session/model";
import { useConnectionStatus } from "./features/connection-status/model/useConnectionStatus";
import { useTheme } from "./features/theme-switcher/model/useTheme";
import { AuthPage } from "./pages/auth/ui/AuthPage";
import { InboxPage } from "./pages/inbox/ui/InboxPage";
import { AppShell } from "./widgets/app-shell/ui/AppShell";

export const App = () => {
  const { isAuthenticated, isLoadingToken, isLoadingUser, user, logout } = useAuthSession();
  const updater = useAppUpdater();
  useTheme();
  const { data: isOffline } = useConnectionStatus();

  useLogoutOnAuthRequired(logout);

  if (isLoadingToken || isLoadingUser) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-base-100 text-base-content">
        <span className="loading loading-spinner loading-md text-primary"></span>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <AuthPage />;
  }

  return (
    <AppShell user={user} isOffline={isOffline} onLogout={logout} updater={updater}>
      <InboxPage currentUsername={user.username} />
    </AppShell>
  );
};
