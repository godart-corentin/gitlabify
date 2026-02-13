import { useCallback, useEffect } from "react";

import { useTauriEventListener } from "../../../shared/hooks/useTauriEventListener";

type UseAuthScreenListenersArgs = {
  exchangeCode: (code: string) => Promise<unknown>;
  refetchToken: () => Promise<unknown>;
  setOauthErrorMessage: (message: string) => void;
};

export const useAuthScreenListeners = ({
  exchangeCode,
  refetchToken,
  setOauthErrorMessage,
}: UseAuthScreenListenersArgs) => {
  const handleOauthCallback = useCallback(
    async (event: { payload: string }) => {
      const urlString = event.payload;
      try {
        const url = new URL(urlString);
        const code = url.searchParams.get("code");
        if (code) {
          await exchangeCode(code);
        }
      } catch (err: unknown) {
        setOauthErrorMessage(
          `OAuth Error: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      }
    },
    [exchangeCode, setOauthErrorMessage],
  );

  useTauriEventListener("oauth-callback-received", handleOauthCallback);

  useEffect(() => {
    const handleFocus = () => {
      void refetchToken();
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [refetchToken]);
};
