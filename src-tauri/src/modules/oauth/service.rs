use std::sync::Mutex;

use tauri::{AppHandle, Manager, Runtime, State};
use tauri_plugin_keyring::KeyringExt;
use tauri_plugin_opener::OpenerExt;
use tracing::{debug, warn};

use crate::modules::auth::{save_token_internal, verify_token_internal, User};
use crate::modules::constants::{
    GITLAB_HOST, OAUTH_REFRESH_TOKEN_KEY, OAUTH_VERIFIER_LENGTH, SERVICE_NAME,
};
use crate::modules::utils::lock_or_recover;

use super::error::OAuthError;
use super::pkce::{generate_challenge, generate_verifier};

pub(crate) struct OAuthState {
    pub(crate) code_verifier: Mutex<Option<String>>,
}

#[derive(Debug, serde::Deserialize)]
pub(crate) struct OAuthTokenResponse {
    pub(crate) access_token: String,
    #[serde(default)]
    pub(crate) refresh_token: Option<String>,
}

pub(crate) async fn start_oauth_flow_impl(
    app: AppHandle,
    state: State<'_, OAuthState>,
) -> Result<String, OAuthError> {
    let verifier = generate_verifier(OAUTH_VERIFIER_LENGTH);
    let challenge = generate_challenge(&verifier);

    {
        let mut verifier_state = lock_or_recover(&state.code_verifier, "OAuthState code_verifier");
        *verifier_state = Some(verifier);
    }

    let client_id = env!("GITLAB_CLIENT_ID");
    let redirect_uri = "gitlabify://oauth-callback";
    let auth_url = format!(
        "{GITLAB_HOST}/oauth/authorize?client_id={client_id}&redirect_uri={}&response_type=code&scope=api+read_user&code_challenge={challenge}&code_challenge_method=S256",
        urlencoding::encode(redirect_uri),
    );

    app.opener()
        .open_url(auth_url, None::<&str>)
        .map_err(|_| OAuthError::OpenBrowser)?;

    Ok("OAuth flow started".to_string())
}

pub(crate) async fn exchange_code_for_token_impl(
    app: AppHandle,
    code: String,
) -> Result<User, OAuthError> {
    let verifier = {
        let state = app.state::<OAuthState>();
        let mut verifier_state = lock_or_recover(&state.code_verifier, "OAuthState code_verifier");
        verifier_state.take().ok_or(OAuthError::MissingVerifier)?
    };

    let client_id = env!("GITLAB_CLIENT_ID");
    let redirect_uri = "gitlabify://oauth-callback";
    let token_url = format!("{GITLAB_HOST}/oauth/token");

    let params = [
        ("client_id", client_id),
        ("client_secret", ""),
        ("code", &code),
        ("grant_type", "authorization_code"),
        ("redirect_uri", redirect_uri),
        ("code_verifier", &verifier),
    ];

    let client = reqwest::Client::new();
    let response = client
        .post(&token_url)
        .form(&params)
        .send()
        .await
        .map_err(|error| OAuthError::TokenExchangeRequest(error.to_string()))?;

    if !response.status().is_success() {
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown error".to_string());
        return Err(OAuthError::TokenExchangeFailed(error_text));
    }

    let token_response: OAuthTokenResponse = response
        .json()
        .await
        .map_err(|error| OAuthError::TokenParse(error.to_string()))?;

    let user = verify_token_internal(&app, &token_response.access_token)
        .await
        .map_err(|error| OAuthError::TokenVerification(error.to_string()))?;

    save_token_internal(&app, &token_response.access_token)
        .await
        .map_err(|error| OAuthError::SaveToken(error.to_string()))?;

    store_refresh_token(&app, token_response.refresh_token.as_deref())
        .map_err(|error| OAuthError::SaveRefreshToken(error.to_string()))?;

    debug!(target: "gitlabify::oauth", username = %user.username, "oauth exchange succeeded");
    Ok(user)
}

pub(crate) fn store_refresh_token<R: Runtime>(
    app: &AppHandle<R>,
    refresh_token: Option<&str>,
) -> Result<(), OAuthError> {
    match refresh_token {
        Some(token) => app
            .keyring()
            .set_password(SERVICE_NAME, OAUTH_REFRESH_TOKEN_KEY, token)
            .map_err(|error| OAuthError::PersistRefreshToken(error.to_string())),
        None => delete_refresh_token(app),
    }
}

pub(crate) fn is_keyring_entry_missing(error_message: &str) -> bool {
    let lower = error_message.to_lowercase();
    lower.contains("not found")
        || lower.contains("no entry")
        || lower.contains("does not exist")
        || lower.contains("item could not be found")
        || lower.contains("cannot find the item")
}

pub(crate) fn delete_refresh_token<R: Runtime>(app: &AppHandle<R>) -> Result<(), OAuthError> {
    match app
        .keyring()
        .delete_password(SERVICE_NAME, OAUTH_REFRESH_TOKEN_KEY)
    {
        Ok(_) => Ok(()),
        Err(error) if is_keyring_entry_missing(&error.to_string()) => Ok(()),
        Err(error) => Err(OAuthError::DeleteRefreshToken(error.to_string())),
    }
}

pub(crate) async fn refresh_access_token(
    refresh_token: &str,
) -> Result<OAuthTokenResponse, OAuthError> {
    let client_id = env!("GITLAB_CLIENT_ID");
    let token_url = format!("{GITLAB_HOST}/oauth/token");

    let params = [
        ("client_id", client_id),
        ("client_secret", ""),
        ("grant_type", "refresh_token"),
        ("refresh_token", refresh_token),
    ];

    let client = reqwest::Client::new();
    let response = client
        .post(&token_url)
        .form(&params)
        .send()
        .await
        .map_err(|error| OAuthError::RefreshRequest(error.to_string()))?;

    if !response.status().is_success() {
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown error".to_string());
        warn!(target: "gitlabify::oauth", %error_text, "oauth refresh failed");
        return Err(OAuthError::RefreshFailed(error_text));
    }

    response
        .json::<OAuthTokenResponse>()
        .await
        .map_err(|error| OAuthError::RefreshParse(error.to_string()))
}

#[cfg(test)]
mod tests {
    use super::is_keyring_entry_missing;

    #[test]
    fn keyring_missing_detection_handles_common_messages() {
        assert!(is_keyring_entry_missing("Entry not found"));
        assert!(is_keyring_entry_missing(
            "Item could not be found in keychain"
        ));
        assert!(!is_keyring_entry_missing("permission denied"));
    }
}
