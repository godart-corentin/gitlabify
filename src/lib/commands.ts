import { invoke } from "@tauri-apps/api/core";
export type { User, GitlabHostResponse, AuthError } from "./types";
import type { User, GitlabHostResponse } from "./types";

/**
 * Gets the configured GitLab host URL from the store.
 */
export async function getGitlabHost(): Promise<GitlabHostResponse> {
  return await invoke<GitlabHostResponse>("get_gitlab_host");
}

/**
 * Sets the GitLab host URL in the store.
 * @param host The host URL to set (e.g., "https://gitlab.com")
 */
export async function setGitlabHost(host: string): Promise<void> {
  await invoke("set_gitlab_host", { host });
}

/**
 * Clears the GitLab host URL from the store.
 */
export async function clearGitlabHost(): Promise<void> {
  await invoke("clear_gitlab_host");
}

/**
 * Verifies a Personal Access Token against a GitLab host.
 */
export async function verifyToken(token: string, host: string): Promise<User> {
  return await invoke<User>("verify_token", { token, host });
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
