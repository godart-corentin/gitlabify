use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use rand::{distributions::Alphanumeric, Rng};
use sha2::{Digest, Sha256};
use std::sync::{Mutex, MutexGuard};
use tauri::{AppHandle, Manager, State};
use tauri_plugin_opener::OpenerExt;
use anyhow::{Context, Result as AnyResult};

use crate::modules::auth::{save_token, verify_token, User};
use crate::modules::constants::{GITLAB_HOST, OAUTH_VERIFIER_LENGTH};

pub(crate) struct OAuthState {
    pub(crate) code_verifier: Mutex<Option<String>>,
}

fn lock_or_recover<'a, T>(mutex: &'a Mutex<T>, label: &str) -> MutexGuard<'a, T> {
    match mutex.lock() {
        Ok(guard) => guard,
        Err(poisoned) => {
            eprintln!("Poisoned mutex: {}. Recovering inner value.", label);
            poisoned.into_inner()
        }
    }
}

#[tauri::command]
pub(crate) async fn start_oauth_flow(
    app: AppHandle,
    state: State<'_, OAuthState>,
) -> Result<String, String> {
    start_oauth_flow_impl(app, state)
        .await
        .map_err(|e| e.to_string())
}

async fn start_oauth_flow_impl(
    app: AppHandle,
    state: State<'_, OAuthState>,
) -> AnyResult<String> {
    let verifier = generate_verifier();
    let challenge = generate_challenge(&verifier);

    // Store verifier in state
    {
        let mut verifier_state = lock_or_recover(&state.code_verifier, "OAuthState code_verifier");
        *verifier_state = Some(verifier);
    }


    // Load configuration from compile-time environment variables
    let client_id = env!("GITLAB_CLIENT_ID");
    let redirect_uri = "gitlabify://oauth-callback";

    let auth_url = format!(
        "{}/oauth/authorize?client_id={}&redirect_uri={}&response_type=code&scope=api+read_user&code_challenge={}&code_challenge_method=S256",
        GITLAB_HOST,
        client_id,
        urlencoding::encode(redirect_uri),
        challenge
    );

    // Open browser
    app.opener()
        .open_url(auth_url, None::<&str>)
        .context("Failed to open OAuth URL in browser")?;

    Ok("OAuth flow started".to_string())
}

#[tauri::command]
pub(crate) async fn exchange_code_for_token(
    app: AppHandle,
    code: String,
) -> Result<User, String> {
    exchange_code_for_token_impl(app, code)
        .await
        .map_err(|e| e.to_string())
}

async fn exchange_code_for_token_impl(app: AppHandle, code: String) -> AnyResult<User> {
    let verifier = {
        let state = app.state::<OAuthState>();
        let mut verifier_state = lock_or_recover(&state.code_verifier, "OAuthState code_verifier");
        verifier_state
            .take()
            .context("No code verifier found")?
    };

    let client_id = env!("GITLAB_CLIENT_ID");
    let redirect_uri = "gitlabify://oauth-callback";

    let token_url = format!("{}/oauth/token", GITLAB_HOST);

    let params = [
        ("client_id", client_id),
        ("client_secret", ""), // Public client, no secret
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
        .context("Token exchange request failed")?;

    if !response.status().is_success() {
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown error".to_string());
        return Err(anyhow::anyhow!("Token exchange failed: {}", error_text));
    }

    let token_response: serde_json::Value = response.json().await.context("Failed to parse token response")?;
    let access_token = token_response["access_token"]
        .as_str()
        .context("No access token in response")?
        .to_string();

    // Verify and save the token
    let user = verify_token(app.clone(), access_token.clone())
        .await
        .context("Token verification failed")?;
    save_token(app, access_token)
        .await
        .context("Saving token failed")?;

    Ok(user)
}

fn generate_verifier() -> String {
    rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(OAUTH_VERIFIER_LENGTH)
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
        assert!(challenge
            .chars()
            .all(|c| c.is_alphanumeric() || c == '-' || c == '_'));
    }
}
