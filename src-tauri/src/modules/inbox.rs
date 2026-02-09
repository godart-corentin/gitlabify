use crate::modules::tray::update_badge;
use crate::modules::gitlab::{GitLabClient, InboxData};
use crate::modules::constants::{
    CONSECUTIVE_FAILURE_THRESHOLD,
    GITLAB_HOST,
    INBOX_CACHE_FILE_NAME,
    INBOX_CACHE_KEY_CONNECTION_STATUS,
    INBOX_CACHE_KEY_DATA,
    INBOX_CACHE_KEY_LAST_ERROR,
    INBOX_CACHE_KEY_LAST_UPDATED_MS,
    INBOX_CACHE_KEY_UNREAD_COUNT,
    INBOX_CACHE_STALE_THRESHOLD_MS,
    INBOX_CACHE_WRITE_DEBOUNCE_MS,
    PAT_KEY,
    POLLING_INTERVAL_SECONDS,
    SERVICE_NAME,
};
use serde::de::DeserializeOwned;
use std::collections::HashSet;
use std::sync::{
    atomic::{AtomicBool, AtomicUsize, Ordering},
    Arc,
    Mutex,
};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager, Runtime};
use tauri_plugin_keyring::KeyringExt;
use tauri_plugin_store::{Store, StoreExt};
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
pub(crate) enum ConnectionStatus {
    Connected,
    Offline,
}

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct InboxStalePayload {
    pub(crate) is_stale: bool,
    pub(crate) is_offline: bool,
    pub(crate) last_updated_at_ms: Option<u64>,
    pub(crate) last_error: Option<String>,
}

pub(crate) struct InboxState {
    pub(crate) is_offline: AtomicBool,
    pub(crate) unread_count: AtomicUsize,
    pub(crate) consecutive_failures: AtomicUsize,
    pub(crate) data: Mutex<Option<InboxData>>,
    pub(crate) last_error: Mutex<Option<String>>,
    pub(crate) last_updated_at_ms: Mutex<Option<u64>>,
    pub(crate) poll_now: Arc<Notify>,
}

impl InboxState {
    pub fn new() -> Self {
        Self {
            is_offline: AtomicBool::new(false),
            unread_count: AtomicUsize::new(0),
            consecutive_failures: AtomicUsize::new(0),
            data: Mutex::new(None),
            last_error: Mutex::new(None),
            last_updated_at_ms: Mutex::new(None),
            poll_now: Arc::new(Notify::new()),
        }
    }

    /// Updates the state based on polling success/failure.
    /// Returns (status_changed, is_offline, count)
    pub fn update(&self, success: bool) -> (bool, bool, usize) {
        let count = self.unread_count.load(Ordering::Relaxed);

        if success {
            self.consecutive_failures.store(0, Ordering::Relaxed);
            let was_offline = self.is_offline.swap(false, Ordering::Relaxed);
            // Clear error on success
            *lock_or_recover(&self.last_error, "InboxState last_error") = None;
            return (was_offline, false, count);
        }

        let failures = self.consecutive_failures.fetch_add(1, Ordering::Relaxed) + 1;
        let mut changed = false;
        if failures >= CONSECUTIVE_FAILURE_THRESHOLD {
            let was_offline = self.is_offline.swap(true, Ordering::Relaxed);
            changed = !was_offline;
        }

        (changed, self.is_offline.load(Ordering::Relaxed), count)
    }

    pub fn set_count(&self, new_count: usize) -> (bool, bool, usize) {
        let previous = self.unread_count.swap(new_count, Ordering::Relaxed);
        let is_offline = self.is_offline.load(Ordering::Relaxed);

        if previous != new_count {
            return (true, is_offline, new_count);
        }
        (false, is_offline, previous)
    }

    pub fn set_data(&self, new_data: InboxData) {
        let mut data = lock_or_recover(&self.data, "InboxState data");
        *data = Some(new_data);
    }

    pub fn set_error(&self, error: String) {
        let mut last_error = lock_or_recover(&self.last_error, "InboxState last_error");
        *last_error = Some(error);
    }

    pub fn clear_error(&self) {
        let mut last_error = lock_or_recover(&self.last_error, "InboxState last_error");
        *last_error = None;
    }

    pub fn set_status(&self, status: ConnectionStatus) {
        let is_offline = matches!(status, ConnectionStatus::Offline);
        self.is_offline.store(is_offline, Ordering::Relaxed);
    }

    pub fn is_offline(&self) -> bool {
        self.is_offline.load(Ordering::Relaxed)
    }

    pub fn set_last_updated_at_ms(&self, last_updated_at_ms: Option<u64>) {
        let mut last_updated = lock_or_recover(&self.last_updated_at_ms, "InboxState last_updated");
        *last_updated = last_updated_at_ms;
    }

