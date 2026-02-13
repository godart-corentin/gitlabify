use serde::{Deserialize, Serialize};
use thiserror::Error;
use tauri::Emitter;
use tauri_plugin_keyring::KeyringExt;

use crate::modules::constants::{GITLAB_HOST, HTTP_TIMEOUT_SECS, PAT_KEY, SERVICE_NAME};
use crate::modules::inbox::{clear_stale_and_mark_online, trigger_poll};
use crate::modules::oauth::{
    delete_refresh_token,
    is_keyring_entry_missing,
    refresh_access_token,
    store_refresh_token,
};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct User {
    pub(crate) id: u64,
    pub(crate) username: String,
    pub(crate) name: String,
    #[serde(alias = "avatar_url")]
    pub(crate) avatar_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Error)]
#[serde(tag = "type", content = "message", rename_all = "camelCase")]
pub(crate) enum AuthError {
    #[error("Invalid Personal Access Token")]
    InvalidToken,
    #[error("Insufficient scope: {0}")]
    InsufficientScope(String),
    #[error("Network error: {0}")]
    NetworkError(String),
    #[error("Keychain error: {0}")]
    KeychainError(String),
}

#[tauri::command]
pub(crate) async fn verify_token<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    token: String,
) -> Result<User, AuthError> {
    println!("Backend: verify_token called");
    match verify_token_with_value(&token).await {
        Ok(user) => Ok(user),
        Err(AuthError::InvalidToken) => {
            if !is_current_stored_token(&app, &token) {
                return Err(AuthError::InvalidToken);
            }

            match try_refresh_and_verify(&app).await {
                Ok(Some(user)) => Ok(user),
                Ok(None) => Err(AuthError::InvalidToken),
                Err(err) => Err(err),
            }
        }
        Err(err) => Err(err),
    }
}

async fn verify_token_with_value(token: &str) -> Result<User, AuthError> {
    let client = reqwest::Client::builder()
        .user_agent("gitlabify")
        .timeout(std::time::Duration::from_secs(HTTP_TIMEOUT_SECS))
        .build()
        .map_err(|_e| AuthError::NetworkError("Failed to initialize network client".to_string()))?;

    let url = format!("{}/api/v4/user", GITLAB_HOST);

    println!("Backend: sending request to {}", url);
    let response = client
        .get(&url)
        .bearer_auth(token)
        .send()
        .await
        .map_err(|e| {
            println!("Backend: network error: {}", e);
            AuthError::NetworkError(
                "Network request failed. Check your connection and host URL.".to_string(),
            )
        })?;

    if response.status().is_success() {
        // Validate base scopes from response headers when GitLab provides them.
        if let Some(scopes) = response.headers().get("X-Gitlab-Scopes") {
            let scopes_str = scopes.to_str().unwrap_or_default();
            if !has_required_base_scopes(scopes_str) {
                println!("Backend: missing scopes");
                return Err(AuthError::InsufficientScope(
                    "Token missing required scopes. Required: read_user and api (or read_api)."
                        .to_string(),
                ));
            }
        }

        let user = response.json::<User>().await.map_err(|e| {
            println!("Backend: parsing error: {}", e);
            AuthError::NetworkError("Failed to parse user profile from GitLab".to_string())
        })?;
        validate_inbox_permissions(&client, token).await?;
        println!("Backend: verify_token success for user {}", user.username);
        Ok(user)
    } else if response.status() == reqwest::StatusCode::UNAUTHORIZED {
        println!("Backend: unauthorized");
        Err(AuthError::InvalidToken)
    } else {
        println!("Backend: other error status {}", response.status());
        Err(AuthError::NetworkError(format!(
            "GitLab returned status: {}",
            response.status()
        )))
    }
}

#[derive(Debug, Deserialize)]
struct ScopeErrorBody {
    error_description: Option<String>,
    scope: Option<String>,
}

fn has_required_base_scopes(scopes_str: &str) -> bool {
    let scopes: Vec<&str> = scopes_str
        .split([',', ' '])
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .collect();
    let has_read_user = scopes.iter().any(|scope| *scope == "read_user");
    let has_api = scopes.iter().any(|scope| *scope == "api" || *scope == "read_api");
    has_read_user && has_api
}

fn insufficient_scope_message(endpoint_label: &str, body: &str) -> String {
    if let Ok(parsed) = serde_json::from_str::<ScopeErrorBody>(body) {
        let description = parsed
            .error_description
            .unwrap_or_else(|| "Token has insufficient scope.".to_string());
        let required = parsed
            .scope
            .map(|value| format!(" Required scopes: {}.", value))
            .unwrap_or_default();
        return format!("{} ({}){}", description, endpoint_label, required);
    }

    format!(
        "Token has insufficient scope for {}. Required scopes include api or read_api.",
        endpoint_label
    )
}

