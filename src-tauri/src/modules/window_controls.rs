use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_positioner::{Position, WindowExt};
use tracing::warn;

use crate::modules::window_pin::WindowPinState;

pub(crate) fn toggle_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let is_visible = window.is_visible().unwrap_or(false);

        if is_visible {
            let _ = window.hide();
            return;
        }

        // In tray-popup mode (pinned), snap to the tray icon position.
        // In floating mode (unpinned), the user has placed the window where they want it.
        let is_pinned = app
            .try_state::<WindowPinState>()
            .map(|s| s.get())
            .unwrap_or(true);

        if is_pinned && !try_position_near_tray(&window) {
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

/// Position the window near the tray icon.
///
/// On macOS, uses the positioner plugin's `TrayCenter` which works correctly.
/// On Windows, manually calculates the position using the work area so the
/// window sits flush against the taskbar with no gap.
pub(crate) fn try_position_near_tray<R: Runtime>(window: &tauri::WebviewWindow<R>) -> bool {
    #[cfg(target_os = "macos")]
    {
        window.move_window(Position::TrayCenter).is_ok()
    }

    #[cfg(target_os = "windows")]
    {
        position_near_tray_windows(window)
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        window.move_window(Position::TrayCenter).is_ok()
    }
}

#[cfg(target_os = "windows")]
fn position_near_tray_windows<R: Runtime>(window: &tauri::WebviewWindow<R>) -> bool {
    use tauri::PhysicalPosition;

    // First, use TrayCenter to position roughly (this also validates tray state)
    if window.move_window(Position::TrayCenter).is_err() {
        return false;
    }

    // Get the current window position (set by TrayCenter) and size
    let win_pos = match window.outer_position() {
        Ok(pos) => pos,
        Err(_) => return true, // TrayCenter succeeded, keep that position
    };
    let win_size = match window.outer_size() {
        Ok(size) => size,
        Err(_) => return true,
    };

    // Get the work area (desktop area excluding taskbar) from Windows API
    if let Some(work_area_bottom) = get_work_area_bottom() {
        let y = work_area_bottom - win_size.height as i32;
        let _ = window.set_position(PhysicalPosition::new(win_pos.x, y));
    }

    true
}

/// Get the bottom Y coordinate of the primary work area (excludes the taskbar).
#[cfg(target_os = "windows")]
fn get_work_area_bottom() -> Option<i32> {
    use std::mem;

    #[repr(C)]
    struct Rect {
        left: i32,
        top: i32,
        right: i32,
        bottom: i32,
    }

    extern "system" {
        fn SystemParametersInfoW(
            ui_action: u32,
            ui_param: u32,
            pv_param: *mut std::ffi::c_void,
            f_win_ini: u32,
        ) -> i32;
    }

    const SPI_GETWORKAREA: u32 = 0x0030;

    let mut rect: Rect = unsafe { mem::zeroed() };
    let success = unsafe { SystemParametersInfoW(SPI_GETWORKAREA, 0, &mut rect as *mut _ as _, 0) };

    if success != 0 {
        Some(rect.bottom)
    } else {
        None
    }
}
