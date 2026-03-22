use reqwest::{Client, StatusCode, Url};
use serde::Deserialize;
use std::collections::HashSet;
use std::time::Duration;
use tracing::warn;

use crate::modules::constants::{
    GITLAB_API_MAX_RETRIES, GITLAB_API_RETRY_BASE_DELAY_MS, HTTP_TIMEOUT_SECS, PIPELINE_PAGE_SIZE,
};

use super::error::GitLabError;
use super::models::{
    Author, Discussion, MergeRequest, MergeRequestApprovals, MergeRequestReviewerStatus, Pipeline,
    Todo,
};
use super::parse::{
    extract_merge_request_iid, is_comment_or_mention_action, resolve_project_ref, ProjectRef,
};

const REVIEWED_REVIEWER_STATE: &str = "reviewed";

pub(crate) struct GitLabClient {
    client: Client,
    host: String,
    token: String,
}

impl GitLabClient {
    pub(crate) fn new(host: String, token: String) -> Result<Self, GitLabError> {
        let client = Client::builder()
            .user_agent("gitlabify")
            .timeout(Duration::from_secs(HTTP_TIMEOUT_SECS))
            .build()
            .map_err(GitLabError::Network)?;

        Ok(Self {
            client,
            host,
            token,
        })
    }

    pub(crate) async fn fetch_current_user(&self) -> Result<Author, GitLabError> {
        let url = format!("{}/api/v4/user", self.host);
        self.get_json::<Author>(&url).await
    }

    pub(crate) async fn fetch_merge_requests(
        &self,
    ) -> Result<(Vec<MergeRequest>, Author), GitLabError> {
        let user = self.fetch_current_user().await?;
        let user_id = user.id;

        let reviewer_url = format!(
            "{}/api/v4/merge_requests?scope=all&state=opened&reviewer_id={}",
            self.host, user_id
        );
        let assignee_url = format!(
            "{}/api/v4/merge_requests?scope=all&state=opened&assignee_id={}",
            self.host, user_id
        );
        let author_url = format!(
            "{}/api/v4/merge_requests?scope=all&state=opened&author_id={}",
            self.host, user_id
        );

        let (reviewer_res, assignee_res, author_res) = tokio::join!(
            self.get_json::<Vec<MergeRequest>>(&reviewer_url),
            self.get_json::<Vec<MergeRequest>>(&assignee_url),
            self.get_json::<Vec<MergeRequest>>(&author_url)
        );

        let mut reviewer_mrs = reviewer_res?;
        for mr in &mut reviewer_mrs {
            mr.is_reviewer = true;
            mr.reviewed_by_me = false;
        }

        let mut all_mrs = reviewer_mrs;
        let assignee_mrs = assignee_res?;
        let author_mrs = author_res?;
        let mut seen_ids: HashSet<u64> = all_mrs.iter().map(|mr| mr.id).collect();

        for mr in assignee_mrs {
            if seen_ids.insert(mr.id) {
                all_mrs.push(mr);
            }
        }

        for mr in author_mrs {
            if seen_ids.insert(mr.id) {
                all_mrs.push(mr);
            }
        }

        for mr in &mut all_mrs {
            if mr.is_reviewer {
                let (approvals_result, reviewers_result) = tokio::join!(
                    self.fetch_merge_request_approvals(mr.project_id, mr.iid),
                    self.fetch_merge_request_reviewers(mr.project_id, mr.iid)
                );

                match approvals_result {
                    Ok(approvals) => {
                        mr.approved_by_me = approvals
                            .approved_by
                            .iter()
                            .any(|entry| entry.user.id == user_id);
                    }
                    Err(GitLabError::Unauthorized) => {
                        warn!(
                            target: "gitlabify::gitlab",
                            project_id = mr.project_id,
                            iid = mr.iid,
                            "approvals unauthorized; skipping"
                        );
                    }
                    Err(error) => {
                        warn!(
                            target: "gitlabify::gitlab",
                            project_id = mr.project_id,
                            iid = mr.iid,
                            %error,
                            "approvals fetch error; skipping"
                        );
                    }
                }

                match reviewers_result {
                    Ok(reviewers) => {
                        mr.reviewed_by_me = did_user_review_mr(&reviewers, user_id);
                    }
                    Err(GitLabError::Unauthorized) => {
                        warn!(
                            target: "gitlabify::gitlab",
                            project_id = mr.project_id,
                            iid = mr.iid,
                            "reviewers unauthorized; skipping"
                        );
                    }
                    Err(error) => {
                        warn!(
                            target: "gitlabify::gitlab",
                            project_id = mr.project_id,
                            iid = mr.iid,
                            %error,
                            "reviewers fetch error; skipping"
                        );
                    }
                }
            } else if mr.author.id == user_id {
                let (approvals_result, discussions_result) = tokio::join!(
                    self.fetch_merge_request_approvals(mr.project_id, mr.iid),
                    self.fetch_merge_request_discussions(mr.project_id, mr.iid)
                );

                match approvals_result {
                    Ok(approvals) => {
                        mr.approval_count = approvals.approved_by.len() as u32;
                    }
                    Err(GitLabError::Unauthorized) => {
                        warn!(
                            target: "gitlabify::gitlab",
                            project_id = mr.project_id,
                            iid = mr.iid,
                            "approvals unauthorized; skipping"
                        );
                    }
                    Err(error) => {
                        warn!(
                            target: "gitlabify::gitlab",
                            project_id = mr.project_id,
                            iid = mr.iid,
                            %error,
                            "approvals fetch error; skipping"
                        );
                    }
                }

                match discussions_result {
                    Ok(discussions) => {
                        mr.unresolved_discussion_count = count_unresolved_discussions(&discussions);
                    }
                    Err(GitLabError::Unauthorized) => {
                        warn!(
                            target: "gitlabify::gitlab",
                            project_id = mr.project_id,
                            iid = mr.iid,
                            "discussions unauthorized; skipping"
                        );
                    }
                    Err(error) => {
                        warn!(
                            target: "gitlabify::gitlab",
                            project_id = mr.project_id,
                            iid = mr.iid,
                            %error,
                            "discussions fetch error; skipping"
                        );
                    }
                }
            }
        }

        Ok((all_mrs, user))
    }

