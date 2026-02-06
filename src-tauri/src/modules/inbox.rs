use crate::modules::tray::update_badge;
use crate::modules::gitlab::{GitLabClient, InboxData};
use crate::modules::constants::{GITLAB_HOST, SERVICE_NAME, PAT_KEY, CONSECUTIVE_FAILURE_THRESHOLD, POLLING_INTERVAL_SECONDS};
use std::sync::{Arc, Mutex};
use std::collections::HashSet;
use tauri::{AppHandle, Emitter, Manager, Runtime};
use tauri_plugin_keyring::KeyringExt;
use tokio::sync::Notify;

fn lock_or_recover<'a, T>(mutex: &'a Mutex<T>, label: &str) -> std::sync::MutexGuard<'a, T> {
    match mutex.lock() {
        Ok(guard) => guard,
        Err(poisoned) => {
            eprintln!("Poisoned mutex: {}. Recovering inner value.", label);
            poisoned.into_inner()
        }
    }
}

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
    pub data: Mutex<Option<InboxData>>,
    pub last_error: Mutex<Option<String>>,
    pub poll_now: Arc<Notify>,
}

impl InboxState {
    pub fn new() -> Self {
        Self {
            status: Mutex::new(ConnectionStatus::Connected),
            unread_count: Mutex::new(0),
            consecutive_failures: Mutex::new(0),
            data: Mutex::new(None),
            last_error: Mutex::new(None),
            poll_now: Arc::new(Notify::new()),
        }
    }

