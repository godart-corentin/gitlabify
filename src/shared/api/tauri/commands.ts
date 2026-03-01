import { invoke } from "@tauri-apps/api/core";
import { str, nullable, bool } from "sibyl-ts";

import {
  InboxDataSchema,
  type InboxData,
  UserSchema,
  type User,
  type AuthError,
} from "../../../entities/inbox/model/schemas";

export type { User, AuthError };

/**
 * Verifies a Personal Access Token against a GitLab host.
 */
export async function verifyToken(token: string): Promise<User> {
  const data = await invoke("verify_token", { token });
  return UserSchema.judge(data);
}

/**
 * Saves a Personal Access Token securely in the native keychain.
 */
export async function saveToken(token: string): Promise<void> {
  await invoke("save_token", { token });
}

/**
 * Gets the saved Personal Access Token from the native keychain.
 */
export async function getToken(): Promise<string | null> {
  const data = await invoke("get_token");
  return nullable(str()).judge(data);
}

/**
 * Deletes the saved Personal Access Token from the native keychain.
 */
export async function deleteToken(): Promise<void> {
  await invoke("delete_token");
}

/**
 * Initiates the GitLab OAuth PKCE flow.
 */
export async function startOauthFlow(): Promise<string> {
  const data = await invoke("start_oauth_flow");
  return str().judge(data);
}

/**
 * Exchanges an OAuth code for a token and returns the user profile.
 */
export async function exchangeCodeForToken(code: string): Promise<User> {
  const data = await invoke("exchange_code_for_token", { code });
  return UserSchema.judge(data);
}

/**
 * Gets the current inbox data (MRs, Todos, Pipelines) from the backend state.
 */
export async function getInbox(): Promise<InboxData | null> {
  const data = await invoke("get_inbox");
  return nullable(InboxDataSchema).judge(data);
}

/**
 * Fetches the inbox data from GitLab immediately.
 */
export async function fetchInbox(): Promise<InboxData | null> {
  const data = await invoke("fetch_inbox");
  return nullable(InboxDataSchema).judge(data);
}

/**
 * Gets the current connection status (true if offline).
 */
export async function getConnectionStatus(): Promise<boolean> {
  const data = await invoke("get_connection_status");
  return bool().judge(data);
}

/**
 * Manually triggers an inbox refresh.
 */
export async function refreshInbox(): Promise<void> {
  await invoke("refresh_inbox");
}

/**
 * Gets the current window pin state.
 */
export async function getPinned(): Promise<boolean> {
  const data = await invoke("get_pinned");
  return bool().judge(data);
}

/**
 * Sets the window pin state (always-on-top + persists).
 */
export async function setPinned(pinned: boolean): Promise<void> {
  await invoke("set_pinned", { pinned });
}

/**
 * Moves the window back to the tray-icon position without changing the pin state.
 */
export async function snapToTray(): Promise<void> {
  await invoke("snap_to_tray");
}
