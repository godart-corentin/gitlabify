mod modules;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

use modules::settings::{clear_gitlab_host, get_gitlab_host, set_gitlab_host};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_keychain::init())
        .invoke_handler(tauri::generate_handler![
            get_gitlab_host,
            set_gitlab_host,
            clear_gitlab_host
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
