import { clsx } from "clsx";
import { Check, Moon, Settings2, Sun } from "lucide-react";
import type { KeyboardEvent } from "react";
import { useRef } from "react";

import type { ThemeMode } from "../../hooks/useTheme";

type ThemeSettingsMenuProps = {
  theme: ThemeMode;
  onThemeChange: (mode: ThemeMode) => void;
};

const ESCAPE_KEY = "Escape";

export const ThemeSettingsMenu = ({ theme, onThemeChange }: ThemeSettingsMenuProps) => {
  const menuRef = useRef<HTMLDetailsElement | null>(null);

  const closeMenu = () => {
    if (menuRef.current) {
      menuRef.current.open = false;
    }
  };

  const handleSelectLight = () => {
    onThemeChange("light");
    closeMenu();
  };

  const handleSelectDark = () => {
    onThemeChange("dark");
    closeMenu();
  };

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDetailsElement>) => {
    if (event.key !== ESCAPE_KEY) {
      return;
    }
    event.preventDefault();
    closeMenu();
  };

  return (
    <details ref={menuRef} className="relative" onKeyDown={handleMenuKeyDown}>
      <summary
        className="list-none [&::-webkit-details-marker]:hidden p-2 rounded-md text-base-content/60 hover:bg-base-200 transition-colors flex items-center justify-center"
        aria-label="Theme settings"
      >
        <Settings2 className="h-4 w-4" />
      </summary>

      <div
        className="absolute right-0 mt-2 w-40 border border-base-300 bg-base-100 rounded-md p-1 flex flex-col gap-1 z-30"
        role="menu"
        aria-label="Theme options"
      >
        <button
          type="button"
          className={clsx(
            "flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-base-content/70 rounded-sm hover:bg-base-200 transition-colors",
            theme === "light" && "bg-base-200 text-base-content",
          )}
          onClick={handleSelectLight}
          role="menuitemradio"
          aria-checked={theme === "light"}
        >
          <Sun className="h-4 w-4" />
          <span>Light</span>
          {theme === "light" && <Check className="ml-auto h-3.5 w-3.5" />}
        </button>
        <button
          type="button"
          className={clsx(
            "flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-base-content/70 rounded-sm hover:bg-base-200 transition-colors",
            theme === "dark" && "bg-base-200 text-base-content",
          )}
          onClick={handleSelectDark}
          role="menuitemradio"
          aria-checked={theme === "dark"}
        >
          <Moon className="h-4 w-4" />
          <span>Dark</span>
          {theme === "dark" && <Check className="ml-auto h-3.5 w-3.5" />}
        </button>
      </div>
    </details>
  );
};
