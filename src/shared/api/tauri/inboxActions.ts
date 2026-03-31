import { invoke } from "@tauri-apps/api/core";

/**
 * Marks a GitLab todo as done after the backend confirms success with GitLab.
 */
export async function markTodoAsDone(todoId: number): Promise<void> {
  await invoke("mark_as_done", { todoId });
}
