use serde::{Deserialize, Serialize};
use reqwest::{Client, StatusCode, Url};
use std::time::Duration;
use std::collections::HashSet;

use crate::modules::constants::PIPELINE_PAGE_SIZE;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all(serialize = "camelCase", deserialize = "snake_case"))]
pub struct Author {
    pub id: u64,
    pub name: String,
    pub username: String,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all(serialize = "camelCase", deserialize = "snake_case"))]
pub struct MergeRequest {
    pub id: u64,
    pub iid: u64,
    pub project_id: u64,
    pub source_branch: Option<String>,
    pub title: String,
    pub description: Option<String>,
    pub state: String,
    pub created_at: String,
    pub updated_at: String,
    pub web_url: String,
    pub author: Author,
    pub has_conflicts: bool,
    pub blocking_discussions_resolved: bool,
    #[serde(alias = "pipeline")]
    pub head_pipeline: Option<Pipeline>,
    #[serde(default)]
    pub draft: bool,
    #[serde(default)]
    pub work_in_progress: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all(serialize = "camelCase", deserialize = "snake_case"))]
pub struct Todo {
    pub id: u64,
    pub project_id: Option<u64>,
    pub author: Author,
    pub action_name: String,
    pub target_type: String,
    pub target_url: Option<String>,
    pub target: Option<MergeRequest>,
    pub body: Option<String>,
    pub state: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all(serialize = "camelCase", deserialize = "snake_case"))]
pub struct Pipeline {
    pub id: u64,
    pub iid: Option<u64>,
    pub project_id: u64,
    pub status: String,
    pub source: String,
    pub r#ref: String,
    pub sha: String,
    pub web_url: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct InboxData {
    pub merge_requests: Vec<MergeRequest>,
    pub todos: Vec<Todo>,
    pub pipelines: Vec<Pipeline>,
}

pub struct GitLabClient {
    client: Client,
    host: String,
    token: String,
}

#[derive(Debug)]
pub enum GitLabError {
    Network(reqwest::Error),
    Api(String),
    Unauthorized,
    RateLimited,
}

impl std::fmt::Display for GitLabError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            GitLabError::Network(e) => write!(f, "Network error: {}", e),
            GitLabError::Api(s) => write!(f, "API error: {}", s),
            GitLabError::Unauthorized => write!(f, "Unauthorized"),
            GitLabError::RateLimited => write!(f, "Rate limited"),
        }
    }
}

impl std::error::Error for GitLabError {}

impl From<reqwest::Error> for GitLabError {
    fn from(err: reqwest::Error) -> Self {
        GitLabError::Network(err)
    }
}

impl GitLabClient {
    pub fn new(host: String, token: String) -> Result<Self, GitLabError> {
        let client = Client::builder()
            .user_agent("gitlabify")
            .timeout(Duration::from_secs(10))
            .build()
            .map_err(GitLabError::Network)?;
        
        Ok(Self { client, host, token })
    }

    pub async fn fetch_current_user(&self) -> Result<Author, GitLabError> {
        let url = format!("{}/api/v4/user", self.host);
        self.get_json::<Author>(&url).await
    }

    pub async fn fetch_merge_requests(&self) -> Result<(Vec<MergeRequest>, Author), GitLabError> {
        let user = self.fetch_current_user().await?;
        let user_id = user.id;

        let reviewer_url = format!("{}/api/v4/merge_requests?scope=all&state=opened&reviewer_id={}", self.host, user_id);
        let assignee_url = format!("{}/api/v4/merge_requests?scope=all&state=opened&assignee_id={}", self.host, user_id);
        let author_url = format!("{}/api/v4/merge_requests?scope=all&state=opened&author_id={}", self.host, user_id);

        let (reviewer_res, assignee_res, author_res) = tokio::join!(
            self.get_json::<Vec<MergeRequest>>(&reviewer_url),
            self.get_json::<Vec<MergeRequest>>(&assignee_url),
            self.get_json::<Vec<MergeRequest>>(&author_url)
        );

        let mut all_mrs = reviewer_res?;
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

        Ok((all_mrs, user))
    }