    pub(crate) async fn fetch_todos(&self) -> Result<Vec<Todo>, GitLabError> {
        let url = format!("{}/api/v4/todos?state=pending&type=MergeRequest", self.host);
        let mut todos = self.get_json::<Vec<Todo>>(&url).await?;

        for todo in &mut todos {
            if todo.target.as_ref().is_some() {
                continue;
            }

            if todo.target_type != "MergeRequest" {
                continue;
            }

            let Some(target_url) = todo.target_url.as_deref() else {
                continue;
            };

            let Some(iid) = extract_merge_request_iid(target_url) else {
                continue;
            };

            let Some(project) = resolve_project_ref(todo.project_id, target_url) else {
                continue;
            };

            let resolved = match project {
                ProjectRef::Id(id) => self.fetch_merge_request(id, iid).await,
                ProjectRef::Path(path) => self.fetch_merge_request_by_path(&path, iid).await,
            };

            match resolved {
                Ok(mr) => {
                    todo.target = Some(mr);
                }
                Err(GitLabError::Unauthorized) => {
                    warn!(target: "gitlabify::gitlab", iid, "unauthorized while resolving todo target");
                }
                Err(error) => {
                    warn!(target: "gitlabify::gitlab", iid, %error, "failed to resolve todo target");
                }
            }
        }

        let filtered_todos = todos
            .into_iter()
            .filter(|todo| {
                if let Some(target) = &todo.target {
                    return target.state == "opened";
                }

                if let Some(target_url) = &todo.target_url {
                    return is_comment_or_mention_action(&todo.action_name)
                        && !target_url.is_empty();
                }

                false
            })
            .collect();

        Ok(filtered_todos)
    }

