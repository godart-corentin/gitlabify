use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_store::StoreExt;
use tracing::warn;

use crate::modules::constants::{
    WINDOW_PIN_KEY, WINDOW_PREFERENCES_FILE_NAME, WINDOW_PREFERENCES_SCHEMA_VERSION,
    WINDOW_PREFERENCES_SCHEMA_VERSION_KEY,
};

use super::error::WindowPinError;
use super::state::WindowPinState;

/// Reads the persisted pin state from the store at startup.
///
/// If the store is absent, unreadable, or was written by a different schema version
/// (e.g. a previous build where the semantics of `is_pinned` were different), the
/// stale data is discarded and the default `true` (tray-popup mode) is returned.
pub(crate) fn load_pin_state<R: Runtime>(app: &AppHandle<R>) -> bool {
    let store = if let Some(s) = app.get_store(WINDOW_PREFERENCES_FILE_NAME) {
        s
    } else {
        match app.store_builder(WINDOW_PREFERENCES_FILE_NAME).build() {
            Ok(s) => s,
            Err(error) => {
                warn!(target: "gitlabify::window_pin", %error, "failed to open window preferences store");
                return true;
            }
        }
    };

    let stored_schema: Option<u32> = store
        .get(WINDOW_PREFERENCES_SCHEMA_VERSION_KEY)
        .and_then(|v| serde_json::from_value(v).ok());

    if stored_schema != Some(WINDOW_PREFERENCES_SCHEMA_VERSION) {
        // Schema mismatch: discard stale data and reset to defaults so that any
        // previously stored value with different semantics is never misinterpreted.
        warn!(
            target: "gitlabify::window_pin",
            stored_schema = ?stored_schema,
            expected_schema = WINDOW_PREFERENCES_SCHEMA_VERSION,
            "window preferences schema mismatch — resetting to defaults"
        );
        store.delete(WINDOW_PIN_KEY);
        store.set(
            WINDOW_PREFERENCES_SCHEMA_VERSION_KEY,
            serde_json::json!(WINDOW_PREFERENCES_SCHEMA_VERSION),
        );
        if let Err(e) = store.save() {
            warn!(target: "gitlabify::window_pin", %e, "failed to persist schema version reset");
        }
        return true;
    }

    store
        .get(WINDOW_PIN_KEY)
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or(true)
}

/// Updates the pin state in memory, applies always-on-top to the window, and persists.
pub(crate) fn apply_pin_state<R: Runtime>(
    app: &AppHandle<R>,
    pinned: bool,
) -> Result<(), WindowPinError> {
    if let Some(state) = app.try_state::<WindowPinState>() {
        state.set(pinned);
    }

    // Floating mode (unpinned) uses always-on-top so the window stays visible above other apps.
    // Tray-popup mode (pinned) is a normal window that hides on blur.
    if let Some(window) = app.get_webview_window("main") {
        window
            .set_always_on_top(!pinned)
            .map_err(|e| WindowPinError::AlwaysOnTopFailed(e.to_string()))?;
    }

    let store = if let Some(s) = app.get_store(WINDOW_PREFERENCES_FILE_NAME) {
        s
    } else {
        app.store_builder(WINDOW_PREFERENCES_FILE_NAME)
            .build()
            .map_err(|_| WindowPinError::StoreUnavailable)?
    };

    store.set(WINDOW_PIN_KEY, serde_json::json!(pinned));
    store.set(
        WINDOW_PREFERENCES_SCHEMA_VERSION_KEY,
        serde_json::json!(WINDOW_PREFERENCES_SCHEMA_VERSION),
    );
    store
        .save()
        .map_err(|e| WindowPinError::PersistFailed(e.to_string()))?;

    Ok(())
}
