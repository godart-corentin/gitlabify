mod modules;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

use std::sync::Mutex;
use tauri::{Emitter, Listener, Manager};

use modules::auth::{delete_token, get_token, save_token, verify_token};
use modules::inbox::InboxState;
use modules::oauth::{exchange_code_for_token, start_oauth_flow, OAuthState};
use modules::window_controls::toggle_window;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};

const DEFAULT_SHORTCUT: &str = "CmdOrCtrl+Shift+G";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_keyring::init())
        .plugin(tauri_plugin_positioner::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }

            // Handle deep link via command line args (for when OS spawns a new instance)
            println!("Single Instance: Received args: {:?}", args);
            for arg in args {
                if arg.contains("oauth-callback") {
                    println!("Single Instance: Found OAuth callback in args! Emitting event.");
                    let _ = app.emit("oauth-callback-received", arg);
                }
            }
        }))
        .plugin(tauri_plugin_deep_link::init())
        .manage(OAuthState {
            code_verifier: Mutex::new(None),
        })
        .manage(InboxState::new())
        .setup(|app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            // Setup auto-hide on focus lost
            // Setup auto-hide on focus lost
            if let Some(main_window) = app.get_webview_window("main") {
                let window_clone = main_window.clone();
                main_window.on_window_event(move |event| {
                    if let tauri::WindowEvent::Focused(focused) = event {
                        if !focused {
                            let _ = window_clone.hide();
                        }
                    }
                });
            } else {
                eprintln!("Error: main window not found during setup");
            }

            // Register deep link for all platforms
            use tauri_plugin_deep_link::DeepLinkExt;
            match app.deep_link().register_all() {
                Ok(_) => println!("Deep link registered successfully"),
                Err(e) => {
                    #[cfg(target_os = "macos")]
                    println!("Deep link registration info: macOS uses Info.plist, explicit registration skipped. ({})", e);
                    #[cfg(not(target_os = "macos"))]
                    println!("Deep link registration failed: {}", e);
                }
            }

            // Initialize System Tray
            let _tray = modules::tray::create_tray(app.handle())?;

            let handle = app.handle().clone();

            // Standard Deep Link capturing for Tauri v2
            app.deep_link().on_open_url(move |event| {
                let urls = event.urls();
                println!("Deep link caught by on_open_url! URLs: {:?}", urls);
                for url in urls {
                    let url_str = url.to_string();
                    if url_str.contains("oauth-callback") {
                        println!("Match found! Emitting oauth-callback-received");
                        if let Err(e) = handle.emit("oauth-callback-received", &url_str) {
                            println!("Failed to emit event: {}", e);
                        } else {
                            println!("Event emitted successfully");
                        }
                    } else {
                        println!("URL does not contain 'oauth-callback': {}", url_str);
                    }
                }
            });

            // Backup listener for deep-link://new-url event
            let handle_backup = app.handle().clone();
            app.listen("deep-link://new-url", move |event| {
                let payload = event.payload();
                println!("Backup deep-link event received! Payload: {}", payload);
                if payload.contains("oauth-callback") {
                    let _ = handle_backup.emit("oauth-callback-received", payload);
                }
            });

            // Register Global Shortcut
            match DEFAULT_SHORTCUT.parse::<Shortcut>() {
                Ok(shortcut) => {
                    if let Err(e) = app.global_shortcut().on_shortcut(shortcut, move |app, _shortcut, event| {
                        if event.state() == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                            toggle_window(app);
                        }
                    }) {
                        eprintln!("Failed to register global shortcut: {}", e);
                    }
                }
                Err(e) => {
                    eprintln!("Failed to parse global shortcut: {}", e);
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            verify_token,
            save_token,
            get_token,
            delete_token,
            start_oauth_flow,
            exchange_code_for_token
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
