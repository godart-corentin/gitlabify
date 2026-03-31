use std::collections::HashSet;
use std::future::Future;
use std::sync::{atomic::Ordering, Arc};

use tauri::{AppHandle, Emitter, Manager, Runtime};
use tauri_plugin_keyring::KeyringExt;
use tracing::{debug, error, info, warn};

use crate::modules::constants::{GITLAB_HOST, OAUTH_REFRESH_TOKEN_KEY, PAT_KEY, SERVICE_NAME};
use crate::modules::gitlab::{GitLabClient, GitLabError, InboxData};
use crate::modules::oauth::{delete_refresh_token, refresh_access_token, store_refresh_token};
use crate::modules::utils::lock_or_recover;

use super::cache::{get_cached_inbox_data, now_ms, persist_cache_failure, persist_cache_success};
use super::error::InboxServiceError;
use super::state::{
    emit_inbox_stale, set_connection_status, update_connection_status, update_count,
    InboxStalePayload, InboxState,
};
use crate::modules::gitlab::MergeRequest;

const DRAFT_TITLE_PREFIXES: [&str; 2] = ["Draft:", "WIP:"];
const TODO_ACTION_COMMENTED: &str = "commented";
const TODO_ACTION_MENTIONED: &str = "mentioned";
const TODO_ACTION_DIRECTLY_ADDRESSED: &str = "directly_addressed";

struct MarkAsDoneLocalUpdate {
    updated_data: InboxData,
    updated_count: usize,
    last_updated_at_ms: u64,
    is_offline: bool,
}

fn is_draft_mr(mr: &MergeRequest) -> bool {
    mr.draft
        || mr.work_in_progress
        || DRAFT_TITLE_PREFIXES
            .iter()
            .any(|prefix| mr.title.starts_with(prefix))
}

fn is_notification_action(action: &str) -> bool {
    matches!(
        action,
        TODO_ACTION_COMMENTED | TODO_ACTION_MENTIONED | TODO_ACTION_DIRECTLY_ADDRESSED
    )
}

pub(crate) struct ClientCache {
    token: Option<String>,
    client: Option<Arc<GitLabClient>>,
}

impl ClientCache {
    pub(crate) fn new() -> Self {
        Self {
            token: None,
            client: None,
        }
    }
}