    /// Updates the state based on polling success/failure.
    /// Returns (status_changed, is_offline, count)
    pub fn update(&self, success: bool) -> (bool, bool, usize) {
        let mut status = lock_or_recover(&self.status, "InboxState status");
        let mut failures = lock_or_recover(&self.consecutive_failures, "InboxState failures");
        let count = *lock_or_recover(&self.unread_count, "InboxState count");
        let mut changed = false;

        if success {
            *failures = 0;
            if *status != ConnectionStatus::Connected {
                *status = ConnectionStatus::Connected;
                changed = true;
            }
            // Clear error on success
            *lock_or_recover(&self.last_error, "InboxState last_error") = None;
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
        let mut count = lock_or_recover(&self.unread_count, "InboxState count");
        let status = lock_or_recover(&self.status, "InboxState status");
        let is_offline = *status == ConnectionStatus::Offline;

        if *count != new_count {
            *count = new_count;
            return (true, is_offline, new_count);
        }
        (false, is_offline, *count)
    }

    pub fn set_data(&self, new_data: InboxData) {
        let mut data = lock_or_recover(&self.data, "InboxState data");
        *data = Some(new_data);
    }

    pub fn set_error(&self, error: String) {
        let mut last_error = lock_or_recover(&self.last_error, "InboxState last_error");
        *last_error = Some(error);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_inbox_state_update() {
        let state = InboxState::new();
        
        // Initial state
        let (changed, is_offline, count) = state.update(true);
        assert!(!changed);
        assert!(!is_offline);
        assert_eq!(count, 0);

        // Failure
        let (changed, is_offline, _) = state.update(false);
        assert!(!changed); // threshold not met
        assert!(!is_offline);

        // Threshold failure (assuming threshold is 3)
        state.update(false);
        let (changed, is_offline, _) = state.update(false);
        assert!(changed);
        assert!(is_offline);

        // Recovery
        let (changed, is_offline, _) = state.update(true);
        assert!(changed);
        assert!(!is_offline);
        assert!(state.last_error.lock().unwrap().is_none());
    }

    #[test]
    fn test_inbox_state_data() {
        let state = InboxState::new();
        
        {
            let data = state.data.lock().unwrap();
            assert!(data.is_none());
        }

        let mock_data = InboxData {
            merge_requests: vec![],
            todos: vec![],
            pipelines: vec![],
        };

        state.set_data(mock_data);

        {
            let data = state.data.lock().unwrap();
            assert!(data.is_some());
        }
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

pub fn update_count<R: Runtime>(app: &AppHandle<R>, count: usize) {
    let state = app.state::<InboxState>();
    let (changed, is_offline, _) = state.set_count(count);

    if changed {
        update_badge(app, count, is_offline);
    }
}

pub fn trigger_poll<R: Runtime>(app: &AppHandle<R>) {
    let state = app.state::<InboxState>();
    state.poll_now.notify_one();
}

#[tauri::command]
pub fn get_inbox(state: tauri::State<InboxState>) -> Option<InboxData> {
    let data = lock_or_recover(&state.data, "InboxState data");
    data.clone()
}

#[tauri::command]
pub fn get_connection_status(state: tauri::State<InboxState>) -> bool {
    let status = lock_or_recover(&state.status, "InboxState status");
    *status == ConnectionStatus::Offline
}

#[tauri::command]
pub fn refresh_inbox(app: AppHandle) {
    trigger_poll(&app);
}

pub fn start_polling<R: Runtime>(app: &AppHandle<R>) {
    let app_handle = app.clone();
    let poll_now = app.state::<InboxState>().poll_now.clone();
    
    tauri::async_runtime::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(POLLING_INTERVAL_SECONDS));
        
        // Cache for connection pooling and token
        let mut cached_client: Option<Arc<GitLabClient>> = None;
        let mut cached_token: Option<String> = None;

        loop {
            tokio::select! {
                _ = interval.tick() => {
                    // Standard interval poll
                }
                _ = poll_now.notified() => {
                    // Manual poll requested
                    println!("Manual poll triggered");
                }
            }
            
            // 1. Host is fixed for MVP
            let host = GITLAB_HOST.to_string();
            
            // 2. Resolve Token (Cache or Keyring)
            if cached_token.is_none() {
                 let token_result = app_handle.keyring().get_password(SERVICE_NAME, PAT_KEY);
                 match token_result {
                     Ok(Some(token)) => {
                         cached_token = Some(token);
                     }
                     Ok(None) => {
                         // No token found, wait for next poll
                         continue; 
                     }
                     Err(e) => {
                         eprintln!("Keyring error during polling: {}", e);
                         continue;
                     }
                 }
            }
            
            // 3. Resolve Client (Reuse or Create)
            if cached_client.is_none() {
                if let Some(token) = &cached_token {
                    match GitLabClient::new(host.clone(), token.clone()) {
                        Ok(client) => {
                            cached_client = Some(Arc::new(client));
                        }
                        Err(e) => {
                            let msg = format!("Failed to initialize GitLab client: {}", e);
                            eprintln!("{}", msg);
                            app_handle.state::<InboxState>().set_error(msg.clone());
                            let _ = app_handle.emit("inbox-error", msg);
                            update_connection_status(&app_handle, false);
                            continue;
                        }
                    }
                }
            }

            if let Some(client_arc) = &cached_client {
                // 4. Concurrent requests
                let mrs_fut = client_arc.fetch_merge_requests();
                let todos_fut = client_arc.fetch_todos();
                
                let (mrs_res, todos_res) = tokio::join!(mrs_fut, todos_fut);

                let mut mrs = Vec::new();
                let mut todos = Vec::new();
                let mut pipelines = Vec::new();
                let mut notification_ids = HashSet::new();
                let mut error_msg = String::new();
                let mut has_success = false;
                let mut needs_reauth = false; // Flag to clear cache on 401

                match mrs_res {
                    Ok((fetched_mrs, user)) => {
                        let user_id = user.id;
                        // Extract pipelines from the current user's MRs only.
                        let mut pipeline_ids = HashSet::new();
                        let mut join_set = tokio::task::JoinSet::new();
                        
                        // Deduplication Set: (ProjectId, RefName)
                        let mut pending_fetches: HashSet<(u64, String)> = HashSet::new();

                        for mr in &fetched_mrs {
                            if mr.author.id == user_id {
                                if let Some(pipeline) = &mr.head_pipeline {
                                    if pipeline_ids.insert(pipeline.id) {
                                        pipelines.push(pipeline.clone());
                                    }
                                } else if let Some(ref_name) = mr.source_branch.as_deref() {
                                    // Optimization: Deduplicate requests for the same ref
                                    let key = (mr.project_id, ref_name.to_string());
                                    if pending_fetches.contains(&key) {
                                        continue;
                                    }
                                    pending_fetches.insert(key.clone());

                                    // Clone for the async task
                                    let client = client_arc.clone();
                                    let project_id = mr.project_id;
                                    let ref_name = ref_name.to_string();
                                    let username = user.username.clone();

                                    join_set.spawn(async move {
                                        let res = client
                                            .fetch_latest_pipeline_for_project_ref(
                                                project_id,
                                                &ref_name,
                                                &username,
                                            )
                                            .await;
                                        res
                                    });
                                }
                            }
                        }

                        // Process concurrent results & map back to MRs is not strictly needed 
                        // because we just need to populate the pipelines list associated with user's branches.
                        // We do lose the direct "This pipeline belongs to MR X" error logging context, 
                        // but for a dashboard view, getting the pipeline is what matters.
                        while let Some(res) = join_set.join_next().await {
                            match res {
                                Ok(result) => match result {
                                    Ok(Some(pipeline)) => {
                                        if pipeline_ids.insert(pipeline.id) {
                                            pipelines.push(pipeline);
                                        }
                                    }
                                    Ok(None) => {}
                                    Err(crate::modules::gitlab::GitLabError::Unauthorized) => {
                                         needs_reauth = true;
                                    }
                                    Err(e) => {
                                        // We can't log MR ID easily here without passing it through, 
                                        // but since we deduped, it might belong to multiple. 
                                        error_msg.push_str(&format!("Pipeline fetch error: {}; ", e));
                                    }
                                },
                                Err(e) => {
                                    error_msg.push_str(&format!("Join error: {}; ", e));
                                }
                            }
                        }

                        println!(
                            "Extracted {} pipelines from {} MRs for user {}",
                            pipelines.len(),
                            fetched_mrs.len(),
                            user_id
                        );
                        
                        // Identify "Notification" MRs (where user is not author)
                        for mr in &fetched_mrs {
                            if mr.author.id != user_id {
                                notification_ids.insert(mr.id);
                            }
                        }

                        mrs = fetched_mrs;
                        has_success = true;
                    },
                    Err(crate::modules::gitlab::GitLabError::Unauthorized) => {
                        needs_reauth = true;
                    }
                    Err(e) => {
                        error_msg.push_str(&format!("MRs: {}; ", e));
                    }
                }

                match todos_res {
                    Ok(fetched_todos) => {
                        for todo in &fetched_todos {
                            if let Some(target) = &todo.target {
                                notification_ids.insert(target.id);
                            }
                        }
                        todos = fetched_todos;
                        has_success = true;
                    },
                    Err(crate::modules::gitlab::GitLabError::Unauthorized) => {
                         needs_reauth = true;
                    }
                    Err(e) => {
                        error_msg.push_str(&format!("Todos: {}; ", e));
                    }
                }

                if needs_reauth {
                    eprintln!("Unauthorized: Clearing cached token and client");
                    cached_token = None;
                    cached_client = None;
                    app_handle.state::<InboxState>().set_error("Unauthorized".to_string());
                    if let Err(e) = app_handle
                        .keyring()
                        .delete_password(SERVICE_NAME, PAT_KEY)
                    {
                        eprintln!("Failed to delete token from keyring: {}", e);
                    }
                    let _ = app_handle.emit("auth-required", ());
                    update_connection_status(&app_handle, false);
                    continue; // Skip the rest, retry next loop
                }

                if has_success {
                    let count = notification_ids.len();
                    
                    // Create InboxData struct
                    let inbox_data = InboxData {
                        merge_requests: mrs,
                        todos: todos,
                        pipelines: pipelines,
                    };

                    // Update state
                    update_count(&app_handle, count);
                    update_connection_status(&app_handle, true);
                    
                    // Store data in state
                    app_handle.state::<InboxState>().set_data(inbox_data.clone());
                    
                    // Emit data to frontend
                    let _ = app_handle.emit("inbox-updated", inbox_data);
                    
                    if !error_msg.is_empty() {
                        // Log partial error
                        eprintln!("Partial polling failure: {}", error_msg);
                        app_handle.state::<InboxState>().set_error(error_msg.clone());
                    }
                } else {
                    // Both failed
                    eprintln!("Polling failed: {}", error_msg);
                    app_handle.state::<InboxState>().set_error(error_msg.clone());
                    let _ = app_handle.emit("inbox-error", error_msg);

                    update_connection_status(&app_handle, false);
                }
            }
        }
    });
}
