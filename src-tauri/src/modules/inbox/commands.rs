use tauri::{AppHandle, State};

use crate::modules::gitlab::InboxData;
use crate::modules::utils::lock_or_recover;

use super::service::{fetch_inbox_once, mark_as_done as mark_as_done_service, ClientCache};
use super::state::{trigger_poll, InboxState};

#[tauri::command]
pub(crate) fn get_inbox(state: State<InboxState>) -> Option<InboxData> {
    let data = lock_or_recover(&state.data, "InboxState data");
    data.clone()
}

#[tauri::command]
pub(crate) fn get_connection_status(state: State<InboxState>) -> bool {
    state.is_offline()
}

#[tauri::command]
pub(crate) fn refresh_inbox(app: AppHandle) {
    trigger_poll(&app);
}

#[tauri::command]
pub(crate) async fn fetch_inbox(app: AppHandle) -> Option<InboxData> {
    let mut cache = ClientCache::new();
    fetch_inbox_once(&app, &mut cache).await
}

#[tauri::command]
pub(crate) async fn mark_as_done(app: AppHandle, todo_id: u64) -> Result<(), String> {
    mark_as_done_service(&app, todo_id)
        .await
        .map_err(|error| error.to_string())
}