async fn validate_inbox_permissions(
    client: &reqwest::Client,
    token: &str,
) -> Result<(), AuthError> {
    let permission_checks = [
        (
            "merge request inbox",
            format!(
                "{}/api/v4/merge_requests?scope=all&state=opened&per_page=1",
                GITLAB_HOST
            ),
        ),
        (
            "todo inbox",
            format!(
                "{}/api/v4/todos?state=pending&type=MergeRequest&per_page=1",
                GITLAB_HOST
            ),
        ),
    ];

    for (label, url) in permission_checks {
        let response = client
            .get(&url)
            .bearer_auth(token)
            .send()
            .await
            .map_err(|e| AuthError::NetworkError(format!("Permission check failed: {}", e)))?;

        let status = response.status();
        if status.is_success() {
            continue;
        }

        if status == reqwest::StatusCode::UNAUTHORIZED {
            return Err(AuthError::InvalidToken);
        }

        let body = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown error".to_string());

        if status == reqwest::StatusCode::FORBIDDEN {
            return Err(AuthError::InsufficientScope(insufficient_scope_message(
                label, &body,
            )));
        }

        return Err(AuthError::NetworkError(format!(
            "Permission check returned status {} for {}",
            status, label
        )));
    }

    Ok(())
}

fn is_current_stored_token<R: tauri::Runtime>(app: &tauri::AppHandle<R>, token: &str) -> bool {
    match app.keyring().get_password(SERVICE_NAME, PAT_KEY) {
        Ok(Some(saved_token)) => saved_token == token,
        Ok(None) => false,
        Err(error) => {
            eprintln!("Unable to read stored token during verify: {}", error);
            false
        }
    }
}

async fn try_refresh_and_verify<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
) -> Result<Option<User>, AuthError> {
    let refresh_token = match app
        .keyring()
        .get_password(
            SERVICE_NAME,
            crate::modules::constants::OAUTH_REFRESH_TOKEN_KEY,
        ) {
        Ok(token) => token,
        Err(err) => {
            if is_keyring_entry_missing(&err.to_string()) {
                None
            } else {
                return Err(AuthError::KeychainError(err.to_string()));
            }
        }
    };

    let Some(refresh_token) = refresh_token else {
        return Ok(None);
    };

    let refreshed = match refresh_access_token(&refresh_token).await {
        Ok(response) => response,
        Err(error) => {
            let error_message = error.to_string();
            let lower = error_message.to_lowercase();
            if lower.contains("invalid_grant")
                || lower.contains("invalid refresh token")
                || lower.contains("refresh token revoked")
            {
                let _ = delete_refresh_token(app);
                return Ok(None);
            }

            return Err(AuthError::NetworkError(
                "Failed to refresh OAuth session".to_string(),
            ));
        }
    };

    let user = verify_token_with_value(&refreshed.access_token).await?;
    app.keyring()
        .set_password(SERVICE_NAME, PAT_KEY, &refreshed.access_token)
        .map_err(|err| AuthError::KeychainError(err.to_string()))?;
    let refresh_token_to_store = refreshed.refresh_token.as_deref().unwrap_or(&refresh_token);
    store_refresh_token(app, Some(refresh_token_to_store))
        .map_err(|err| AuthError::KeychainError(err.to_string()))?;
    trigger_poll(app);
    Ok(Some(user))
}

#[tauri::command]
pub(crate) async fn save_token<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    token: String,
) -> Result<(), AuthError> {
    println!("Backend: save_token called");
    app.keyring()
        .set_password(SERVICE_NAME, PAT_KEY, &token)
        .map_err(|e| {
            println!("Backend: save_token error: {}", e);
            AuthError::KeychainError(e.to_string())
        })?;
    let _ = delete_refresh_token(&app);
    clear_stale_and_mark_online(&app);
    let _ = app.emit("auth-verified", ());

    trigger_poll(&app);
    Ok(())
}

#[tauri::command]
pub(crate) async fn get_token<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
) -> Result<Option<String>, AuthError> {
    println!("Backend: get_token called");
    match app.keyring().get_password(SERVICE_NAME, PAT_KEY) {
        Ok(token) => {
            match token {
                Some(_) => println!("Backend: get_token found token"),
                None => println!("Backend: get_token returned None"),
            }
            Ok(token)
        }
        Err(e) => {
            // Check if it's a "not found" error, which is expected for new users
            let err_str = e.to_string();
            println!("Backend: get_token error: {}", err_str);
            // In tauri-plugin-keyring (and keyring crate), "Entry not found" might vary by OS
            // But usually we just return the error.
            Err(AuthError::KeychainError(err_str))
        }
    }
}

#[tauri::command]
pub(crate) async fn delete_token<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
) -> Result<(), AuthError> {
    if let Err(e) = app.keyring().delete_password(SERVICE_NAME, PAT_KEY) {
        let err_str = e.to_string();
        if is_keyring_entry_missing(&err_str) {
            return Ok(());
        }
        return Err(AuthError::KeychainError(err_str));
    }
    let _ = delete_refresh_token(&app);
    Ok(())
}