pub(crate) async fn fetch_inbox_once<R: Runtime>(
    app_handle: &AppHandle<R>,
    cache: &mut ClientCache,
) -> Option<InboxData> {
    let mut allow_refresh_retry = true;

    loop {
        if let Err(error) = resolve_token(app_handle, cache) {
            error!(target: "gitlabify::inbox", %error, "unable to resolve token");
            return get_cached_inbox_data(app_handle);
        }

        if cache.token.is_none() {
            set_connection_status(app_handle, true);
            return get_cached_inbox_data(app_handle);
        }

        if let Err(error) = resolve_client(cache) {
            let message = error.to_string();
            error!(target: "gitlabify::inbox", %message, "unable to initialize GitLab client");
            app_handle.state::<InboxState>().set_error(message.clone());
            let _ = app_handle.emit("inbox-error", message);
            update_connection_status(app_handle, false);
            return get_cached_inbox_data(app_handle);
        }

        let Some(client_arc) = cache.client.as_ref() else {
            return get_cached_inbox_data(app_handle);
        };

        let mrs_future = client_arc.fetch_merge_requests();
        let todos_future = client_arc.fetch_todos();
        let (mrs_result, todos_result) = tokio::join!(mrs_future, todos_future);

        let mut current_user_id: Option<u64> = None;
        let mut merge_requests = Vec::new();
        let mut todos = Vec::new();
        let mut pipelines = Vec::new();
        let mut notification_ids = HashSet::new();
        let mut error_message = String::new();
        let mut has_success = false;
        let mut needs_reauth = false;

        match mrs_result {
            Ok((fetched_mrs, user)) => {
                has_success = true;
                let user_id = user.id;
                current_user_id = Some(user.id);
                let mut pipeline_ids = HashSet::new();
                let mut join_set = tokio::task::JoinSet::new();
                let mut pending_fetches: HashSet<(u64, String)> = HashSet::new();

                for mr in &fetched_mrs {
                    if mr.author.id != user_id {
                        let qualifies = mr.is_reviewer
                            && !mr.approved_by_me
                            && !mr.reviewed_by_me
                            && !is_draft_mr(mr);
                        if qualifies {
                            notification_ids.insert(mr.id);
                        }
                        continue;
                    }

                    if let Some(pipeline) = &mr.head_pipeline {
                        if pipeline_ids.insert(pipeline.id) {
                            pipelines.push(pipeline.clone());
                        }
                        continue;
                    }

                    if let Some(ref_name) = mr.source_branch.as_deref() {
                        let key = (mr.project_id, ref_name.to_string());
                        if !pending_fetches.insert(key.clone()) {
                            continue;
                        }

                        let client = Arc::clone(client_arc);
                        let project_id = mr.project_id;
                        let ref_name_owned = ref_name.to_string();
                        let username = user.username.clone();

                        join_set.spawn(async move {
                            client
                                .fetch_latest_pipeline_for_project_ref(
                                    project_id,
                                    &ref_name_owned,
                                    &username,
                                )
                                .await
                        });
                    }
                }

                while let Some(joined) = join_set.join_next().await {
                    match joined {
                        Ok(Ok(Some(pipeline))) => {
                            if pipeline_ids.insert(pipeline.id) {
                                pipelines.push(pipeline);
                            }
                        }
                        Ok(Ok(None)) => {}
                        Ok(Err(GitLabError::Unauthorized)) => {
                            error_message.push_str("Pipeline access unauthorized; ");
                        }
                        Ok(Err(error)) => {
                            error_message.push_str(&format!("Pipeline fetch error: {error}; "));
                        }
                        Err(join_error) => {
                            error_message.push_str(&format!("Join error: {join_error}; "));
                        }
                    }
                }

                info!(
                    target: "gitlabify::inbox",
                    pipelines = pipelines.len(),
                    merge_requests = fetched_mrs.len(),
                    user_id,
                    "inbox merge request fetch completed"
                );

                merge_requests = fetched_mrs;
            }
            Err(GitLabError::Unauthorized) => {
                needs_reauth = true;
            }
            Err(error) => {
                error_message.push_str(&format!("MRs: {error}; "));
            }
        }

        match todos_result {
            Ok(fetched_todos) => {
                has_success = true;
                for todo in &fetched_todos {
                    let action = todo.action_name.to_lowercase();
                    let is_self = current_user_id
                        .map(|id| todo.author.id == id)
                        .unwrap_or(false);

                    if is_notification_action(&action) && !is_self {
                        if let Some(target) = &todo.target {
                            notification_ids.insert(target.id);
                        }
                    }
                }
                todos = fetched_todos;
            }
            Err(GitLabError::Unauthorized) => {
                needs_reauth = true;
            }
            Err(error) => {
                error_message.push_str(&format!("Todos: {error}; "));
            }
        }

        if needs_reauth {
            if allow_refresh_retry && refresh_cached_oauth_session(app_handle, cache).await {
                allow_refresh_retry = false;
                continue;
            }

            warn!(target: "gitlabify::inbox", "unauthorized response; clearing auth state");
            clear_auth_and_require_login(app_handle, cache);
            update_connection_status(app_handle, false);
            return None;
        }

        if has_success {
            let count = notification_ids.len();
            let last_updated_at_ms = now_ms();
            let inbox_data = InboxData {
                merge_requests,
                todos,
                pipelines,
            };

            update_count(app_handle, count);
            update_connection_status(app_handle, true);
            app_handle
                .state::<InboxState>()
                .set_last_updated_at_ms(Some(last_updated_at_ms));
            app_handle.state::<InboxState>().clear_error();
            app_handle
                .state::<InboxState>()
                .set_data(inbox_data.clone());

            let _ = app_handle.emit("inbox-updated", &inbox_data);
            emit_inbox_stale(
                app_handle,
                InboxStalePayload {
                    is_stale: false,
                    is_offline: false,
                    last_updated_at_ms: Some(last_updated_at_ms),
                    last_error: None,
                },
            );

            persist_cache_success(app_handle, &inbox_data, count, last_updated_at_ms);

            if !error_message.is_empty() {
                warn!(target: "gitlabify::inbox", %error_message, "partial polling failure");
                app_handle.state::<InboxState>().set_error(error_message);
            }

            return Some(inbox_data);
        }

        error!(target: "gitlabify::inbox", %error_message, "polling failed");
        app_handle
            .state::<InboxState>()
            .set_error(error_message.clone());
        let _ = app_handle.emit("inbox-error", &error_message);

        update_connection_status(app_handle, false);

        let state = app_handle.state::<InboxState>();
        let is_offline = state.is_offline();
        let cached_data = get_cached_inbox_data(app_handle);
        let has_cached_data = cached_data.is_some();

        persist_cache_failure(app_handle, &error_message, is_offline);
        emit_inbox_stale(
            app_handle,
            InboxStalePayload {
                is_stale: has_cached_data,
                is_offline,
                last_updated_at_ms: state.get_last_updated_at_ms(),
                last_error: Some(error_message),
            },
        );

        return cached_data;
    }
}