    #[allow(dead_code)]
    pub(crate) async fn fetch_pipelines(&self) -> Result<Vec<Pipeline>, GitLabError> {
        let url = format!("{}/api/v4/pipelines?scope=branches", self.host);
        self.get_json::<Vec<Pipeline>>(&url).await
    }

    pub(crate) async fn fetch_latest_pipeline_for_project_ref(
        &self,
        project_id: u64,
        ref_name: &str,
        username: &str,
    ) -> Result<Option<Pipeline>, GitLabError> {
        let base_url = format!("{}/api/v4/projects/{}/pipelines", self.host, project_id);
        let mut url = Url::parse(&base_url)
            .map_err(|error| GitLabError::Api(format!("Invalid pipelines URL: {error}")))?;

        url.query_pairs_mut()
            .append_pair("ref", ref_name)
            .append_pair("username", username)
            .append_pair("order_by", "updated_at")
            .append_pair("sort", "desc")
            .append_pair("per_page", &PIPELINE_PAGE_SIZE.to_string());

        let pipelines = self.get_json::<Vec<Pipeline>>(url.as_str()).await?;
        Ok(pipelines.into_iter().next())
    }

    pub(crate) async fn fetch_merge_request(
        &self,
        project_id: u64,
        merge_request_iid: u64,
    ) -> Result<MergeRequest, GitLabError> {
        let url = format!(
            "{}/api/v4/projects/{}/merge_requests/{}",
            self.host, project_id, merge_request_iid
        );
        self.get_json::<MergeRequest>(&url).await
    }

    pub(crate) async fn fetch_merge_request_by_path(
        &self,
        project_path: &str,
        merge_request_iid: u64,
    ) -> Result<MergeRequest, GitLabError> {
        let encoded = urlencoding::encode(project_path);
        let url = format!(
            "{}/api/v4/projects/{}/merge_requests/{}",
            self.host, encoded, merge_request_iid
        );
        self.get_json::<MergeRequest>(&url).await
    }

    pub(crate) async fn fetch_merge_request_approvals(
        &self,
        project_id: u64,
        merge_request_iid: u64,
    ) -> Result<MergeRequestApprovals, GitLabError> {
        let url = format!(
            "{}/api/v4/projects/{}/merge_requests/{}/approvals",
            self.host, project_id, merge_request_iid
        );
        self.get_json::<MergeRequestApprovals>(&url).await
    }

    pub(crate) async fn fetch_merge_request_reviewers(
        &self,
        project_id: u64,
        merge_request_iid: u64,
    ) -> Result<Vec<MergeRequestReviewerStatus>, GitLabError> {
        let url = format!(
            "{}/api/v4/projects/{}/merge_requests/{}/reviewers",
            self.host, project_id, merge_request_iid
        );
        self.get_json::<Vec<MergeRequestReviewerStatus>>(&url).await
    }

    pub(crate) async fn fetch_merge_request_discussions(
        &self,
        project_id: u64,
        merge_request_iid: u64,
    ) -> Result<Vec<Discussion>, GitLabError> {
        let url = format!(
            "{}/api/v4/projects/{}/merge_requests/{}/discussions?per_page=100",
            self.host, project_id, merge_request_iid
        );
        self.get_json::<Vec<Discussion>>(&url).await
    }

    pub(crate) async fn mark_todo_as_done(&self, todo_id: u64) -> Result<(), GitLabError> {
        let url = format!("{}/api/v4/todos/{todo_id}/mark_as_done", self.host);
        self.post_empty(&url).await
    }

