use tauri::{AppHandle, State};

use crate::modules::gitlab::InboxData;
use crate::modules::utils::lock_or_recover;

use super::service::{fetch_inbox_once, ClientCache};
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
