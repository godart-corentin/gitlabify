import { useCallback } from "react";

import { useTauriEventListener } from "../../../shared/hooks/useTauriEventListener";

type LogoutHandler = () => void;

export const useLogoutOnAuthRequired = (logout: LogoutHandler) => {
  const handleAuthRequired = useCallback(() => {
    logout();
  }, [logout]);

  useTauriEventListener("auth-required", handleAuthRequired);
};