    pub async fn fetch_todos(&self) -> Result<Vec<Todo>, GitLabError> {
        let url = format!("{}/api/v4/todos?state=pending&type=MergeRequest", self.host);
        let todos = self.get_json::<Vec<Todo>>(&url).await?;

        // Filter: Only opened MRs
        let filtered_todos = todos.into_iter().filter(|todo| {
            if let Some(target) = &todo.target {
                let is_opened = target.state == "opened";
                // We keep todos even for drafts if they are mentions or comments,
                // but we might want to be careful. For now, let's allow all pending todos on opened MRs.
                is_opened
            } else {
                false
            }
        }).collect();

        Ok(filtered_todos)
    }

    #[allow(dead_code)]
    pub async fn fetch_pipelines(&self) -> Result<Vec<Pipeline>, GitLabError> {
        // Fetch pipelines for the current user
        let url = format!("{}/api/v4/pipelines?scope=branches", self.host);
        // Note: GitLab pipelines API is a bit tricky for "my pipelines" across all projects.
        // Usually, users want to see pipelines for their own commits.
        // /pipelines?scope=all matches everything. 
        // For MVP, we'll use a broad fetch or specific to user if possible.
        self.get_json::<Vec<Pipeline>>(&url).await
    }

    pub async fn fetch_latest_pipeline_for_project_ref(
        &self,
        project_id: u64,
        ref_name: &str,
        username: &str,
    ) -> Result<Option<Pipeline>, GitLabError> {
        let base_url = format!("{}/api/v4/projects/{}/pipelines", self.host, project_id);
        let mut url = Url::parse(&base_url)
            .map_err(|e| GitLabError::Api(format!("Invalid pipelines URL: {}", e)))?;

        url.query_pairs_mut()
            .append_pair("ref", ref_name)
            .append_pair("username", username)
            .append_pair("order_by", "updated_at")
            .append_pair("sort", "desc")
            .append_pair("per_page", &PIPELINE_PAGE_SIZE.to_string());

        let pipelines = self.get_json::<Vec<Pipeline>>(url.as_str()).await?;
        Ok(pipelines.into_iter().next())
    }

    async fn get_json<T: for<'de> Deserialize<'de>>(&self, url: &str) -> Result<T, GitLabError> {
        let max_retries = 3;
        let mut attempt = 0;

        loop {
            attempt += 1;
            let request = self.client.get(url).bearer_auth(&self.token);
            
            match request.send().await {
                Ok(response) => {
                    let status = response.status();
                    if status.is_success() {
                        return response.json::<T>().await.map_err(GitLabError::Network);
                    } else if status.is_server_error() {
                        if attempt < max_retries {
                            tokio::time::sleep(Duration::from_millis(500 * attempt)).await;
                            continue;
                        }
                    }

                    // Client error or exhausted retries
                    let body = response.text().await.unwrap_or_else(|_| "Could not read response body".to_string());
                    
                    if status == StatusCode::UNAUTHORIZED {
                        return Err(GitLabError::Unauthorized);
                    } else if status == StatusCode::TOO_MANY_REQUESTS {
                        return Err(GitLabError::RateLimited);
                    } else {
                        return Err(GitLabError::Api(format!("Status: {} - Body: {}", status, body)));
                    }
                },
                Err(e) => {
                    if attempt < max_retries {
                        tokio::time::sleep(Duration::from_millis(500 * attempt)).await;
                        continue;
                    }
                    return Err(GitLabError::Network(e));
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modules::constants::GITLAB_HOST;

    #[test]
    fn test_merge_request_deserialization() {
        let json = format!(r#"{{
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
        }}"#, GITLAB_HOST, GITLAB_HOST);

        let mr: MergeRequest = serde_json::from_str(&json).unwrap();
        assert_eq!(mr.title, "Test MR");
        assert_eq!(mr.author.username, "testuser");
    }

    #[test]
    fn test_todo_deserialization() {
        let json = format!(r#"{{
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
        }}"#, GITLAB_HOST);

        let todo: Todo = serde_json::from_str(&json).unwrap();
        assert_eq!(todo.action_name, "mentioned");
        assert_eq!(todo.author.avatar_url, None);
    }
}