pub(crate) async fn mark_as_done<R: Runtime>(
    app_handle: &AppHandle<R>,
    todo_id: u64,
) -> Result<(), InboxServiceError> {
    let token = match app_handle.keyring().get_password(SERVICE_NAME, PAT_KEY) {
        Ok(Some(token)) => token,
        Ok(None) => {
            return Err(InboxServiceError::Fetch(
                "missing token for mark_as_done".to_string(),
            ));
        }
        Err(error) => return Err(InboxServiceError::Keyring(error.to_string())),
    };

    let client = Arc::new(
        GitLabClient::new(GITLAB_HOST.to_string(), token)
            .map_err(|error| InboxServiceError::ClientInit(error.to_string()))?,
    );

    let state = app_handle.state::<InboxState>();
    let local_update = mark_as_done_with_confirmation(&state, todo_id, |confirmed_todo_id| {
        let client = Arc::clone(&client);

        async move {
            client
                .mark_todo_as_done(confirmed_todo_id)
                .await
                .map_err(|error| {
                    InboxServiceError::Fetch(format!(
                        "failed to mark todo {confirmed_todo_id} as done on GitLab: {error}"
                    ))
                })
        }
    })
    .await;

    let local_update = match local_update {
        Ok(update) => update,
        Err(error) => {
            let message = error.to_string();
            warn!(target: "gitlabify::inbox", %message, todo_id, "mark_as_done failed");
            state.set_error(message.clone());
            let _ = app_handle.emit("inbox-error", message);
            return Err(error);
        }
    };

    update_count(app_handle, local_update.updated_count);
    state.set_last_updated_at_ms(Some(local_update.last_updated_at_ms));
    state.clear_error();

    let _ = app_handle.emit("inbox-updated", &local_update.updated_data);
    emit_inbox_stale(
        app_handle,
        InboxStalePayload {
            is_stale: false,
            is_offline: local_update.is_offline,
            last_updated_at_ms: Some(local_update.last_updated_at_ms),
            last_error: None,
        },
    );
    persist_cache_success(
        app_handle,
        &local_update.updated_data,
        local_update.updated_count,
        local_update.last_updated_at_ms,
    );

    Ok(())
}

async fn mark_as_done_with_confirmation<F, Fut>(
    state: &InboxState,
    todo_id: u64,
    mark_remote_done: F,
) -> Result<MarkAsDoneLocalUpdate, InboxServiceError>
where
    F: FnOnce(u64) -> Fut,
    Fut: Future<Output = Result<(), InboxServiceError>>,
{
    ensure_todo_exists_in_local_state(state, todo_id)?;
    mark_remote_done(todo_id).await?;
    remove_todo_from_local_state(state, todo_id)
}

fn ensure_todo_exists_in_local_state(
    state: &InboxState,
    todo_id: u64,
) -> Result<(), InboxServiceError> {
    let data_guard = lock_or_recover(&state.data, "InboxState data");
    let inbox_data = data_guard
        .as_ref()
        .ok_or_else(|| InboxServiceError::Fetch("inbox data is unavailable".to_string()))?;

    let todo_exists = inbox_data.todos.iter().any(|todo| todo.id == todo_id);
    if !todo_exists {
        return Err(InboxServiceError::Fetch(format!("todo {todo_id} not found")));
    }

    Ok(())
}

