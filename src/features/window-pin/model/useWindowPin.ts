import { useCallback, useEffect, useState } from "react";

import { getPinned, setPinned, snapToTray } from "../../../shared/api/tauri/commands";
import { reportFrontendError, reportFrontendWarning } from "../../../shared/lib/sentry";

export type WindowPinState = {
  isPinned: boolean;
  togglePin: () => void;
  snapToTray: () => void;
};

const WINDOW_PIN_FEATURE = "window-pin";

export const useWindowPin = (): WindowPinState => {
  const [isPinned, setIsPinned] = useState(true);

  useEffect(() => {
    let mounted = true;

    const handleGetPinnedError = (error: unknown) => {
      reportFrontendWarning("Failed to load window pin state", {
        action: "load-pin-state",
        error,
        feature: WINDOW_PIN_FEATURE,
      });
    };

    getPinned()
      .then((v) => {
        if (mounted) setIsPinned(v);
      })
      .catch(handleGetPinnedError);
    return () => {
      mounted = false;
    };
  }, []);

  const togglePin = useCallback(() => {
    const next = !isPinned;
    setIsPinned(next);

    const handleSetPinnedError = (error: unknown) => {
      setIsPinned(isPinned);
      reportFrontendError("Failed to update window pin state", {
        action: "toggle-pin",
        error,
        extra: { nextPinned: next },
        feature: WINDOW_PIN_FEATURE,
      });
    };

    setPinned(next).catch(handleSetPinnedError);
  }, [isPinned]);

  const handleSnapToTray = useCallback(() => {
    const handleSnapError = (error: unknown) => {
      reportFrontendError("Failed to snap window to tray", {
        action: "snap-to-tray",
        error,
        feature: WINDOW_PIN_FEATURE,
      });
    };

    snapToTray().catch(handleSnapError);
  }, []);

  return { isPinned, togglePin, snapToTray: handleSnapToTray };
};
