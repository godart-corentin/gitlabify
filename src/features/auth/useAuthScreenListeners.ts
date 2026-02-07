import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";

type UseAuthScreenListenersArgs = {
  exchangeCode: (code: string) => Promise<unknown>;
  refetchToken: () => void;
  setOauthErrorMessage: (message: string) => void;
};

export const useAuthScreenListeners = ({
  exchangeCode,
  refetchToken,
  setOauthErrorMessage,
}: UseAuthScreenListenersArgs) => {
  useEffect(() => {
    const unlisten = listen<string>("oauth-callback-received", async (event) => {
      const urlString = event.payload;
      try {
        const url = new URL(urlString);
        const code = url.searchParams.get("code");
        if (code) {
          await exchangeCode(code);
        }
      } catch (err: unknown) {
        setOauthErrorMessage(`OAuth Error: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    });

    return () => {
      unlisten.then((stop) => stop());
    };
  }, [exchangeCode, setOauthErrorMessage]);

  useEffect(() => {
    const handleFocus = () => {
      refetchToken();
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [refetchToken]);
};
