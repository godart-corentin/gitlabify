use crate::modules::window_controls::toggle_window;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Runtime,
};

pub fn create_tray<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<tauri::tray::TrayIcon<R>> {
    let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let show_hide_i = MenuItem::with_id(app, "toggle", "Show/Hide", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show_hide_i, &quit_i])?;

    let mut builder = TrayIconBuilder::with_id("main")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .tooltip("Gitlabify")
        .on_menu_event(|app, event| match event.id().as_ref() {
            "quit" => {
                app.exit(0);
            }
            "toggle" => {
                toggle_window(app);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            // Propagate event to positioner plugin to keep internal state synced
            tauri_plugin_positioner::on_tray_event(tray.app_handle(), &event);

            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Down,
                ..
            } = event
            {
                toggle_window(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }

    builder.build(app)
}
