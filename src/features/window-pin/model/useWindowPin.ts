import { useCallback, useEffect, useState } from "react";

import { getPinned, setPinned, snapToTray } from "../../../shared/api/tauri/commands";

export type WindowPinState = {
  isPinned: boolean;
  togglePin: () => void;
  snapToTray: () => void;
};

export const useWindowPin = (): WindowPinState => {
  const [isPinned, setIsPinned] = useState(true);

  useEffect(() => {
    let mounted = true;
    getPinned()
      .then((v) => {
        if (mounted) setIsPinned(v);
      })
      .catch(console.error);
    return () => {
      mounted = false;
    };
  }, []);

  const togglePin = useCallback(() => {
    const next = !isPinned;
    setIsPinned(next);
    setPinned(next).catch(() => setIsPinned(isPinned));
  }, [isPinned]);

  const handleSnapToTray = useCallback(() => {
    snapToTray().catch(console.error);
  }, []);

  return { isPinned, togglePin, snapToTray: handleSnapToTray };
};
