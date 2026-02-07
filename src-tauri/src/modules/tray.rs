use crate::modules::window_controls::toggle_window;
use image::{GenericImage, GenericImageView, Rgba};
use std::sync::OnceLock;
use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Runtime,
};

const TRAY_ICON_BYTES: &[u8] = include_bytes!("../../icons/tray-icon.png");
const TRAY_BADGE_RADIUS_DIVISOR_PX: u32 = 4;
const TRAY_BADGE_ALPHA_U8: u8 = 255;
const TRAY_BADGE_COLOR_ERROR: Rgba<u8> = Rgba([227, 60, 40, TRAY_BADGE_ALPHA_U8]);
const TRAY_BADGE_COLOR_INFO: Rgba<u8> = Rgba([252, 109, 38, TRAY_BADGE_ALPHA_U8]);
const TRAY_FALLBACK_IMAGE_SIZE_PX: u32 = 1;

static BASE_IMAGE: OnceLock<image::DynamicImage> = OnceLock::new();

pub(crate) enum TrayStatus {
    Idle,
    #[allow(dead_code)]
    Info,
    #[allow(dead_code)]
    Error,
}

#[allow(dead_code)]
fn generate_tray_icon(status: TrayStatus) -> Option<Image<'static>> {
    let base_img = BASE_IMAGE.get_or_init(|| {
        match image::load_from_memory(TRAY_ICON_BYTES) {
            Ok(image) => image,
            Err(err) => {
                eprintln!("Failed to load tray icon bytes: {}", err);
                image::DynamicImage::new_rgba8(TRAY_FALLBACK_IMAGE_SIZE_PX, TRAY_FALLBACK_IMAGE_SIZE_PX)
            }
        }
    });

    let mut img = base_img.clone();

    match status {
        TrayStatus::Idle => {} // Return clean logo
        TrayStatus::Info | TrayStatus::Error => {
            let (width, height) = img.dimensions();
            let radius = width / TRAY_BADGE_RADIUS_DIVISOR_PX;
            let cx = width - radius; // Max Right
            let cy = height - radius; // Max Bottom

            let color = if let TrayStatus::Error = status {
                TRAY_BADGE_COLOR_ERROR // GitLab Red #E33C28
            } else {
                TRAY_BADGE_COLOR_INFO // GitLab Orange #FC6D26
            };

            // Draw Circle
            for x in 0..width {
                for y in 0..height {
                    let dx = x as i32 - cx as i32;
                    let dy = y as i32 - cy as i32;
                    if dx * dx + dy * dy <= (radius as i32 * radius as i32) {
                        img.put_pixel(x, y, color);
                    }
                }
            }
        }
    }

    let rgba = img.to_rgba8();
    let width = rgba.width();
    let height = rgba.height();
    let raw = rgba.into_raw();

    Some(Image::new_owned(raw, width, height))
}

#[allow(dead_code)]
pub(crate) fn update_badge<R: Runtime>(app: &AppHandle<R>, count: usize, has_failure: bool) {
    if let Some(tray) = app.tray_by_id("main") {
        if let Err(e) = tray.set_tooltip(Some(format_tooltip(has_failure))) {
            eprintln!("Failed to set tray tooltip: {}", e);
        }

        let status = if has_failure {
            TrayStatus::Error
        } else if count > 0 {
            TrayStatus::Info
        } else {
            TrayStatus::Idle
        };

        if let Some(icon) = generate_tray_icon(status) {
            if let Err(e) = tray.set_icon(Some(icon)) {
                eprintln!("Failed to set tray icon: {}", e);
            }
        }

        #[cfg(target_os = "macos")]
        {
            let _ = tray.set_title(None::<&str>);
        }
    }
}

pub(crate) fn create_tray<R: Runtime>(
    app: &AppHandle<R>,
) -> tauri::Result<tauri::tray::TrayIcon<R>> {
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

    if let Some(icon) = generate_tray_icon(TrayStatus::Idle) {
        builder = builder.icon(icon);
    }

    builder.build(app)
}

#[allow(dead_code)]
pub(crate) fn format_tooltip(is_offline: bool) -> String {
    if is_offline {
        "Gitlabify (Offline)".to_string()
    } else {
        "Gitlabify".to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_format_tooltip() {
        assert_eq!(format_tooltip(false), "Gitlabify");
        assert_eq!(format_tooltip(true), "Gitlabify (Offline)");
    }
}
