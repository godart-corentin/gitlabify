use serde::{Deserialize, Serialize};
use tauri_plugin_keyring::KeyringExt;

use crate::modules::constants::{GITLAB_HOST, SERVICE_NAME, PAT_KEY};
use crate::modules::inbox::trigger_poll;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct User {
    pub id: u64,
    pub username: String,
    pub name: String,
    #[serde(alias = "avatar_url")]
    pub avatar_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type", content = "message", rename_all = "camelCase")]
pub enum AuthError {
    InvalidToken,
    NetworkError(String),
    KeychainError(String),
}

impl std::fmt::Display for AuthError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AuthError::InvalidToken => write!(f, "Invalid Personal Access Token"),
            AuthError::NetworkError(msg) => write!(f, "Network error: {}", msg),
            AuthError::KeychainError(msg) => write!(f, "Keychain error: {}", msg),
        }
    }
}

impl std::error::Error for AuthError {}

#[tauri::command]
pub async fn verify_token<R: tauri::Runtime>(
    _app: tauri::AppHandle<R>,
    token: String,
) -> Result<User, AuthError> {
    println!("Backend: verify_token called");
    let client = reqwest::Client::builder()
        .user_agent("gitlabify")
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|_e| AuthError::NetworkError("Failed to initialize network client".to_string()))?;

    let url = format!("{}/api/v4/user", GITLAB_HOST);

    println!("Backend: sending request to {}", url);
    let response = client
        .get(&url)
        .bearer_auth(&token)
        .send()
        .await
        .map_err(|e| {
            println!("Backend: network error: {}", e);
            AuthError::NetworkError(
                "Network request failed. Check your connection and host URL.".to_string(),
            )
        })?;

    if response.status().is_success() {
        // AC 2: Validate required scopes (api, read_user)
        if let Some(scopes) = response.headers().get("X-Gitlab-Scopes") {
            let scopes_str = scopes.to_str().unwrap_or("");
            let has_api = scopes_str.contains("api");
            let has_read_user = scopes_str.contains("read_user");

            if !has_api || !has_read_user {
                println!("Backend: missing scopes");
                return Err(AuthError::NetworkError(
                    "Token missing required scopes: api and read_user".to_string(),
                ));
            }
        }

        let user = response.json::<User>().await.map_err(|e| {
            println!("Backend: parsing error: {}", e);
            AuthError::NetworkError("Failed to parse user profile from GitLab".to_string())
        })?;
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

#[tauri::command]
pub async fn save_token<R: tauri::Runtime>(
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

    trigger_poll(&app);
    Ok(())
}

#[tauri::command]
pub async fn get_token<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
) -> Result<Option<String>, AuthError> {
    println!("Backend: get_token called");
    match app.keyring().get_password(SERVICE_NAME, PAT_KEY) {
        Ok(token) => {
            if token.is_some() {
                println!("Backend: get_token found token");
            } else {
                println!("Backend: get_token returned None");
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
pub async fn delete_token<R: tauri::Runtime>(app: tauri::AppHandle<R>) -> Result<(), AuthError> {
    app.keyring()
        .delete_password(SERVICE_NAME, PAT_KEY)
        .map_err(|e| AuthError::KeychainError(e.to_string()))?;
    Ok(())
}
