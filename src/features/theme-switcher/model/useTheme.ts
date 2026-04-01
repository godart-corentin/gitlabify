import { Store } from "@tauri-apps/plugin-store";
import { useEffect, useRef, useState } from "react";

import { reportFrontendError } from "../../../shared/lib/sentry";

export type ThemeMode = "light" | "dark";

const THEME_STORE_FILE = "ui-preferences.json";
const THEME_STORE_KEY = "theme";
const DARK_MEDIA_QUERY = "(prefers-color-scheme: dark)";
const THEME_SWITCHER_FEATURE = "theme-switcher";

const isThemeMode = (value: unknown): value is ThemeMode => value === "light" || value === "dark";

const getSystemTheme = (): ThemeMode => {
  if (typeof window === "undefined" || !window.matchMedia) {
    return "light";
  }
  return window.matchMedia(DARK_MEDIA_QUERY).matches ? "dark" : "light";
};

const addMediaListener = (media: MediaQueryList, handler: (event: MediaQueryListEvent) => void) => {
  media.addEventListener("change", handler);
  return () => media.removeEventListener("change", handler);
};

const getOrCreateStore = async () => {
  const existing = await Store.get(THEME_STORE_FILE);
  if (existing) {
    return existing;
  }
  return Store.load(THEME_STORE_FILE);
};

export const useTheme = () => {
  const [theme, setThemeState] = useState<ThemeMode>(() => getSystemTheme());
  const storeRef = useRef<Store | null>(null);
  const hasStoredPreferenceRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    const loadTheme = async () => {
      try {
        const store = await getOrCreateStore();
        if (!isMounted) {
          return;
        }
        storeRef.current = store;
        const value = await store.get(THEME_STORE_KEY);
        if (!isMounted) {
          return;
        }
        if (isThemeMode(value)) {
          hasStoredPreferenceRef.current = true;
          setThemeState(value);
        }
      } catch (error) {
        reportFrontendError("Failed to load theme preference", {
          action: "load-theme",
          error,
          feature: THEME_SWITCHER_FEATURE,
        });
      }
    };

    void loadTheme();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return undefined;
    }
    const media = window.matchMedia(DARK_MEDIA_QUERY);
    const handleChange = (event: MediaQueryListEvent) => {
      if (hasStoredPreferenceRef.current) {
        return;
      }
      setThemeState(event.matches ? "dark" : "light");
    };

    return addMediaListener(media, handleChange);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  const persistTheme = async (mode: ThemeMode) => {
    try {
      const store = storeRef.current ?? (await getOrCreateStore());
      storeRef.current = store;
      hasStoredPreferenceRef.current = true;
      await store.set(THEME_STORE_KEY, mode);
      await store.save();
    } catch (error) {
      reportFrontendError("Failed to persist theme preference", {
        action: "persist-theme",
        error,
        extra: { mode },
        feature: THEME_SWITCHER_FEATURE,
      });
    }
  };

  const setTheme = (mode: ThemeMode) => {
    setThemeState(mode);
    void persistTheme(mode);
  };

  return { theme, setTheme };
};