    pub fn get_last_updated_at_ms(&self) -> Option<u64> {
        let last_updated = lock_or_recover(&self.last_updated_at_ms, "InboxState last_updated");
        *last_updated
    }
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_else(|_| Duration::from_secs(0))
        .as_millis() as u64
}

fn get_inbox_store<R: Runtime>(app: &AppHandle<R>) -> Option<Arc<Store<R>>> {
    if let Some(store) = app.get_store(INBOX_CACHE_FILE_NAME) {
        return Some(store);
    }

    app.store_builder(INBOX_CACHE_FILE_NAME)
        .auto_save(Duration::from_millis(INBOX_CACHE_WRITE_DEBOUNCE_MS))
        .build()
        .ok()
}

fn read_store_value<T: DeserializeOwned, R: Runtime>(store: &Store<R>, key: &str) -> Option<T> {
    let value = store.get(key)?;
    serde_json::from_value(value).ok()
}

fn write_store_value<T: serde::Serialize, R: Runtime>(
    store: &Store<R>,
    key: &str,
    value: &T,
) -> Option<()> {
    let json = serde_json::to_value(value).ok()?;
    store.set(key, json);
    Some(())
}

fn emit_inbox_stale<R: Runtime>(app: &AppHandle<R>, payload: InboxStalePayload) {
    let _ = app.emit("inbox-stale", payload);
}

fn load_cached_inbox<R: Runtime>(app: &AppHandle<R>) {
    let store = match get_inbox_store(app) {
        Some(store) => store,
        None => return,
    };

    let cached_data: Option<InboxData> = read_store_value(&store, INBOX_CACHE_KEY_DATA);
    let last_updated_at_ms: Option<u64> = read_store_value(&store, INBOX_CACHE_KEY_LAST_UPDATED_MS);
    let unread_count: Option<usize> = read_store_value(&store, INBOX_CACHE_KEY_UNREAD_COUNT);
    let is_offline: Option<bool> = read_store_value(&store, INBOX_CACHE_KEY_CONNECTION_STATUS);
    let last_error: Option<String> = read_store_value(&store, INBOX_CACHE_KEY_LAST_ERROR);

    let state = app.state::<InboxState>();

    if let Some(data) = cached_data {
        state.set_data(data.clone());
        state.set_last_updated_at_ms(last_updated_at_ms);
        if let Some(true) = is_offline {
            state.set_status(ConnectionStatus::Offline);
        }
        if let Some(count) = unread_count {
            update_count(app, count);
        }
        if let Some(error) = last_error.clone() {
            state.set_error(error);
        }

        let _ = app.emit("inbox-updated", data);

        let has_last_error = matches!(last_error, Some(_));
        let is_stale = last_updated_at_ms
            .map(|ts| now_ms().saturating_sub(ts) >= INBOX_CACHE_STALE_THRESHOLD_MS)
            .unwrap_or(true)
            || has_last_error;

        emit_inbox_stale(
            app,
            InboxStalePayload {
                is_stale,
                is_offline: state.is_offline(),
                last_updated_at_ms,
                last_error,
            },
        );

        let cached_count = unread_count.unwrap_or_else(|| state.unread_count.load(Ordering::Relaxed));
        update_badge(app, cached_count, state.is_offline());
        return;
    }

    let desired_offline = is_offline.unwrap_or(true);
    let previous_offline = state.is_offline();
    state.set_status(if desired_offline {
        ConnectionStatus::Offline
    } else {
        ConnectionStatus::Connected
    });
    if let Some(error) = last_error {
        state.set_error(error);
    }

    if previous_offline != desired_offline {
        let _ = app.emit("connection-status-changed", desired_offline);
    }

    update_badge(app, unread_count.unwrap_or(0), desired_offline);
}

fn persist_cache_success<R: Runtime>(
    app: &AppHandle<R>,
    data: &InboxData,
    unread_count: usize,
    last_updated_at_ms: u64,
) {
    let store = match get_inbox_store(app) {
        Some(store) => store,
        None => return,
    };

    let _ = write_store_value(&store, INBOX_CACHE_KEY_DATA, data);
    let _ = write_store_value(&store, INBOX_CACHE_KEY_LAST_UPDATED_MS, &last_updated_at_ms);
    let _ = write_store_value(&store, INBOX_CACHE_KEY_UNREAD_COUNT, &unread_count);
    let _ = write_store_value(&store, INBOX_CACHE_KEY_CONNECTION_STATUS, &false);
    store.delete(INBOX_CACHE_KEY_LAST_ERROR);
}

