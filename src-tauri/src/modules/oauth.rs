use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use rand::{distributions::Alphanumeric, Rng};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::sync::Mutex;
use tauri::{AppHandle, State, Manager};
use tauri_plugin_opener::OpenerExt;

use crate::modules::auth::{verify_token, save_token, User};
use crate::modules::settings::get_gitlab_host;

pub struct OAuthState {
    pub code_verifier: Mutex<Option<String>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OAuthResponse {
    pub access_token: String,
    pub token_type: String,
    pub expires_in: Option<u64>,
    pub refresh_token: Option<String>,
    pub scope: String,
    pub created_at: Option<u64>,
}

#[tauri::command]
pub async fn start_oauth_flow(
    app: AppHandle,
    state: State<'_, OAuthState>,
) -> Result<String, String> {
    let verifier = generate_verifier();
    let challenge = generate_challenge(&verifier);

    // Store verifier in state
    {
        let mut verifier_state = state.code_verifier.lock().map_err(|e| e.to_string())?;
        *verifier_state = Some(verifier);
    }

    let host_response = get_gitlab_host(app.clone()).await.map_err(|e| e.to_string())?;
    let host = host_response.host.ok_or("GitLab host not configured")?;

    // Load configuration from compile-time environment variables
    let client_id = env!("GITLAB_CLIENT_ID");
    let redirect_uri = "gitlabify://oauth-callback";

    let auth_url = format!(
        "{}/oauth/authorize?client_id={}&redirect_uri={}&response_type=code&scope=api+read_user&code_challenge={}&code_challenge_method=S256",
        host.trim_end_matches('/'),
        client_id,
        urlencoding::encode(&redirect_uri),
        challenge
    );

    // Open browser
    app.opener().open_url(auth_url, None::<&str>).map_err(|e| e.to_string())?;

    Ok("OAuth flow started".to_string())
}

#[tauri::command]
pub async fn exchange_code_for_token(app: AppHandle, code: String) -> Result<User, String> {
    let verifier = {
        let state = app.state::<OAuthState>();
        let mut verifier_state = state.code_verifier.lock().unwrap();
        verifier_state.take().ok_or("No code verifier found")?
    };

    let host_response = get_gitlab_host(app.clone()).await.map_err(|e| e.to_string())?;
    let host = host_response.host.ok_or("GitLab host not configured")?;

    let client_id = env!("GITLAB_CLIENT_ID");
    let redirect_uri = "gitlabify://oauth-callback";

    let token_url = format!("{}/oauth/token", host.trim_end_matches('/'));

    let params = [
        ("client_id", client_id),
        ("client_secret", ""), // Public client, no secret
        ("code", &code),
        ("grant_type", "authorization_code"),
        ("redirect_uri", redirect_uri),
        ("code_verifier", &verifier),
    ];

    let client = reqwest::Client::new();
    let response = client.post(&token_url)
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("Token exchange failed: {}", error_text));
    }

    let token_response: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    let access_token = token_response["access_token"]
        .as_str()
        .ok_or("No access token in response")?
        .to_string();

    // Verify and save the token
    let user = verify_token(access_token.clone(), host).await.map_err(|e| {
        e.to_string()
    })?;
    save_token(app, access_token).await.map_err(|e| e.to_string())?;

    Ok(user)
}

fn generate_verifier() -> String {
    rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(128)
        .map(char::from)
        .collect()
}

fn generate_challenge(verifier: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(verifier.as_bytes());
    URL_SAFE_NO_PAD.encode(hasher.finalize())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pkce_generation() {
        let verifier = "test_verifier_with_enough_length_for_entropy_1234567890";
        let challenge = generate_challenge(verifier);
        assert!(!challenge.is_empty());
        // Simple sanity check that it's base64 encoded
        assert!(challenge.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_'));
    }
}