fn remove_todo_from_local_state(
    state: &InboxState,
    todo_id: u64,
) -> Result<MarkAsDoneLocalUpdate, InboxServiceError> {
    let mut data_guard = lock_or_recover(&state.data, "InboxState data");
    let inbox_data = data_guard
        .as_mut()
        .ok_or_else(|| InboxServiceError::Fetch("inbox data is unavailable".to_string()))?;

    let original_len = inbox_data.todos.len();
    inbox_data.todos.retain(|todo| todo.id != todo_id);
    let removed_count = original_len.saturating_sub(inbox_data.todos.len());
    if removed_count == 0 {
        return Err(InboxServiceError::Fetch(format!("todo {todo_id} not found")));
    }

    let current_count = state.unread_count.load(Ordering::Relaxed);
    Ok(MarkAsDoneLocalUpdate {
        updated_data: inbox_data.clone(),
        updated_count: current_count.saturating_sub(removed_count),
        last_updated_at_ms: now_ms(),
        is_offline: state.is_offline(),
    })
}

fn resolve_token<R: Runtime>(
    app_handle: &AppHandle<R>,
    cache: &mut ClientCache,
) -> Result<(), InboxServiceError> {
    if cache.token.is_some() {
        return Ok(());
    }

    match app_handle.keyring().get_password(SERVICE_NAME, PAT_KEY) {
        Ok(Some(token)) => {
            cache.token = Some(token);
            Ok(())
        }
        Ok(None) => Ok(()),
        Err(error) => Err(InboxServiceError::Keyring(error.to_string())),
    }
}

fn resolve_client(cache: &mut ClientCache) -> Result<(), InboxServiceError> {
    if cache.client.is_some() {
        return Ok(());
    }

    let token = cache
        .token
        .as_ref()
        .ok_or_else(|| InboxServiceError::Fetch("missing token".to_string()))?
        .clone();

    let host = GITLAB_HOST.to_string();
    let client = GitLabClient::new(host, token)
        .map_err(|error| InboxServiceError::ClientInit(error.to_string()))?;

    cache.client = Some(Arc::new(client));
    Ok(())
}

fn clear_auth_and_require_login<R: Runtime>(app_handle: &AppHandle<R>, cache: &mut ClientCache) {
    cache.token = None;
    cache.client = None;
    app_handle
        .state::<InboxState>()
        .set_error("Unauthorized".to_string());

    if let Err(error) = app_handle.keyring().delete_password(SERVICE_NAME, PAT_KEY) {
        warn!(target: "gitlabify::inbox", %error, "failed to delete token from keyring");
    }

    let _ = delete_refresh_token(app_handle);
    let _ = app_handle.emit("auth-required", ());
}

