import { useEffect } from "react";

type UseUpdaterStartupCheckOptions = {
  isEnabled: boolean;
  runUpdateCheck: () => Promise<void>;
};

let hasStartupUpdateCheckRun = false;

export const resetAppUpdaterSessionStateForTests = () => {
  hasStartupUpdateCheckRun = false;
};

export const useUpdaterStartupCheck = ({
  isEnabled,
  runUpdateCheck,
}: UseUpdaterStartupCheckOptions) => {
  useEffect(() => {
    if (!isEnabled) {
      return;
    }

    if (hasStartupUpdateCheckRun) {
      return;
    }
    hasStartupUpdateCheckRun = true;

    let isCancelled = false;

    const startCheck = async () => {
      if (isCancelled) {
        return;
      }

      await runUpdateCheck();
    };

    void startCheck();

    return () => {
      isCancelled = true;
    };
  }, [isEnabled, runUpdateCheck]);
};
