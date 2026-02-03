use serde::{Deserialize, Serialize};
use tauri_plugin_keyring::KeyringExt;

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

const SERVICE_NAME: &str = "gitlabify";
const PAT_KEY: &str = "private-token";

#[tauri::command]
pub async fn verify_token(token: String, host: String) -> Result<User, AuthError> {
    let client = reqwest::Client::builder()
        .user_agent("gitlabify")
        .build()
        .map_err(|_e| AuthError::NetworkError("Failed to initialize network client".to_string()))?;
        
    let url = format!("{}/api/v4/user", host.trim_end_matches('/'));
    
    let response = client
        .get(&url)
        .bearer_auth(&token)
        .send()
        .await
        .map_err(|_e| AuthError::NetworkError("Network request failed. Check your connection and host URL.".to_string()))?;

    if response.status().is_success() {
        // AC 2: Validate required scopes (api, read_user)
        if let Some(scopes) = response.headers().get("X-Gitlab-Scopes") {
            let scopes_str = scopes.to_str().unwrap_or("");
            let has_api = scopes_str.contains("api");
            let has_read_user = scopes_str.contains("read_user");

            if !has_api || !has_read_user {
                return Err(AuthError::NetworkError("Token missing required scopes: api and read_user".to_string()));
            }
        }

        let user = response.json::<User>().await.map_err(|_| AuthError::NetworkError("Failed to parse user profile from GitLab".to_string()))?;
        Ok(user)
    } else if response.status() == reqwest::StatusCode::UNAUTHORIZED {
        Err(AuthError::InvalidToken)
    } else {
        Err(AuthError::NetworkError(format!("GitLab returned status: {}", response.status())))
    }
}

#[tauri::command]
pub async fn save_token<R: tauri::Runtime>(app: tauri::AppHandle<R>, token: String) -> Result<(), AuthError> {
    app.keyring()
        .set_password(SERVICE_NAME, PAT_KEY, &token)
        .map_err(|e| AuthError::KeychainError(e.to_string()))?;
    Ok(())
}

#[tauri::command]
pub async fn get_token<R: tauri::Runtime>(app: tauri::AppHandle<R>) -> Result<Option<String>, AuthError> {
    app.keyring()
        .get_password(SERVICE_NAME, PAT_KEY)
        .map_err(|e| AuthError::KeychainError(e.to_string()))
}

#[tauri::command]
pub async fn delete_token<R: tauri::Runtime>(app: tauri::AppHandle<R>) -> Result<(), AuthError> {
    app.keyring()
        .delete_password(SERVICE_NAME, PAT_KEY)
        .map_err(|e| AuthError::KeychainError(e.to_string()))?;
    Ok(())
}
