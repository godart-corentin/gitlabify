use crate::modules::tray::update_badge;
use crate::modules::gitlab::{GitLabClient, GitLabError};
use crate::modules::constants::{GITLAB_HOST, SERVICE_NAME, PAT_KEY, CONSECUTIVE_FAILURE_THRESHOLD, POLLING_INTERVAL_SECONDS};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, Runtime};
use tauri_plugin_keyring::KeyringExt;

#[allow(dead_code)]
#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ConnectionStatus {
    Connected,
    Offline,
}

pub struct InboxState {
    pub status: Mutex<ConnectionStatus>,
    pub unread_count: Mutex<usize>,
    pub consecutive_failures: Mutex<usize>,
}

impl InboxState {
    pub fn new() -> Self {
        Self {
            status: Mutex::new(ConnectionStatus::Connected),
            unread_count: Mutex::new(0),
            consecutive_failures: Mutex::new(0),
        }
    }

    /// Updates the state based on polling success/failure.
    /// Returns (status_changed, is_offline, count)
    pub fn update(&self, success: bool) -> (bool, bool, usize) {
        let mut status = self.status.lock().expect("InboxState status mutex poisoned");
        let mut failures = self.consecutive_failures.lock().expect("InboxState failures mutex poisoned");
        let count = *self.unread_count.lock().expect("InboxState count mutex poisoned");
        let mut changed = false;

        if success {
            *failures = 0;
            if *status != ConnectionStatus::Connected {
                *status = ConnectionStatus::Connected;
                changed = true;
            }
        } else {
            *failures += 1;
            // Check for threshold
            if *failures >= CONSECUTIVE_FAILURE_THRESHOLD && *status != ConnectionStatus::Offline {
                *status = ConnectionStatus::Offline;
                changed = true;
            }
        }

        (changed, *status == ConnectionStatus::Offline, count)
    }

    pub fn set_count(&self, new_count: usize) -> (bool, bool, usize) {
        let mut count = self.unread_count.lock().expect("InboxState count mutex poisoned");
        let status = self.status.lock().expect("InboxState status mutex poisoned");
        let is_offline = *status == ConnectionStatus::Offline;

        if *count != new_count {
            *count = new_count;
            return (true, is_offline, new_count);
        }
        (false, is_offline, *count)
    }
}

pub fn update_connection_status<R: Runtime>(app: &AppHandle<R>, success: bool) {
    let state = app.state::<InboxState>();
    let (changed, is_offline, count) = state.update(success);

    if changed {
        update_badge(app, count, is_offline);
        let _ = app.emit("connection-status-changed", is_offline);
    }
}

pub fn start_polling<R: Runtime>(app: &AppHandle<R>) {
    let app_handle = app.clone();
    
    tauri::async_runtime::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(POLLING_INTERVAL_SECONDS));
        
        loop {
            interval.tick().await;
            
            // 1. Host is fixed for MVP
            let host = GITLAB_HOST.to_string();
            
            // 2. Get Token from Keyring
            let token_result = app_handle.keyring().get_password(SERVICE_NAME, PAT_KEY);
            
            if let Ok(Some(token)) = token_result {
                let client_res = GitLabClient::new(host, token);
                
                match client_res {
                    Ok(client) => {
                        // 3. Concurrent requests
                        let mrs_fut = client.fetch_merge_requests();
                        let todos_fut = client.fetch_todos();
                        let pipelines_fut = client.fetch_pipelines();
                        
                        let (mrs_res, todos_res, pipelines_res) = tokio::join!(mrs_fut, todos_fut, pipelines_fut);
                        
                        match (mrs_res, todos_res, pipelines_res) {
                            (Ok(mrs), Ok(todos), Ok(pipelines)) => {
                                let count = mrs.len() + todos.len();
                                
                                // Update state
                                update_count(&app_handle, count);
                                update_connection_status(&app_handle, true);
                                
                                // Emit data to frontend
                                let data = serde_json::json!({
                                    "mergeRequests": mrs,
                                    "todos": todos,
                                    "pipelines": pipelines,
                                });
                                let _ = app_handle.emit("inbox-updated", data);
                            },
                            (mrs_err, todos_err, pipelines_err) => {
                                eprintln!("Polling failed: MRs={:?}, Todos={:?}, Pipelines={:?}", 
                                    mrs_err.as_ref().err(), 
                                    todos_err.as_ref().err(), 
                                    pipelines_err.as_ref().err()
                                );

                                // Check if any error is RateLimited to potentially implement back-off in the future
                                let is_rate_limited = matches!(mrs_err, Err(GitLabError::RateLimited)) || 
                                                     matches!(todos_err, Err(GitLabError::RateLimited)) || 
                                                     matches!(pipelines_err, Err(GitLabError::RateLimited));
                                
                                if is_rate_limited {
                                    eprintln!("Rate limit hit, consider increasing polling interval.");
                                }

                                update_connection_status(&app_handle, false);
                            }
                        }
                    },
                    Err(e) => {
                        eprintln!("Failed to initialize GitLab client: {}", e);
                        update_connection_status(&app_handle, false);
                    }
                }
            } else if let Err(e) = token_result {
                eprintln!("Keyring error during polling: {}", e);
            }
        }
    });
}

pub fn update_count<R: Runtime>(app: &AppHandle<R>, new_count: usize) {
    let state = app.state::<InboxState>();
    let (changed, is_offline, count) = state.set_count(new_count);

    if changed {
        update_badge(app, count, is_offline);
    }
}
