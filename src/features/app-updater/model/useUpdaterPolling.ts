import { useEffect } from "react";

import { UPDATER_RECHECK_INTERVAL_MS } from "./updaterConstants";

type UseUpdaterPollingOptions = {
  isEnabled: boolean;
  isPaused: boolean;
  runUpdateCheck: () => Promise<void>;
};

export const useUpdaterPolling = ({
  isEnabled,
  isPaused,
  runUpdateCheck,
}: UseUpdaterPollingOptions) => {
  useEffect(() => {
    if (!isEnabled) {
      return;
    }

    const intervalId = globalThis.setInterval(() => {
      if (isPaused) {
        return;
      }

      void runUpdateCheck();
    }, UPDATER_RECHECK_INTERVAL_MS);

    return () => {
      globalThis.clearInterval(intervalId);
    };
  }, [isEnabled, isPaused, runUpdateCheck]);
};
