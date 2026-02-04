use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, Runtime,
};
use tauri_plugin_positioner::{Position, WindowExt};

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
                if let Some(window) = app.get_webview_window("main") {
                    if window.is_visible().unwrap_or(false) {
                        if let Err(e) = window.hide() {
                            eprintln!("failed to hide window: {}", e);
                        }
                    } else {
                        // Move window to tray position before showing
                        if let Err(e) = window.move_window(Position::TopRight) {
                             eprintln!("failed to move window: {}", e);
                        }
                        if let Err(e) = window.show() {
                             eprintln!("failed to show window: {}", e);
                        }
                        if let Err(e) = window.set_focus() {
                             eprintln!("failed to focus window: {}", e);
                        }
                    };
                }
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| match event {
            TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Down,
                rect,
                ..
            } => {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    // Check if already visible and focused
                    if window.is_visible().unwrap_or(false) {
                         let _ = window.hide();
                    } else {
                        // Move window to tray position before showing
                        let mut positioned = false;
                        // rect is available directly from the event
                         if let Ok(size) = window.outer_size() {
                            let win_width = size.width as f64;
                            
                            let (tray_x, tray_y) = match rect.position {
                                tauri::Position::Physical(p) => (p.x as f64, p.y as f64),
                                tauri::Position::Logical(l) => (l.x, l.y),
                            };
                            
                            let (tray_width, tray_height) = match rect.size {
                                tauri::Size::Physical(s) => (s.width as f64, s.height as f64),
                                tauri::Size::Logical(s) => (s.width, s.height),
                            };
                            
                            let x = tray_x + (tray_width / 2.0) - (win_width / 2.0);
                            let y = tray_y + tray_height;
                            
                            if let Err(e) = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
                                x: x as i32,
                                y: y as i32
                            })) {
                                eprintln!("failed to set window position: {}", e);
                            } else {
                                positioned = true;
                            }
                         }
                        
                        if !positioned {
                            let _ = window.move_window(Position::TopRight);
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
            _ => {}
        });

    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }

    builder.build(app)
}
