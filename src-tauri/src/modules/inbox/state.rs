use std::sync::{
    atomic::{AtomicBool, AtomicUsize, Ordering},
    Arc, Mutex,
};

use tauri::{AppHandle, Emitter, Manager, Runtime};
use tokio::sync::Notify;

use crate::modules::constants::{
    CONSECUTIVE_FAILURE_THRESHOLD, INBOX_CACHE_KEY_CONNECTION_STATUS, INBOX_CACHE_KEY_LAST_ERROR,
};
use crate::modules::gitlab::InboxData;
use crate::modules::tray::update_badge;
use crate::modules::utils::lock_or_recover;

use super::cache::{get_inbox_store, write_store_value};

#[allow(dead_code)]
#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum ConnectionStatus {
    Connected,
    Offline,
}

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct InboxStalePayload {
    pub(crate) is_stale: bool,
    pub(crate) is_offline: bool,
    pub(crate) last_updated_at_ms: Option<u64>,
    pub(crate) last_error: Option<String>,
}

pub(crate) struct InboxState {
    pub(crate) is_offline: AtomicBool,
    pub(crate) unread_count: AtomicUsize,
    pub(crate) consecutive_failures: AtomicUsize,
    pub(crate) data: Mutex<Option<InboxData>>,
    pub(crate) last_error: Mutex<Option<String>>,
    pub(crate) last_updated_at_ms: Mutex<Option<u64>>,
    pub(crate) poll_now: Arc<Notify>,
}

impl InboxState {
    pub fn new() -> Self {
        Self {
            is_offline: AtomicBool::new(false),
            unread_count: AtomicUsize::new(0),
            consecutive_failures: AtomicUsize::new(0),
            data: Mutex::new(None),
            last_error: Mutex::new(None),
            last_updated_at_ms: Mutex::new(None),
            poll_now: Arc::new(Notify::new()),
        }
    }

    /// Updates the state based on polling success/failure.
    /// Returns (status_changed, is_offline, count)
    pub fn update(&self, success: bool) -> (bool, bool, usize) {
        let count = self.unread_count.load(Ordering::Relaxed);

        if success {
            self.consecutive_failures.store(0, Ordering::Relaxed);
            let was_offline = self.is_offline.swap(false, Ordering::Relaxed);
            *lock_or_recover(&self.last_error, "InboxState last_error") = None;
            return (was_offline, false, count);
        }

        let failures = self
            .consecutive_failures
            .fetch_add(1, Ordering::Relaxed)
            .saturating_add(1);

        let mut changed = false;
        if failures >= CONSECUTIVE_FAILURE_THRESHOLD {
            let was_offline = self.is_offline.swap(true, Ordering::Relaxed);
            changed = !was_offline;
        }

        (changed, self.is_offline.load(Ordering::Relaxed), count)
    }

    pub fn set_count(&self, new_count: usize) -> (bool, bool, usize) {
        let previous = self.unread_count.swap(new_count, Ordering::Relaxed);
        let is_offline = self.is_offline.load(Ordering::Relaxed);

        if previous != new_count {
            return (true, is_offline, new_count);
        }

        (false, is_offline, previous)
    }

    pub fn set_data(&self, new_data: InboxData) {
        let mut data = lock_or_recover(&self.data, "InboxState data");
        *data = Some(new_data);
    }

    pub fn set_error(&self, error: String) {
        let mut last_error = lock_or_recover(&self.last_error, "InboxState last_error");
        *last_error = Some(error);
    }

    pub fn clear_error(&self) {
        let mut last_error = lock_or_recover(&self.last_error, "InboxState last_error");
        *last_error = None;
    }

    pub fn set_status(&self, status: ConnectionStatus) {
        let is_offline = matches!(status, ConnectionStatus::Offline);
        self.is_offline.store(is_offline, Ordering::Relaxed);
    }

    pub fn is_offline(&self) -> bool {
        self.is_offline.load(Ordering::Relaxed)
    }

