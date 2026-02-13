use tauri::{AppHandle, State};

use crate::modules::auth::User;

use super::service::{exchange_code_for_token_impl, start_oauth_flow_impl, OAuthState};

#[tauri::command]
pub(crate) async fn start_oauth_flow(
    app: AppHandle,
    state: State<'_, OAuthState>,
) -> Result<String, String> {
    start_oauth_flow_impl(app, state)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub(crate) async fn exchange_code_for_token(app: AppHandle, code: String) -> Result<User, String> {
    exchange_code_for_token_impl(app, code)
        .await
        .map_err(|error| error.to_string())
}