    async fn get_json<T: for<'de> Deserialize<'de>>(&self, url: &str) -> Result<T, GitLabError> {
        let mut attempt: usize = 0;

        while attempt < GITLAB_API_MAX_RETRIES {
            attempt += 1;
            let request = self.client.get(url).bearer_auth(&self.token);

            match request.send().await {
                Ok(response) => {
                    let status = response.status();

                    if status.is_success() {
                        return response.json::<T>().await.map_err(GitLabError::Network);
                    }

                    if status == StatusCode::UNAUTHORIZED {
                        return Err(GitLabError::Unauthorized);
                    }

                    if status == StatusCode::TOO_MANY_REQUESTS {
                        return Err(GitLabError::RateLimited);
                    }

                    if status.is_server_error() && attempt < GITLAB_API_MAX_RETRIES {
                        sleep_backoff(attempt).await;
                        continue;
                    }

                    let body = response
                        .text()
                        .await
                        .unwrap_or_else(|_| "Could not read response body".to_string());
                    return Err(GitLabError::Api(format!("Status: {status} - Body: {body}")));
                }
                Err(error) => {
                    if attempt < GITLAB_API_MAX_RETRIES {
                        sleep_backoff(attempt).await;
                        continue;
                    }
                    return Err(GitLabError::Network(error));
                }
            }
        }

        Err(GitLabError::Api(
            "GitLab request exhausted retries without response".to_string(),
        ))
    }

    async fn post_empty(&self, url: &str) -> Result<(), GitLabError> {
        let mut attempt: usize = 0;

        while attempt < GITLAB_API_MAX_RETRIES {
            attempt += 1;
            let request = self.client.post(url).bearer_auth(&self.token);

            match request.send().await {
                Ok(response) => {
                    let status = response.status();

                    if status.is_success() {
                        return Ok(());
                    }

                    if status == StatusCode::UNAUTHORIZED {
                        return Err(GitLabError::Unauthorized);
                    }

                    if status == StatusCode::TOO_MANY_REQUESTS {
                        return Err(GitLabError::RateLimited);
                    }

                    if status.is_server_error() && attempt < GITLAB_API_MAX_RETRIES {
                        sleep_backoff(attempt).await;
                        continue;
                    }

                    let body = response
                        .text()
                        .await
                        .unwrap_or_else(|_| "Could not read response body".to_string());
                    return Err(GitLabError::Api(format!("Status: {status} - Body: {body}")));
                }
                Err(error) => {
                    if attempt < GITLAB_API_MAX_RETRIES {
                        sleep_backoff(attempt).await;
                        continue;
                    }
                    return Err(GitLabError::Network(error));
                }
            }
        }

        Err(GitLabError::Api(
            "GitLab request exhausted retries without response".to_string(),
        ))
    }
}

fn count_unresolved_discussions(discussions: &[Discussion]) -> u32 {
    discussions
        .iter()
        .filter(|d| d.notes.iter().any(|n| n.resolvable && !n.resolved))
        .count() as u32
}

fn did_user_review_mr(reviewers: &[MergeRequestReviewerStatus], user_id: u64) -> bool {
    reviewers.iter().any(|reviewer| {
        reviewer.user.id == user_id && reviewer.state.eq_ignore_ascii_case(REVIEWED_REVIEWER_STATE)
    })
}

async fn sleep_backoff(attempt: usize) {
    let backoff_ms = GITLAB_API_RETRY_BASE_DELAY_MS.saturating_mul(attempt as u64);
    tokio::time::sleep(Duration::from_millis(backoff_ms)).await;
}

#[cfg(test)]
mod tests {
    use std::io::ErrorKind;
    use std::sync::{
        atomic::{AtomicUsize, Ordering},
        Arc,
    };

    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpListener;

    use super::{count_unresolved_discussions, did_user_review_mr, GitLabClient, GitLabError};
    use crate::modules::constants::GITLAB_HOST;
    use crate::modules::gitlab::models::{MergeRequest, MergeRequestReviewerStatus, Todo};

    struct MockHttpResponse {
        status_line: &'static str,
        content_type: &'static str,
        body: String,
    }