fn persist_cache_failure<R: Runtime>(app: &AppHandle<R>, error: &str, is_offline: bool) {
    let store = match get_inbox_store(app) {
        Some(store) => store,
        None => return,
    };

    let _ = write_store_value(&store, INBOX_CACHE_KEY_CONNECTION_STATUS, &is_offline);
    let _ = write_store_value(&store, INBOX_CACHE_KEY_LAST_ERROR, &error);
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
            assert!(matches!(*data, Some(_)));
        }
    }

    #[test]
    fn test_inbox_cache_serialization() {
        let mock_data = InboxData {
            merge_requests: vec![],
            todos: vec![],
            pipelines: vec![],
        };
        let json = serde_json::to_value(&mock_data).unwrap();
        let decoded: InboxData = serde_json::from_value(json).unwrap();
        assert_eq!(decoded.merge_requests.len(), 0);
    }

}

pub(crate) fn update_connection_status<R: Runtime>(app: &AppHandle<R>, success: bool) {
    let state = app.state::<InboxState>();
    let (changed, is_offline, count) = state.update(success);

    if changed {
        update_badge(app, count, is_offline);
        let _ = app.emit("connection-status-changed", is_offline);
    }
}

pub(crate) fn set_connection_status<R: Runtime>(app: &AppHandle<R>, is_offline: bool) {
    let state = app.state::<InboxState>();
    let was_offline = state.is_offline();

    state.set_status(if is_offline {
        ConnectionStatus::Offline
    } else {
        ConnectionStatus::Connected
    });

    let count = state.unread_count.load(Ordering::Relaxed);
    update_badge(app, count, is_offline);

    if was_offline != is_offline {
        let _ = app.emit("connection-status-changed", is_offline);
    }
}

pub(crate) fn update_count<R: Runtime>(app: &AppHandle<R>, count: usize) {
    let state = app.state::<InboxState>();
    let (changed, is_offline, _) = state.set_count(count);

    if changed {
        update_badge(app, count, is_offline);
    }
}

pub(crate) fn trigger_poll<R: Runtime>(app: &AppHandle<R>) {
    let state = app.state::<InboxState>();
    state.poll_now.notify_one();
}

#[tauri::command]
pub(crate) fn get_inbox(state: tauri::State<InboxState>) -> Option<InboxData> {
    let data = lock_or_recover(&state.data, "InboxState data");
    data.clone()
}

#[tauri::command]
pub(crate) fn get_connection_status(state: tauri::State<InboxState>) -> bool {
    state.is_offline()
}

#[tauri::command]
pub(crate) fn refresh_inbox(app: AppHandle) {
    trigger_poll(&app);
}

pub(crate) fn start_polling<R: Runtime>(app: &AppHandle<R>) {
    let app_handle = app.clone();
    let poll_now = app.state::<InboxState>().poll_now.clone();

    load_cached_inbox(app);
    
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
                         set_connection_status(&app_handle, true);
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
                    let last_updated_at_ms = now_ms();
                    
                    // Create InboxData struct
                    let inbox_data = InboxData {
                        merge_requests: mrs,
                        todos: todos,
                        pipelines: pipelines,
                    };

                    // Update state
                    update_count(&app_handle, count);
                    update_connection_status(&app_handle, true);
                    app_handle
                        .state::<InboxState>()
                        .set_last_updated_at_ms(Some(last_updated_at_ms));
                    app_handle.state::<InboxState>().clear_error();
                    
                    // Store data in state
                    app_handle.state::<InboxState>().set_data(inbox_data.clone());
                    
                    // Emit data to frontend
                    let _ = app_handle.emit("inbox-updated", &inbox_data);

                    emit_inbox_stale(
                        &app_handle,
                        InboxStalePayload {
                            is_stale: false,
                            is_offline: false,
                            last_updated_at_ms: Some(last_updated_at_ms),
                            last_error: None,
                        },
                    );
                    
                    // Store handles throttling via auto_save, so we always update the in-memory state
                    persist_cache_success(&app_handle, &inbox_data, count, last_updated_at_ms);
                    
                    if !error_msg.is_empty() {
                        // Log partial error
                        eprintln!("Partial polling failure: {}", error_msg);
                        app_handle.state::<InboxState>().set_error(error_msg.clone());
                    }
                } else {
                    // Both failed
                    eprintln!("Polling failed: {}", error_msg);
                    app_handle.state::<InboxState>().set_error(error_msg.clone());
                    let _ = app_handle.emit("inbox-error", &error_msg);

                    update_connection_status(&app_handle, false);

                    let state = app_handle.state::<InboxState>();
                    let is_offline = state.is_offline();
                    persist_cache_failure(&app_handle, &error_msg, is_offline);
                    emit_inbox_stale(
                        &app_handle,
                        InboxStalePayload {
                            is_stale: true,
                            is_offline,
                            last_updated_at_ms: state.get_last_updated_at_ms(),
                            last_error: Some(error_msg),
                        },
                    );
                }
            }
        }
    });
}
