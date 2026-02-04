import { invoke } from "@tauri-apps/api/core";
export type { User, AuthError } from "./types";
import type { User } from "./types";

/**
 * Verifies a Personal Access Token against a GitLab host.
 */
export async function verifyToken(token: string): Promise<User> {
  return await invoke<User>("verify_token", { token });
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
  return await invoke<string | null>("get_token");
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
  return await invoke<string>("start_oauth_flow");
}

/**
 * Exchanges an OAuth code for a token and returns the user profile.
 */
export async function exchangeCodeForToken(code: string): Promise<User> {
  return await invoke<User>("exchange_code_for_token", { code });
}
