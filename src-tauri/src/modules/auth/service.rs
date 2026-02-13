use tauri::{AppHandle, Emitter, Runtime};
use tauri_plugin_keyring::KeyringExt;
use tracing::{debug, error, info, warn};

use crate::modules::constants::{
    GITLAB_HOST, HTTP_TIMEOUT_SECS, OAUTH_REFRESH_TOKEN_KEY, PAT_KEY, SERVICE_NAME,
};
use crate::modules::inbox::{clear_stale_and_mark_online, trigger_poll};
use crate::modules::oauth::{
    delete_refresh_token, is_keyring_entry_missing, refresh_access_token, store_refresh_token,
};

use super::error::AuthError;
use super::model::{ScopeErrorBody, User};

pub(crate) async fn verify_token_internal<R: Runtime>(
    app: &AppHandle<R>,
    token: &str,
) -> Result<User, AuthError> {
    debug!(target: "gitlabify::auth", "verify_token called");

    match verify_token_with_value(token).await {
        Ok(user) => Ok(user),
        Err(AuthError::InvalidToken) => {
            if !is_current_stored_token(app, token) {
                return Err(AuthError::InvalidToken);
            }

            match try_refresh_and_verify(app).await {
                Ok(Some(user)) => Ok(user),
                Ok(None) => Err(AuthError::InvalidToken),
                Err(error) => Err(error),
            }
        }
        Err(error) => Err(error),
    }
}

pub(crate) async fn save_token_internal<R: Runtime>(
    app: &AppHandle<R>,
    token: &str,
) -> Result<(), AuthError> {
    app.keyring()
        .set_password(SERVICE_NAME, PAT_KEY, token)
        .map_err(|error| AuthError::KeychainError(error.to_string()))?;

    let _ = delete_refresh_token(app);
    clear_stale_and_mark_online(app);
    let _ = app.emit("auth-verified", ());
    trigger_poll(app);
    Ok(())
}

pub(crate) fn get_token_internal<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<Option<String>, AuthError> {
    app.keyring()
        .get_password(SERVICE_NAME, PAT_KEY)
        .map_err(|error| AuthError::KeychainError(error.to_string()))
}

pub(crate) fn delete_token_internal<R: Runtime>(app: &AppHandle<R>) -> Result<(), AuthError> {
    if let Err(error) = app.keyring().delete_password(SERVICE_NAME, PAT_KEY) {
        let error_message = error.to_string();
        if is_keyring_entry_missing(&error_message) {
            return Ok(());
        }
        return Err(AuthError::KeychainError(error_message));
    }

    let _ = delete_refresh_token(app);
    Ok(())
}

async fn verify_token_with_value(token: &str) -> Result<User, AuthError> {
    let client = reqwest::Client::builder()
        .user_agent("gitlabify")
        .timeout(std::time::Duration::from_secs(HTTP_TIMEOUT_SECS))
        .build()
        .map_err(|_| AuthError::NetworkError("Failed to initialize network client".to_string()))?;

    let url = format!("{GITLAB_HOST}/api/v4/user");
    let response = client
        .get(&url)
        .bearer_auth(token)
        .send()
        .await
        .map_err(|error| {
            error!(target: "gitlabify::auth", %error, "network error while verifying token");
            AuthError::NetworkError(
                "Network request failed. Check your connection and host URL.".to_string(),
            )
        })?;

    if response.status().is_success() {
        if let Some(scopes) = response.headers().get("X-Gitlab-Scopes") {
            let scopes_str = scopes.to_str().ok().unwrap_or_default();
            if !has_required_base_scopes(scopes_str) {
                return Err(AuthError::InsufficientScope(
                    "Token missing required scopes. Required: read_user and api (or read_api)."
                        .to_string(),
                ));
            }
        }

        let user = response.json::<User>().await.map_err(|error| {
            warn!(target: "gitlabify::auth", %error, "failed to parse user profile");
            AuthError::NetworkError("Failed to parse user profile from GitLab".to_string())
        })?;

        validate_inbox_permissions(&client, token).await?;
        info!(target: "gitlabify::auth", username = %user.username, "token verified");
        Ok(user)
    } else if response.status() == reqwest::StatusCode::UNAUTHORIZED {
        Err(AuthError::InvalidToken)
    } else {
        Err(AuthError::NetworkError(format!(
            "GitLab returned status: {}",
            response.status()
        )))
    }
}

