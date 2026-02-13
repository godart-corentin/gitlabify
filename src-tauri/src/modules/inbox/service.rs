use std::collections::HashSet;
use std::sync::Arc;

use tauri::{AppHandle, Emitter, Manager, Runtime};
use tauri_plugin_keyring::KeyringExt;
use tracing::{debug, error, info, warn};

use crate::modules::constants::{GITLAB_HOST, OAUTH_REFRESH_TOKEN_KEY, PAT_KEY, SERVICE_NAME};
use crate::modules::gitlab::{GitLabClient, GitLabError, InboxData};
use crate::modules::oauth::{delete_refresh_token, refresh_access_token, store_refresh_token};

use super::cache::{get_cached_inbox_data, now_ms, persist_cache_failure, persist_cache_success};
use super::error::InboxServiceError;
use super::state::{
    emit_inbox_stale, set_connection_status, update_connection_status, update_count,
    InboxStalePayload, InboxState,
};

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
                let mut pipeline_ids = HashSet::new();
                let mut join_set = tokio::task::JoinSet::new();
                let mut pending_fetches: HashSet<(u64, String)> = HashSet::new();

                for mr in &fetched_mrs {
                    if mr.author.id != user_id {
                        notification_ids.insert(mr.id);
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
                    if let Some(target) = &todo.target {
                        notification_ids.insert(target.id);
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
