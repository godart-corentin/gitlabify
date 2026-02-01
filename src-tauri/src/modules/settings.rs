use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;
use url::Url;

const SETTINGS_PATH: &str = "settings.json";
const GITLAB_HOST_KEY: &str = "gitlab_host";

#[derive(Debug, Serialize, Deserialize)]
pub struct GitlabHostResponse {
    pub host: Option<String>,
}

#[tauri::command]
pub async fn get_gitlab_host(app: AppHandle) -> Result<GitlabHostResponse, String> {
    let store = app.store(SETTINGS_PATH).map_err(|e| e.to_string())?;
    let host = store.get(GITLAB_HOST_KEY).and_then(|v| v.as_str().map(|s| s.to_string()));
    
    Ok(GitlabHostResponse { host })
}

#[tauri::command]
pub async fn set_gitlab_host(app: AppHandle, host: String) -> Result<(), String> {
    // Validate URL
    validate_url(&host).map_err(|e| format!("Invalid URL: {}", e))?;

    let store = app.store(SETTINGS_PATH).map_err(|e| e.to_string())?;
    store.set(GITLAB_HOST_KEY, serde_json::Value::String(host));
    store.save().map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn clear_gitlab_host(app: AppHandle) -> Result<(), String> {
    let store = app.store(SETTINGS_PATH).map_err(|e| e.to_string())?;
    store.delete(GITLAB_HOST_KEY);
    store.save().map_err(|e| e.to_string())?;

    Ok(())
}

fn validate_url(url_str: &str) -> Result<(), String> {
    let _url = Url::parse(url_str).map_err(|e: url::ParseError| e.to_string())?;
    if _url.scheme() != "http" && _url.scheme() != "https" {
        return Err("URL must use http or https scheme".to_string());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_url_valid() {
        assert!(validate_url("https://gitlab.com").is_ok());
        assert!(validate_url("http://localhost:8080").is_ok());
        assert!(validate_url("https://gitlab.mycompany.com/api/v4").is_ok());
    }

    #[test]
    fn test_validate_url_invalid() {
        assert!(validate_url("not-a-url").is_err());
        assert!(validate_url("ftp://gitlab.com").is_err());
        assert!(validate_url("gitlab.com").is_err()); // Missing scheme
    }
}
