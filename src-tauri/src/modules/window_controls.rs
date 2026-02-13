use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_positioner::{Position, WindowExt};
use tracing::warn;

pub(crate) fn toggle_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let is_visible = window.is_visible().unwrap_or(false);

        if is_visible {
            let _ = window.hide();
            return;
        }

        #[cfg(target_os = "macos")]
        let tray_pos = Position::TrayCenter;
        #[cfg(not(target_os = "macos"))]
        let tray_pos = Position::TrayBottomRight;

        if window.move_window(tray_pos).is_err() {
            warn!(target: "gitlabify::window", "tray position not set; falling back to center");
            let _ = window.move_window(Position::Center);
        }

        if let Err(error) = window.show() {
            warn!(target: "gitlabify::window", %error, "failed to show window");
        }

        if let Err(error) = window.set_focus() {
            warn!(target: "gitlabify::window", %error, "failed to focus window");
        }
    }
}
