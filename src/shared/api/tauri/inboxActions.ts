import { invoke } from "@tauri-apps/api/core";

/**
 * Marks a GitLab todo as done and triggers backend optimistic updates.
 */
export async function markTodoAsDone(todoId: number): Promise<void> {
  await invoke("mark_as_done", { todoId });
}
