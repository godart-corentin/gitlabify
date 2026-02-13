use tauri::AppHandle;

use super::error::AuthError;
use super::model::User;
use super::service::{
    delete_token_internal, get_token_internal, save_token_internal, verify_token_internal,
};

#[tauri::command]
pub(crate) async fn verify_token<R: tauri::Runtime>(
    app: AppHandle<R>,
    token: String,
) -> Result<User, AuthError> {
    verify_token_internal(&app, &token).await
}

#[tauri::command]
pub(crate) async fn save_token<R: tauri::Runtime>(
    app: AppHandle<R>,
    token: String,
) -> Result<(), AuthError> {
    save_token_internal(&app, &token).await
}

#[tauri::command]
pub(crate) async fn get_token<R: tauri::Runtime>(
    app: AppHandle<R>,
) -> Result<Option<String>, AuthError> {
    get_token_internal(&app)
}

#[tauri::command]
pub(crate) async fn delete_token<R: tauri::Runtime>(app: AppHandle<R>) -> Result<(), AuthError> {
    delete_token_internal(&app)
}
