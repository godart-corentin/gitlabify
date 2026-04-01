import { Store } from "@tauri-apps/plugin-store";

import { LAST_NOTIFIED_VERSION_KEY, UPDATER_STORE_FILE } from "./updaterConstants";

export const getOrCreateUpdaterStore = async () => {
  const existing = await Store.get(UPDATER_STORE_FILE);
  if (existing) {
    return existing;
  }

  return Store.load(UPDATER_STORE_FILE);
};

export const getLastNotifiedVersion = async (store: Store) => store.get(LAST_NOTIFIED_VERSION_KEY);

export const saveLastNotifiedVersion = async (store: Store, version: string) => {
  await store.set(LAST_NOTIFIED_VERSION_KEY, version);
  await store.save();
};
