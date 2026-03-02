import { LogOut } from "lucide-react";

import type { User } from "../../../entities/inbox/model";
import { Avatar } from "../../../shared/ui/avatar/Avatar";

type UserMenuProps = {
  user: User;
  onLogout: () => void;
};

export function UserMenu({ user, onLogout }: UserMenuProps) {
  return (
    <details className="dropdown dropdown-end">
      <summary className="list-none cursor-pointer rounded-full hover:ring-2 hover:ring-base-300 transition-all">
        <Avatar src={user.avatarUrl} alt={user.name} size="sm" />
      </summary>
      <div className="dropdown-content bg-base-100 border border-base-300 rounded-lg shadow-md mt-2 w-44 z-50 overflow-hidden">
        <div className="flex items-center gap-2 p-3 pb-2 border-b border-base-300">
          <Avatar src={user.avatarUrl} alt={user.name} size="md" />
          <div className="flex flex-col leading-none gap-0.5 min-w-0">
            <span className="text-sm font-medium text-base-content truncate">{user.name}</span>
            <span className="text-xs font-mono text-base-content/60">@{user.username}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="flex items-center gap-2 w-full px-3 py-2.5 text-xs text-base-content/70 hover:text-base-content hover:bg-base-200 transition-colors"
        >
          <LogOut size={13} />
          Sign out
        </button>
      </div>
    </details>
  );
}
