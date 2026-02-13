import { listen, type Event } from "@tauri-apps/api/event";
import { useEffect } from "react";

type TauriEventHandler<T> = (event: Event<T>) => void;

export const useTauriEventListener = <T>(eventName: string, handler: TauriEventHandler<T>) => {
  useEffect(() => {
    const unlisten = listen<T>(eventName, handler);

    return () => {
      void unlisten.then((stop) => stop());
    };
  }, [eventName, handler]);
};