async fn refresh_cached_oauth_session<R: Runtime>(
    app_handle: &AppHandle<R>,
    cache: &mut ClientCache,
) -> bool {
    let refresh_token = match app_handle
        .keyring()
        .get_password(SERVICE_NAME, OAUTH_REFRESH_TOKEN_KEY)
    {
        Ok(token) => token,
        Err(error) => {
            warn!(target: "gitlabify::inbox", %error, "failed to read refresh token from keyring");
            return false;
        }
    };

    let Some(refresh_token) = refresh_token else {
        return false;
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
                let _ = delete_refresh_token(app_handle);
            }
            warn!(target: "gitlabify::inbox", %error_message, "oauth refresh attempt failed");
            return false;
        }
    };

    if let Err(error) =
        app_handle
            .keyring()
            .set_password(SERVICE_NAME, PAT_KEY, &refreshed.access_token)
    {
        warn!(target: "gitlabify::inbox", %error, "failed to persist refreshed access token");
        return false;
    }

    let refresh_token_to_store = refreshed
        .refresh_token
        .as_deref()
        .unwrap_or(refresh_token.as_str());
    if let Err(error) = store_refresh_token(app_handle, Some(refresh_token_to_store)) {
        warn!(target: "gitlabify::inbox", %error, "failed to persist refreshed oauth tokens");
        return false;
    }

    debug!(target: "gitlabify::inbox", "oauth refresh succeeded, retrying inbox fetch once");
    cache.token = Some(refreshed.access_token);
    cache.client = None;
    true
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;
    use std::sync::atomic::{AtomicU64, Ordering};

    use crate::modules::gitlab::InboxData;
    use crate::modules::utils::lock_or_recover;

    use super::{InboxServiceError, InboxState, mark_as_done_with_confirmation};

    fn create_inbox_data(todo_ids: &[u64]) -> InboxData {
        serde_json::from_value(serde_json::json!({
            "mergeRequests": [],
            "todos": todo_ids
                .iter()
                .map(|id| serde_json::json!({
                    "id": id,
                    "project_id": 1,
                    "author": {
                        "id": 7,
                        "name": "Reviewer",
                        "username": "reviewer",
                        "avatar_url": null
                    },
                    "action_name": super::TODO_ACTION_MENTIONED,
                    "target_type": "MergeRequest",
                    "target_url": format!("https://gitlab.com/example/repo/-/merge_requests/{id}"),
                    "target": null,
                    "body": format!("todo {id}"),
                    "state": "pending",
                    "created_at": "2026-03-31T10:00:00.000Z"
                }))
                .collect::<Vec<_>>(),
            "pipelines": []
        }))
        .expect("test inbox data should deserialize")
    }

    fn create_state_with_todos(todo_ids: &[u64]) -> InboxState {
        let state = InboxState::new();
        state.set_data(create_inbox_data(todo_ids));
        state.unread_count.store(todo_ids.len(), Ordering::Relaxed);
        state
    }

    #[tokio::test]
    async fn mark_as_done_updates_local_state_after_remote_success() {
        let state = create_state_with_todos(&[42, 84]);
        let confirmed_todo_id = Arc::new(AtomicU64::new(0));
        let confirmed_todo_id_for_remote = Arc::clone(&confirmed_todo_id);

        let local_update =
            mark_as_done_with_confirmation(&state, 42, move |remote_todo_id| async move {
                confirmed_todo_id_for_remote.store(remote_todo_id, Ordering::Relaxed);
                Ok(())
            })
            .await
            .expect("remote success should allow local update");

        assert_eq!(confirmed_todo_id.load(Ordering::Relaxed), 42);
        assert_eq!(local_update.updated_count, 1);
        assert_eq!(local_update.updated_data.todos.len(), 1);
        assert_eq!(local_update.updated_data.todos[0].id, 84);

        let stored_data = lock_or_recover(&state.data, "test inbox data")
            .clone()
            .expect("state data should exist in test");
        assert_eq!(stored_data.todos.len(), 1);
        assert_eq!(stored_data.todos[0].id, 84);
    }

    #[tokio::test]
    async fn mark_as_done_keeps_local_state_when_remote_confirmation_fails() {
        let state = create_state_with_todos(&[42, 84]);

        let result = mark_as_done_with_confirmation(&state, 42, |_remote_todo_id| async {
            Err(InboxServiceError::Fetch("gitlab request failed".to_string()))
        })
        .await;

        assert!(matches!(result, Err(InboxServiceError::Fetch(message)) if message == "gitlab request failed"));

        let stored_data = lock_or_recover(&state.data, "test inbox data")
            .clone()
            .expect("state data should exist in test");
        assert_eq!(stored_data.todos.len(), 2);
        assert_eq!(stored_data.todos[0].id, 42);
        assert_eq!(stored_data.todos[1].id, 84);
    }

    #[tokio::test]
    async fn mark_as_done_does_not_call_remote_when_local_todo_is_missing() {
        let state = create_state_with_todos(&[84]);
        let remote_call_count = Arc::new(AtomicU64::new(0));
        let remote_call_count_for_remote = Arc::clone(&remote_call_count);

        let result =
            mark_as_done_with_confirmation(&state, 42, move |_remote_todo_id| async move {
                remote_call_count_for_remote.fetch_add(1, Ordering::Relaxed);
                Ok(())
            })
            .await;

        assert!(matches!(result, Err(InboxServiceError::Fetch(message)) if message == "todo 42 not found"));
        assert_eq!(remote_call_count.load(Ordering::Relaxed), 0);

        let stored_data = lock_or_recover(&state.data, "test inbox data")
            .clone()
            .expect("state data should exist in test");
        assert_eq!(stored_data.todos.len(), 1);
        assert_eq!(stored_data.todos[0].id, 84);
    }
}
