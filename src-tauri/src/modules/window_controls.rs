use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_positioner::{Position, WindowExt};

pub fn toggle_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let is_visible = window.is_visible().unwrap_or(false);

        if is_visible {
            let _ = window.hide();
        } else {
            // Priority 1: Use positioner plugin's TrayCenter/TrayBottomRight
            // This is the cleanest centered-on-tray-icon behavior.
            #[cfg(target_os = "macos")]
            let tray_pos = Position::TrayCenter;
            #[cfg(not(target_os = "macos"))]
            let tray_pos = Position::TrayBottomRight;

            // Attempt to move. If it fails (e.g. tray position still unknown to plugin),
            // we fall back to screen center to avoid any potential panic or unexpected location.
            if window.move_window(tray_pos).is_err() {
                eprintln!("Tray position not set in plugin, falling back to Center");
                let _ = window.move_window(Position::Center);
            }

            if let Err(e) = window.show() {
                eprintln!("failed to show window: {}", e);
            }

            if let Err(e) = window.set_focus() {
                eprintln!("failed to focus window: {}", e);
            }
        }
    }
}
