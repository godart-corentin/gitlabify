use tauri::{AppHandle, Manager, Runtime};

use crate::modules::constants::POLLING_INTERVAL_SECONDS;

use super::cache::load_cached_inbox;
use super::service::{fetch_inbox_once, ClientCache};
use super::state::InboxState;

pub(crate) fn start_polling<R: Runtime>(app: &AppHandle<R>) {
    let app_handle = app.clone();
    let poll_now = app.state::<InboxState>().poll_now.clone();

    load_cached_inbox(app);
    tauri::async_runtime::spawn(async move {
        let mut interval = tokio::time::interval_at(
            tokio::time::Instant::now() + std::time::Duration::from_secs(POLLING_INTERVAL_SECONDS),
            std::time::Duration::from_secs(POLLING_INTERVAL_SECONDS),
        );

        let mut cache = ClientCache::new();
        fetch_inbox_once(&app_handle, &mut cache).await;

        loop {
            tokio::select! {
                _ = interval.tick() => {}
                _ = poll_now.notified() => {}
            }

            let _ = fetch_inbox_once(&app_handle, &mut cache).await;
        }
    });
}
