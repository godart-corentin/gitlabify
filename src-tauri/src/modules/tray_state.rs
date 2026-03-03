use std::sync::Mutex;

use crate::modules::utils::lock_or_recover;

/// Physical position and size of the tray icon, plus the cursor position at
/// the time of the last tray interaction. All values are in the tray-icon
/// coordinate space (physical pixels, primary-monitor scale, top-left origin,
/// y downward). Updated on every tray icon event that carries a rect.
#[derive(Clone, Copy, Default)]
pub(crate) struct TrayIconRect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    /// Physical cursor position at the time of the last tray event.
    /// Used to identify which monitor the tray icon is on at positioning time.
    pub cursor_x: f64,
    pub cursor_y: f64,
}

#[derive(Default)]
pub(crate) struct TrayIconState {
    inner: Mutex<Option<TrayIconRect>>,
}

impl TrayIconState {
    pub(crate) fn new() -> Self {
        Self::default()
    }

    pub(crate) fn update(&self, rect: TrayIconRect) {
        *lock_or_recover(&self.inner, "TrayIconState") = Some(rect);
    }

    pub(crate) fn get(&self) -> Option<TrayIconRect> {
        *lock_or_recover(&self.inner, "TrayIconState")
    }
}
