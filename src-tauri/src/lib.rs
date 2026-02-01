mod modules;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

use modules::settings::{clear_gitlab_host, get_gitlab_host, set_gitlab_host};
use modules::auth::{verify_token, save_token, get_token, delete_token};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_keyring::init())
        .invoke_handler(tauri::generate_handler![
            get_gitlab_host,
            set_gitlab_host,
            clear_gitlab_host,
            verify_token,
            save_token,
            get_token,
            delete_token
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
