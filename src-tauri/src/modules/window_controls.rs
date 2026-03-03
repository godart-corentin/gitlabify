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
/// On macOS, uses a custom implementation that works correctly in multi-monitor
/// setups by computing the position in logical coordinates using the tray
/// monitor's scale factor. The positioner plugin's `TrayCenter` fails on
/// multi-monitor macOS due to a scale-factor mismatch.
/// On Windows, uses the same approach with physical coordinates, querying the
/// work area of the tray's monitor so the window sits flush against the taskbar.
pub(crate) fn try_position_near_tray<R: Runtime>(window: &tauri::WebviewWindow<R>) -> bool {
    #[cfg(target_os = "macos")]
    {
        position_near_tray_macos(window)
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

/// Returns the scale factor of the monitor that contains the tray icon, using
/// the physical cursor position recorded at the last tray interaction.
///
/// `cursor_position()` and tray-icon coordinates both use "primary-monitor-scale
/// physical space" (CGDisplay logical × primary scale). tao's `available_monitors()`
/// reports each monitor's bounds in *its own* scale, which is only consistent
/// with the cursor space for the primary (main) display. When multiple monitors
/// match — possible due to mixed-DPI bounds overlap — the monitor at CGDisplay
/// origin (0, 0) is preferred, since that is always the main display (the one
/// with the menu bar and tray icon).
#[cfg(target_os = "macos")]
fn find_tray_monitor_scale<R: Runtime>(
    window: &tauri::WebviewWindow<R>,
    cursor_x: f64,
    cursor_y: f64,
) -> Option<f64> {
    let monitors = window.available_monitors().ok()?;

    let candidates: Vec<_> = monitors
        .into_iter()
        .filter(|m| {
            let pos = m.position();
            let size = m.size();
            cursor_x >= pos.x as f64
                && cursor_x < pos.x as f64 + size.width as f64
                && cursor_y >= pos.y as f64
                && cursor_y < pos.y as f64 + size.height as f64
        })
        .collect();

    // The tray always lives on the CGDisplay main display, whose origin is
    // always (0, 0). Prefer it when multiple monitors' bounds overlap.
    candidates
        .iter()
        .find(|m| {
            let p = m.position();
            p.x == 0 && p.y == 0
        })
        .or_else(|| candidates.first())
        .map(|m| m.scale_factor())
}

/// Positions the window below the tray icon on macOS using logical coordinates
/// to avoid scale-factor mismatches in multi-monitor setups.
///
/// `tauri_plugin_positioner::TrayCenter` fails on multi-monitor macOS because it
/// computes the centering offset from `outer_size()` (physical pixels on the
/// window's current monitor) while the stored tray position is in global physical
/// pixels. With mixed DPI monitors the two coordinate spaces diverge and the
/// window lands far from the tray icon.
///
/// This implementation converts everything to logical units using the tray
/// monitor's scale factor before computing the target position, then sets the
/// position with `LogicalPosition` — which Tauri maps to the OS coordinate
/// system without any further scale conversion.
///
/// On macOS the system tray is always on the primary display (the one with the
/// menu bar), so `primary_monitor()` reliably gives the correct scale factor
/// without requiring coordinate-space conversion to find the monitor.
#[cfg(target_os = "macos")]
fn position_near_tray_macos<R: Runtime>(window: &tauri::WebviewWindow<R>) -> bool {
    use tauri::LogicalPosition;

    // Retrieve the stored tray rect (physical pixels, tray-icon coordinate space).
    use crate::modules::tray_state::TrayIconState;

    let tray_rect = match window.app_handle().try_state::<TrayIconState>() {
        Some(s) => match s.get() {
            Some(r) => r,
            None => {
                warn!(target: "gitlabify::window", "tray state empty; falling back to center");
                return window.move_window(Position::Center).is_ok();
            }
        },
        None => return false,
    };

    // Identify the tray monitor by finding which available monitor contains the
    // cursor position that was recorded when the user last interacted with the
    // tray icon. This avoids relying on `primary_monitor()`, which can return
    // the wrong scale factor when the user has moved the menu bar to a display
    // that macOS does not consider the primary.
    let tray_scale = match find_tray_monitor_scale(window, tray_rect.cursor_x, tray_rect.cursor_y) {
        Some(s) => s,
        None => {
            warn!(target: "gitlabify::window", "could not determine tray monitor; falling back to center");
            return window.move_window(Position::Center).is_ok();
        }
    };

    // Convert tray rect from physical to logical using the tray monitor's scale.
    let tray_logical_x = tray_rect.x / tray_scale;
    let tray_logical_width = tray_rect.width / tray_scale;
    let tray_logical_y = tray_rect.y / tray_scale;
    let tray_logical_height = tray_rect.height / tray_scale;

    // Get the window's logical width (outer_size is physical; divide by current scale).
    let window_scale = match window.scale_factor() {
        Ok(s) => s,
        Err(_) => return false,
    };
    let phys_width = match window.outer_size() {
        Ok(s) => s.width as f64,
        Err(_) => return false,
    };
    let logical_window_width = phys_width / window_scale;

    // Center the window horizontally under the tray icon.
    let x = tray_logical_x + tray_logical_width / 2.0 - logical_window_width / 2.0;

    // Place the window's top edge at the bottom of the tray icon (below the menu bar).
    let y = tray_logical_y + tray_logical_height;

    window.set_position(LogicalPosition::new(x, y)).is_ok()
}

/// Positions the window below the tray icon on Windows using physical coordinates.
///
/// `tauri_plugin_positioner::TrayCenter` panics unconditionally when its internal
/// tray state is `None`, so it is avoided entirely. Windows uses a consistent
/// physical-pixel virtual-desktop coordinate space across monitors, so no
/// logical-coordinate conversion is needed — unlike macOS.
///
/// The work area (desktop minus taskbar) is queried for the monitor that contains
/// the tray icon, not the primary monitor, so the window flushes against the
/// taskbar even when it lives on a secondary display.
#[cfg(target_os = "windows")]
fn position_near_tray_windows<R: Runtime>(window: &tauri::WebviewWindow<R>) -> bool {
    use crate::modules::tray_state::TrayIconState;
    use tauri::PhysicalPosition;

    // Retrieve the stored tray rect (physical pixels, Windows virtual-desktop space).
    let tray_rect = match window.app_handle().try_state::<TrayIconState>() {
        Some(s) => match s.get() {
            Some(r) => r,
            None => {
                warn!(target: "gitlabify::window", "tray state empty; falling back to center");
                return window.move_window(Position::Center).is_ok();
            }
        },
        None => return false,
    };

    let win_size = match window.outer_size() {
        Ok(s) => s,
        Err(_) => return false,
    };

    // Center the window horizontally under the tray icon (physical pixels throughout).
    let x = tray_rect.x as i32 + tray_rect.width as i32 / 2 - win_size.width as i32 / 2;

    // Place flush against the taskbar on the monitor that contains the tray icon.
    let y = match get_work_area_bottom_near(tray_rect.cursor_x as i32, tray_rect.cursor_y as i32) {
        Some(bottom) => bottom - win_size.height as i32,
        None => {
            warn!(target: "gitlabify::window", "could not determine work area; falling back to center");
            return window.move_window(Position::Center).is_ok();
        }
    };

    window.set_position(PhysicalPosition::new(x, y)).is_ok()
}

/// Returns the bottom Y coordinate of the work area (desktop minus taskbar) on
/// the monitor nearest to (x, y). Uses `MonitorFromPoint` + `GetMonitorInfo`
/// rather than `SPI_GETWORKAREA`, which only covers the primary monitor.
#[cfg(target_os = "windows")]
fn get_work_area_bottom_near(x: i32, y: i32) -> Option<i32> {
    use std::mem;

    #[repr(C)]
    struct Point {
        x: i32,
        y: i32,
    }

    #[repr(C)]
    struct Rect {
        left: i32,
        top: i32,
        right: i32,
        bottom: i32,
    }

    #[repr(C)]
    struct MonitorInfo {
        cb_size: u32,
        rc_monitor: Rect,
        rc_work: Rect,
        dw_flags: u32,
    }

    extern "system" {
        fn MonitorFromPoint(pt: Point, dw_flags: u32) -> *mut std::ffi::c_void;
        fn GetMonitorInfoW(h_monitor: *mut std::ffi::c_void, lp_mi: *mut MonitorInfo) -> i32;
    }

    const MONITOR_DEFAULTTONEAREST: u32 = 0x0000_0002;

    let monitor = unsafe { MonitorFromPoint(Point { x, y }, MONITOR_DEFAULTTONEAREST) };
    if monitor.is_null() {
        return None;
    }

    let mut info: MonitorInfo = unsafe { mem::zeroed() };
    info.cb_size = mem::size_of::<MonitorInfo>() as u32;

    let ok = unsafe { GetMonitorInfoW(monitor, &mut info) };
    if ok != 0 {
        Some(info.rc_work.bottom)
    } else {
        None
    }
}
