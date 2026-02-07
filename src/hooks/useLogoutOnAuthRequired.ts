import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";

type LogoutHandler = () => void;

export const useLogoutOnAuthRequired = (logout: LogoutHandler) => {
  useEffect(() => {
    const unlisten = listen("auth-required", () => {
      logout();
    });

    return () => {
      unlisten.then((stop) => stop());
    };
  }, [logout]);
};
