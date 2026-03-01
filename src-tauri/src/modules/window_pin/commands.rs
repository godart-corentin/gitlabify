use tauri::{AppHandle, Manager, Runtime, State};
use tauri_plugin_positioner::{Position, WindowExt};
use tracing::warn;

use crate::modules::window_controls::try_position_near_tray;

use super::service::apply_pin_state;
use super::state::WindowPinState;

#[tauri::command]
pub(crate) fn set_pinned<R: Runtime>(app: AppHandle<R>, pinned: bool) {
    if let Err(e) = apply_pin_state(&app, pinned) {
        warn!(target: "gitlabify::window_pin", %e, "failed to apply pin state");
    }
}

#[tauri::command]
pub(crate) fn get_pinned(state: State<'_, WindowPinState>) -> bool {
    state.get()
}

/// Moves the window back to the tray-icon position without changing the pin state.
/// Used in floating mode when the user wants to reset to the default location.
#[tauri::command]
pub(crate) fn snap_to_tray<R: Runtime>(app: AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        if !try_position_near_tray(&window) {
            warn!(target: "gitlabify::window_pin", "tray position not set; falling back to center");
            let _ = window.move_window(Position::Center);
        }
    }
}