    async fn spawn_mock_server(
        responses: Vec<MockHttpResponse>,
    ) -> std::io::Result<(String, Arc<AtomicUsize>, tokio::task::JoinHandle<()>)> {
        let listener = TcpListener::bind("127.0.0.1:0").await?;
        let local_addr = listener.local_addr()?;
        let accepted_requests = Arc::new(AtomicUsize::new(0));
        let accepted_requests_handle = Arc::clone(&accepted_requests);

        let handle = tokio::spawn(async move {
            for response in responses {
                let (mut socket, _) = listener
                    .accept()
                    .await
                    .expect("mock server should accept connection in test");
                accepted_requests_handle.fetch_add(1, Ordering::Relaxed);

                let mut request_buffer = [0_u8; 8192];
                let _ = socket.read(&mut request_buffer).await;

                let payload = format!(
                    "HTTP/1.1 {}\r\nContent-Type: {}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                    response.status_line,
                    response.content_type,
                    response.body.len(),
                    response.body
                );
                let _ = socket.write_all(payload.as_bytes()).await;
                let _ = socket.shutdown().await;
            }
        });

        Ok((format!("http://{local_addr}"), accepted_requests, handle))
    }

    #[test]
    fn merge_request_deserialization() {
        let json = format!(
            r#"{{
            "id": 1,
            "iid": 101,
            "project_id": 10,
            "title": "Test MR",
            "description": "A test MR",
            "state": "opened",
            "created_at": "2026-01-01T00:00:00Z",
            "updated_at": "2026-01-01T01:00:00Z",
            "web_url": "{}/test/mr/1",
            "author": {{
                "id": 100,
                "name": "Test User",
                "username": "testuser",
                "avatar_url": "{}/uploads/user/avatar/100/avatar.png"
            }},
            "has_conflicts": false,
            "blocking_discussions_resolved": true
        }}"#,
            GITLAB_HOST, GITLAB_HOST
        );

        let mr: MergeRequest =
            serde_json::from_str(&json).expect("merge request json should deserialize in test");
        assert_eq!(mr.title, "Test MR");
        assert_eq!(mr.author.username, "testuser");
        assert!(!mr.reviewed_by_me);
        assert_eq!(mr.approval_count, 0);
        assert_eq!(mr.unresolved_discussion_count, 0);
    }

    #[test]
    fn resolves_reviewer_state_from_gitlab_reviewers_field() {
        let json = r#"[
            {
                "user": { "id": 100 },
                "state": "reviewed"
            },
            {
                "user": { "id": 101 },
                "state": "unreviewed"
            }
        ]"#;

        let reviewers: Vec<MergeRequestReviewerStatus> =
            serde_json::from_str(json).expect("reviewers json should deserialize in test");
        assert!(did_user_review_mr(&reviewers, 100));
        assert!(!did_user_review_mr(&reviewers, 101));
        assert!(!did_user_review_mr(&reviewers, 102));
    }

    #[test]
    fn todo_deserialization() {
        let json = format!(
            r#"{{
            "id": 50,
            "project_id": 10,
            "author": {{
                "id": 100,
                "name": "Test User",
                "username": "testuser",
                "avatar_url": null
            }},
            "action_name": "mentioned",
            "target_type": "MergeRequest",
            "target_url": "{}/test/mr/1",
            "body": "Please review this",
            "state": "pending",
            "created_at": "2026-01-01T00:00:00Z"
        }}"#,
            GITLAB_HOST
        );

        let todo: Todo = serde_json::from_str(&json).expect("todo json should deserialize in test");
        assert_eq!(todo.action_name, "mentioned");
        assert_eq!(todo.author.avatar_url, None);
    }

    #[tokio::test]
    async fn retries_on_server_error_then_succeeds() {
        let responses = vec![
            MockHttpResponse {
                status_line: "500 Internal Server Error",
                content_type: "text/plain",
                body: "temporary failure".to_string(),
            },
            MockHttpResponse {
                status_line: "200 OK",
                content_type: "application/json",
                body: r#"{"id":1,"name":"Test User","username":"tester","avatar_url":null}"#
                    .to_string(),
            },
        ];

        let (host, request_count, server_handle) = match spawn_mock_server(responses).await {
            Ok(value) => value,
            Err(error) if error.kind() == ErrorKind::PermissionDenied => return,
            Err(error) => panic!("mock server setup should succeed: {error}"),
        };
        let client = GitLabClient::new(host, "token".to_string())
            .expect("gitlab client should initialize for retry test");
        let user = client
            .fetch_current_user()
            .await
            .expect("second attempt should succeed");

        assert_eq!(user.username, "tester");
        assert_eq!(request_count.load(Ordering::Relaxed), 2);
        let _ = server_handle.await;
    }

    #[tokio::test]
    async fn does_not_retry_on_unauthorized() {
        let responses = vec![MockHttpResponse {
            status_line: "401 Unauthorized",
            content_type: "text/plain",
            body: "unauthorized".to_string(),
        }];

        let (host, request_count, server_handle) = match spawn_mock_server(responses).await {
            Ok(value) => value,
            Err(error) if error.kind() == ErrorKind::PermissionDenied => return,
            Err(error) => panic!("mock server setup should succeed: {error}"),
        };
        let client = GitLabClient::new(host, "token".to_string())
            .expect("gitlab client should initialize for unauthorized test");
        let result = client.fetch_current_user().await;

        assert!(matches!(result, Err(GitLabError::Unauthorized)));
        assert_eq!(request_count.load(Ordering::Relaxed), 1);
        let _ = server_handle.await;
    }

    #[test]
    fn counts_unresolved_discussion_threads() {
        use crate::modules::gitlab::models::{Discussion, DiscussionNote};

        let discussions = vec![
            // resolvable and unresolved → counts
            Discussion {
                notes: vec![DiscussionNote { resolvable: true, resolved: false }],
            },
            // resolvable and resolved → does not count
            Discussion {
                notes: vec![DiscussionNote { resolvable: true, resolved: true }],
            },
            // not resolvable (system note) → does not count
            Discussion {
                notes: vec![DiscussionNote { resolvable: false, resolved: false }],
            },
            // empty notes → does not count
            Discussion { notes: vec![] },
        ];

        assert_eq!(count_unresolved_discussions(&discussions), 1);
    }

    #[test]
    fn counts_zero_when_all_discussions_resolved() {
        use crate::modules::gitlab::models::{Discussion, DiscussionNote};

        let discussions = vec![
            Discussion {
                notes: vec![DiscussionNote { resolvable: true, resolved: true }],
            },
            Discussion {
                notes: vec![DiscussionNote { resolvable: true, resolved: true }],
            },
        ];

        assert_eq!(count_unresolved_discussions(&discussions), 0);
    }

    #[tokio::test]
    async fn mark_todo_as_done_uses_post_endpoint() {
        let listener = match TcpListener::bind("127.0.0.1:0").await {
            Ok(listener) => listener,
            Err(error) if error.kind() == ErrorKind::PermissionDenied => return,
            Err(error) => panic!("mock server setup should succeed: {error}"),
        };

        let local_addr = match listener.local_addr() {
            Ok(addr) => addr,
            Err(error) => panic!("mock listener local addr should resolve: {error}"),
        };

        let server_handle = tokio::spawn(async move {
            let (mut socket, _) = listener
                .accept()
                .await
                .expect("mock server should accept connection in test");

            let mut request_buffer = [0_u8; 4096];
            let read_size = socket
                .read(&mut request_buffer)
                .await
                .expect("mock server should read request in test");
            let request = String::from_utf8_lossy(&request_buffer[..read_size]);

            assert!(
                request.starts_with("POST /api/v4/todos/42/mark_as_done HTTP/1.1"),
                "expected POST request to mark_as_done endpoint, got: {request}"
            );

            let payload = "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{}";
            let _ = socket.write_all(payload.as_bytes()).await;
            let _ = socket.shutdown().await;
        });

        let client = match GitLabClient::new(format!("http://{local_addr}"), "token".to_string()) {
            Ok(client) => client,
            Err(error) => panic!("gitlab client should initialize for mark_as_done test: {error}"),
        };

        let result = client.mark_todo_as_done(42).await;
        assert!(result.is_ok());
        let _ = server_handle.await;
    }
}
