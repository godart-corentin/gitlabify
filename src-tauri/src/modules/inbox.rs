use crate::modules::tray::update_badge;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, Runtime};

#[allow(dead_code)]
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum ConnectionStatus {
    Connected,
    Offline,
}

pub struct InboxState {
    #[allow(dead_code)]
    pub status: Mutex<ConnectionStatus>,
    #[allow(dead_code)]
    pub unread_count: Mutex<usize>,
    #[allow(dead_code)]
    pub consecutive_failures: Mutex<usize>,
}

impl InboxState {
    pub fn new() -> Self {
        Self {
            status: Mutex::new(ConnectionStatus::Connected),
            unread_count: Mutex::new(0),
            consecutive_failures: Mutex::new(0),
        }
    }

    /// Updates the state based on polling success/failure.
    /// Returns (status_changed, is_offline, count)
    #[allow(dead_code)]
    pub fn update(&self, success: bool) -> (bool, bool, usize) {
        let mut status = self.status.lock().unwrap();
        let mut failures = self.consecutive_failures.lock().unwrap();
        let count = *self.unread_count.lock().unwrap();
        let mut changed = false;

        if success {
            *failures = 0;
            if *status != ConnectionStatus::Connected {
                *status = ConnectionStatus::Connected;
                changed = true;
            }
        } else {
            *failures += 1;
            // Check for 3 consecutive failures
            if *failures >= 3 && *status != ConnectionStatus::Offline {
                *status = ConnectionStatus::Offline;
                changed = true;
            }
        }

        (changed, *status == ConnectionStatus::Offline, count)
    }

    #[allow(dead_code)]
    pub fn set_count(&self, new_count: usize) -> (bool, bool, usize) {
        let mut count = self.unread_count.lock().unwrap();
        let status = self.status.lock().unwrap();
        let is_offline = *status == ConnectionStatus::Offline;

        if *count != new_count {
            *count = new_count;
            return (true, is_offline, new_count);
        }
        (false, is_offline, *count)
    }
}

#[allow(dead_code)]
pub fn update_connection_status<R: Runtime>(app: &AppHandle<R>, success: bool) {
    let state = app.state::<InboxState>();
    let (changed, is_offline, count) = state.update(success);

    if changed {
        update_badge(app, count, is_offline);
        let _ = app.emit("connection-status-changed", is_offline);
    }
}

#[allow(dead_code)]
pub fn start_polling<R: Runtime>(app: &AppHandle<R>) {
    // Placeholder for actual polling logic
    let _app = app.clone();
    std::thread::spawn(move || {
        // loop {
        //     // Poll GitLab
        // }
    });
}

// Helper to update count (will be used by future polling logic)
#[allow(dead_code)]
pub fn update_count<R: Runtime>(app: &AppHandle<R>, new_count: usize) {
    let state = app.state::<InboxState>();
    let (changed, is_offline, count) = state.set_count(new_count);

    if changed {
        update_badge(app, count, is_offline);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_initial_state() {
        let state = InboxState::new();
        let (changed, is_offline, count) = state.update(true);
        assert!(!changed); // Already connected
        assert!(!is_offline);
        assert_eq!(count, 0);
    }

    #[test]
    fn test_failure_threshold() {
        let state = InboxState::new();

        // 1st failure - still connected
        let (changed, is_offline, _) = state.update(false);
        assert!(!changed);
        assert!(!is_offline);

        // 2nd failure - still connected
        let (changed, is_offline, _) = state.update(false);
        assert!(!changed);
        assert!(!is_offline);

        // 3rd failure - goes offline
        let (changed, is_offline, _) = state.update(false);
        assert!(changed);
        assert!(is_offline);

        // 4th failure - stays offline
        let (changed, is_offline, _) = state.update(false);
        assert!(!changed);
        assert!(is_offline);
    }

    #[test]
    fn test_recovery() {
        let state = InboxState::new();

        // Trigger offline
        state.update(false);
        state.update(false);
        state.update(false);

        let (_, is_offline, _) = state.update(false);
        assert!(is_offline);

        // Recovery
        let (changed, is_offline, _) = state.update(true);
        assert!(changed);
        assert!(!is_offline);

        // Check failures reset
        let failures = *state.consecutive_failures.lock().unwrap();
        assert_eq!(failures, 0);
    }
}