fn has_required_base_scopes(scopes_str: &str) -> bool {
    let scopes: Vec<&str> = scopes_str
        .split([',', ' '])
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .collect();
    let has_read_user = scopes.contains(&"read_user");
    let has_api = scopes.contains(&"api") || scopes.contains(&"read_api");
    has_read_user && has_api
}

fn insufficient_scope_message(endpoint_label: &str, body: &str) -> String {
    if let Ok(parsed) = serde_json::from_str::<ScopeErrorBody>(body) {
        let description = parsed
            .error_description
            .unwrap_or_else(|| "Token has insufficient scope.".to_string());
        let required = parsed
            .scope
            .map(|value| format!(" Required scopes: {value}."))
            .unwrap_or_default();
        return format!("{description} ({endpoint_label}){required}");
    }

    format!(
        "Token has insufficient scope for {endpoint_label}. Required scopes include api or read_api."
    )
}

async fn validate_inbox_permissions(
    client: &reqwest::Client,
    token: &str,
) -> Result<(), AuthError> {
    let permission_checks = [
        (
            "merge request inbox",
            format!("{GITLAB_HOST}/api/v4/merge_requests?scope=all&state=opened&per_page=1"),
        ),
        (
            "todo inbox",
            format!("{GITLAB_HOST}/api/v4/todos?state=pending&type=MergeRequest&per_page=1"),
        ),
    ];

    for (label, url) in permission_checks {
        let response = client
            .get(&url)
            .bearer_auth(token)
            .send()
            .await
            .map_err(|error| {
                AuthError::NetworkError(format!("Permission check failed: {error}"))
            })?;

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
            "Permission check returned status {status} for {label}"
        )));
    }

    Ok(())
}

fn is_current_stored_token<R: Runtime>(app: &AppHandle<R>, token: &str) -> bool {
    match app.keyring().get_password(SERVICE_NAME, PAT_KEY) {
        Ok(Some(saved_token)) => saved_token == token,
        Ok(None) => false,
        Err(error) => {
            warn!(target: "gitlabify::auth", %error, "unable to read stored token during verification");
            false
        }
    }
}

async fn try_refresh_and_verify<R: Runtime>(app: &AppHandle<R>) -> Result<Option<User>, AuthError> {
    let refresh_token = match app
        .keyring()
        .get_password(SERVICE_NAME, OAUTH_REFRESH_TOKEN_KEY)
    {
        Ok(token) => token,
        Err(error) => {
            if is_keyring_entry_missing(&error.to_string()) {
                None
            } else {
                return Err(AuthError::KeychainError(error.to_string()));
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
        .map_err(|error| AuthError::KeychainError(error.to_string()))?;

    let refresh_token_to_store = refreshed
        .refresh_token
        .as_deref()
        .unwrap_or(refresh_token.as_str());
    store_refresh_token(app, Some(refresh_token_to_store))
        .map_err(|error| AuthError::KeychainError(error.to_string()))?;

    trigger_poll(app);
    Ok(Some(user))
}

#[cfg(test)]
mod tests {
    use super::{has_required_base_scopes, insufficient_scope_message};

    #[test]
    fn required_scopes_validation_accepts_api_or_read_api() {
        assert!(has_required_base_scopes("read_user api"));
        assert!(has_required_base_scopes("read_user,read_api"));
        assert!(!has_required_base_scopes("api"));
        assert!(!has_required_base_scopes("read_user"));
    }

    #[test]
    fn insufficient_scope_message_uses_error_payload_when_available() {
        let message = insufficient_scope_message(
            "todo inbox",
            r#"{"error_description":"insufficient_scope","scope":"api read_user"}"#,
        );
        assert!(message.contains("insufficient_scope"));
        assert!(message.contains("todo inbox"));
        assert!(message.contains("Required scopes: api read_user"));
    }
}
