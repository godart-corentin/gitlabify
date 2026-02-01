import { invoke } from "@tauri-apps/api/core";

export interface GitlabHostResponse {
  host: string | null;
}

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
