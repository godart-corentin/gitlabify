use serde::de::DeserializeOwned;
use std::sync::{atomic::Ordering, Arc};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager, Runtime};
use tauri_plugin_store::{Store, StoreExt};

use crate::modules::constants::{
    INBOX_CACHE_FILE_NAME, INBOX_CACHE_KEY_CONNECTION_STATUS, INBOX_CACHE_KEY_DATA,
    INBOX_CACHE_KEY_LAST_ERROR, INBOX_CACHE_KEY_LAST_UPDATED_MS, INBOX_CACHE_KEY_UNREAD_COUNT,
    INBOX_CACHE_STALE_THRESHOLD_MS, INBOX_CACHE_WRITE_DEBOUNCE_MS,
};
use crate::modules::gitlab::InboxData;
use crate::modules::tray::update_badge;
use crate::modules::utils::lock_or_recover;

use super::state::{
    emit_inbox_stale, update_count, ConnectionStatus, InboxStalePayload, InboxState,
};

pub(crate) fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_else(|_| Duration::from_secs(0))
        .as_millis() as u64
}

pub(crate) fn get_inbox_store<R: Runtime>(app: &AppHandle<R>) -> Option<Arc<Store<R>>> {
    if let Some(store) = app.get_store(INBOX_CACHE_FILE_NAME) {
        return Some(store);
    }

    app.store_builder(INBOX_CACHE_FILE_NAME)
        .auto_save(Duration::from_millis(INBOX_CACHE_WRITE_DEBOUNCE_MS))
        .build()
        .ok()
}

pub(crate) fn read_store_value<T: DeserializeOwned, R: Runtime>(
    store: &Store<R>,
    key: &str,
) -> Option<T> {
    let value = store.get(key)?;
    serde_json::from_value(value).ok()
}

pub(crate) fn write_store_value<T: serde::Serialize, R: Runtime>(
    store: &Store<R>,
    key: &str,
    value: &T,
) -> Option<()> {
    let json = serde_json::to_value(value).ok()?;
    store.set(key, json);
    Some(())
}

pub(crate) fn load_cached_inbox<R: Runtime>(app: &AppHandle<R>) {
    let store = match get_inbox_store(app) {
        Some(store) => store,
        None => return,
    };

    let cached_data: Option<InboxData> = read_store_value(&store, INBOX_CACHE_KEY_DATA);
    let last_updated_at_ms: Option<u64> = read_store_value(&store, INBOX_CACHE_KEY_LAST_UPDATED_MS);
    let unread_count: Option<usize> = read_store_value(&store, INBOX_CACHE_KEY_UNREAD_COUNT);
    let is_offline: Option<bool> = read_store_value(&store, INBOX_CACHE_KEY_CONNECTION_STATUS);
    let last_error: Option<String> = read_store_value(&store, INBOX_CACHE_KEY_LAST_ERROR);

    let state = app.state::<InboxState>();

    if let Some(data) = cached_data {
        state.set_data(data.clone());
        state.set_last_updated_at_ms(last_updated_at_ms);
        if let Some(true) = is_offline {
            state.set_status(ConnectionStatus::Offline);
        }

        if let Some(count) = unread_count {
            update_count(app, count);
        }

        if let Some(error) = last_error.clone() {
            state.set_error(error);
        }

        let _ = app.emit("inbox-updated", data);

        let has_last_error = last_error.is_some();
        let is_stale = last_updated_at_ms
            .map(|timestamp| now_ms().saturating_sub(timestamp) >= INBOX_CACHE_STALE_THRESHOLD_MS)
            .unwrap_or(true)
            || has_last_error;

        emit_inbox_stale(
            app,
            InboxStalePayload {
                is_stale,
                is_offline: state.is_offline(),
                last_updated_at_ms,
                last_error,
            },
        );

        let cached_count =
            unread_count.unwrap_or_else(|| state.unread_count.load(Ordering::Relaxed));
        update_badge(app, cached_count, state.is_offline());
        return;
    }

    let desired_offline = is_offline.unwrap_or(false);
    let previous_offline = state.is_offline();
    state.set_status(if desired_offline {
        ConnectionStatus::Offline
    } else {
        ConnectionStatus::Connected
    });

    if let Some(error) = last_error {
        state.set_error(error);
    }

    if previous_offline != desired_offline {
        let _ = app.emit("connection-status-changed", desired_offline);
    }

    update_badge(app, unread_count.unwrap_or(0), desired_offline);
}

pub(crate) fn persist_cache_success<R: Runtime>(
    app: &AppHandle<R>,
    data: &InboxData,
    unread_count: usize,
    last_updated_at_ms: u64,
) {
    let store = match get_inbox_store(app) {
        Some(store) => store,
        None => return,
    };

    let _ = write_store_value(&store, INBOX_CACHE_KEY_DATA, data);
    let _ = write_store_value(&store, INBOX_CACHE_KEY_LAST_UPDATED_MS, &last_updated_at_ms);
    let _ = write_store_value(&store, INBOX_CACHE_KEY_UNREAD_COUNT, &unread_count);
    let _ = write_store_value(&store, INBOX_CACHE_KEY_CONNECTION_STATUS, &false);
    store.delete(INBOX_CACHE_KEY_LAST_ERROR);
}

pub(crate) fn persist_cache_failure<R: Runtime>(app: &AppHandle<R>, error: &str, is_offline: bool) {
    let store = match get_inbox_store(app) {
        Some(store) => store,
        None => return,
    };

    let _ = write_store_value(&store, INBOX_CACHE_KEY_CONNECTION_STATUS, &is_offline);
    let _ = write_store_value(&store, INBOX_CACHE_KEY_LAST_ERROR, &error);
}

pub(crate) fn get_cached_inbox_data<R: Runtime>(app: &AppHandle<R>) -> Option<InboxData> {
    let state = app.state::<InboxState>();
    let data = lock_or_recover(&state.data, "InboxState data");
    data.clone()
}

#[cfg(test)]
mod tests {
    use crate::modules::gitlab::InboxData;

    #[test]
    fn inbox_cache_serialization() {
        let mock_data = InboxData {
            merge_requests: vec![],
            todos: vec![],
            pipelines: vec![],
        };
        let json = serde_json::to_value(&mock_data)
            .expect("serializing inbox data should succeed in test");
        let decoded: InboxData =
            serde_json::from_value(json).expect("deserializing inbox data should succeed in test");
        assert_eq!(decoded.merge_requests.len(), 0);
    }
}
