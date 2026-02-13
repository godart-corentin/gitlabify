mod modules;

use std::sync::Mutex;

use tauri::{App, AppHandle, Emitter, Listener, Manager, Runtime};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};
use tracing::{error, info, warn};

use modules::auth::{delete_token, get_token, save_token, verify_token};
use modules::inbox::{
    fetch_inbox, get_connection_status, get_inbox, refresh_inbox, start_polling, InboxState,
};
use modules::oauth::{exchange_code_for_token, start_oauth_flow, OAuthState};
use modules::window_controls::toggle_window;

const DEFAULT_SHORTCUT: &str = "CmdOrCtrl+Shift+G";
const MAIN_WINDOW_LABEL: &str = "main";
const OAUTH_CALLBACK_MARKER: &str = "oauth-callback";
const OAUTH_CALLBACK_EVENT: &str = "oauth-callback-received";
const BACKUP_DEEP_LINK_EVENT: &str = "deep-link://new-url";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    init_tracing();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_keyring::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_positioner::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            handle_single_instance(app, &args);
        }))
        .plugin(tauri_plugin_deep_link::init())
        .manage(OAuthState {
            code_verifier: Mutex::new(None),
        })
        .manage(InboxState::new())
        .setup(setup_application)
        .invoke_handler(tauri::generate_handler![
            verify_token,
            save_token,
            get_token,
            delete_token,
            start_oauth_flow,
            exchange_code_for_token,
            get_inbox,
            get_connection_status,
            refresh_inbox,
            fetch_inbox
        ])
        .run(tauri::generate_context!())
        .unwrap_or_else(|run_error| {
            error!(target: "gitlabify::bootstrap", %run_error, "error while running tauri application");
        });
}

fn init_tracing() {
    // Tauri may install a subscriber in app runtime; this keeps a single init point for future wiring.
}

fn setup_application<R: Runtime>(app: &mut App<R>) -> Result<(), Box<dyn std::error::Error>> {
    #[cfg(target_os = "macos")]
    app.set_activation_policy(tauri::ActivationPolicy::Accessory);

    setup_window_auto_hide(app);
    register_deep_link_handlers(app);

    let _tray = modules::tray::create_tray(app.handle())?;

    register_global_shortcut(app);
    start_polling(app.handle());

    Ok(())
}

fn setup_window_auto_hide<R: Runtime>(app: &App<R>) {
    if let Some(main_window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
        let window_clone = main_window.clone();
        main_window.on_window_event(move |event| {
            if let tauri::WindowEvent::Focused(focused) = event {
                if !focused {
                    let _ = window_clone.hide();
                }
            }
        });
        return;
    }

    warn!(target: "gitlabify::bootstrap", "main window not found during setup");
}

fn handle_single_instance<R: Runtime>(app: &AppHandle<R>, args: &[String]) {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
        let _ = window.set_focus();
    }

    for arg in args {
        emit_oauth_callback_if_present(app, arg);
    }
}

fn register_deep_link_handlers<R: Runtime>(app: &App<R>) {
    use tauri_plugin_deep_link::DeepLinkExt;

    match app.deep_link().register_all() {
        Ok(_) => info!(target: "gitlabify::bootstrap", "deep link registered successfully"),
        Err(error) => {
            #[cfg(target_os = "macos")]
            info!(target: "gitlabify::bootstrap", %error, "deep link registration skipped on macOS");
            #[cfg(not(target_os = "macos"))]
            warn!(target: "gitlabify::bootstrap", %error, "deep link registration failed");
        }
    }

    let handle = app.handle().clone();
    app.deep_link().on_open_url(move |event| {
        let urls = event.urls();
        for url in urls {
            emit_oauth_callback_if_present(&handle, url.as_ref());
        }
    });

    let backup_handle = app.handle().clone();
    app.listen(BACKUP_DEEP_LINK_EVENT, move |event| {
        let payload = event.payload();
        emit_oauth_callback_if_present(&backup_handle, payload);
    });
}

fn emit_oauth_callback_if_present<R: Runtime>(app: &AppHandle<R>, payload: &str) {
    if !payload.contains(OAUTH_CALLBACK_MARKER) {
        return;
    }

    if let Err(error) = app.emit(OAUTH_CALLBACK_EVENT, payload) {
        warn!(target: "gitlabify::bootstrap", %error, "failed to emit oauth callback event");
    }
}

fn register_global_shortcut<R: Runtime>(app: &App<R>) {
    match DEFAULT_SHORTCUT.parse::<Shortcut>() {
        Ok(shortcut) => {
            if let Err(error) =
                app.global_shortcut()
                    .on_shortcut(shortcut, move |app, _shortcut, event| {
                        if event.state() == ShortcutState::Pressed {
                            toggle_window(app);
                        }
                    })
            {
                warn!(target: "gitlabify::bootstrap", %error, "failed to register global shortcut");
            }
        }
        Err(error) => {
            warn!(target: "gitlabify::bootstrap", %error, "failed to parse global shortcut");
        }
    }
}