    pub fn set_last_updated_at_ms(&self, last_updated_at_ms: Option<u64>) {
        let mut last_updated = lock_or_recover(&self.last_updated_at_ms, "InboxState last_updated");
        *last_updated = last_updated_at_ms;
    }

    pub fn get_last_updated_at_ms(&self) -> Option<u64> {
        let last_updated = lock_or_recover(&self.last_updated_at_ms, "InboxState last_updated");
        *last_updated
    }
}

pub(crate) fn emit_inbox_stale<R: Runtime>(app: &AppHandle<R>, payload: InboxStalePayload) {
    let _ = app.emit("inbox-stale", payload);
}

pub(crate) fn update_connection_status<R: Runtime>(app: &AppHandle<R>, success: bool) {
    let state = app.state::<InboxState>();
    let (changed, is_offline, count) = state.update(success);

    if changed {
        update_badge(app, count, is_offline);
        let _ = app.emit("connection-status-changed", is_offline);
    }
}

pub(crate) fn set_connection_status<R: Runtime>(app: &AppHandle<R>, is_offline: bool) {
    let state = app.state::<InboxState>();
    let was_offline = state.is_offline();

    state.set_status(if is_offline {
        ConnectionStatus::Offline
    } else {
        ConnectionStatus::Connected
    });

    let count = state.unread_count.load(Ordering::Relaxed);
    update_badge(app, count, is_offline);

    if was_offline != is_offline {
        let _ = app.emit("connection-status-changed", is_offline);
    }
}

pub(crate) fn clear_stale_and_mark_online<R: Runtime>(app: &AppHandle<R>) {
    let state = app.state::<InboxState>();
    state.clear_error();
    state.consecutive_failures.store(0, Ordering::Relaxed);
    let last_updated_at_ms = state.get_last_updated_at_ms();

    if let Some(store) = get_inbox_store(app) {
        let _ = write_store_value(&store, INBOX_CACHE_KEY_CONNECTION_STATUS, &false);
        store.delete(INBOX_CACHE_KEY_LAST_ERROR);
    }

    set_connection_status(app, false);
    emit_inbox_stale(
        app,
        InboxStalePayload {
            is_stale: false,
            is_offline: false,
            last_updated_at_ms,
            last_error: None,
        },
    );
}

pub(crate) fn update_count<R: Runtime>(app: &AppHandle<R>, count: usize) {
    let state = app.state::<InboxState>();
    let (changed, is_offline, _) = state.set_count(count);

    if changed {
        update_badge(app, count, is_offline);
    }
}

pub(crate) fn trigger_poll<R: Runtime>(app: &AppHandle<R>) {
    let state = app.state::<InboxState>();
    state.poll_now.notify_one();
}

#[cfg(test)]
mod tests {
    use super::InboxState;
    use crate::modules::gitlab::InboxData;
    use crate::modules::utils::lock_or_recover;

    #[test]
    fn inbox_state_update() {
        let state = InboxState::new();

        let (changed, is_offline, count) = state.update(true);
        assert!(!changed);
        assert!(!is_offline);
        assert_eq!(count, 0);

        let (changed, is_offline, _) = state.update(false);
        assert!(!changed);
        assert!(!is_offline);

        state.update(false);
        let (changed, is_offline, _) = state.update(false);
        assert!(changed);
        assert!(is_offline);

        let (changed, is_offline, _) = state.update(true);
        assert!(changed);
        assert!(!is_offline);
        assert!(lock_or_recover(&state.last_error, "test last_error").is_none());
    }

    #[test]
    fn inbox_state_data() {
        let state = InboxState::new();

        {
            let data = lock_or_recover(&state.data, "test data empty");
            assert!(data.is_none());
        }

        let mock_data = InboxData {
            merge_requests: vec![],
            todos: vec![],
            pipelines: vec![],
        };

        state.set_data(mock_data);

        {
            let data = lock_or_recover(&state.data, "test data set");
            assert!(data.is_some());
        }
    }
}
