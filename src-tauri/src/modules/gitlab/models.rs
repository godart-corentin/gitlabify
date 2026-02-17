use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all(serialize = "camelCase", deserialize = "snake_case"))]
pub(crate) struct Author {
    pub(crate) id: u64,
    pub(crate) name: String,
    pub(crate) username: String,
    pub(crate) avatar_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all(serialize = "camelCase", deserialize = "snake_case"))]
pub(crate) struct MergeRequest {
    pub(crate) id: u64,
    pub(crate) iid: u64,
    pub(crate) project_id: u64,
    pub(crate) source_branch: Option<String>,
    pub(crate) title: String,
    pub(crate) description: Option<String>,
    pub(crate) state: String,
    pub(crate) created_at: String,
    pub(crate) updated_at: String,
    pub(crate) web_url: String,
    pub(crate) author: Author,
    pub(crate) has_conflicts: bool,
    pub(crate) blocking_discussions_resolved: bool,
    #[serde(alias = "pipeline")]
    pub(crate) head_pipeline: Option<Pipeline>,
    #[serde(default)]
    pub(crate) draft: bool,
    #[serde(default)]
    pub(crate) work_in_progress: bool,
    #[serde(default)]
    pub(crate) is_reviewer: bool,
    #[serde(default)]
    pub(crate) approved_by_me: bool,
    #[serde(default)]
    pub(crate) reviewed_by_me: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all(serialize = "camelCase", deserialize = "snake_case"))]
pub(crate) struct Todo {
    pub(crate) id: u64,
    pub(crate) project_id: Option<u64>,
    pub(crate) author: Author,
    pub(crate) action_name: String,
    pub(crate) target_type: String,
    pub(crate) target_url: Option<String>,
    pub(crate) target: Option<MergeRequest>,
    pub(crate) body: Option<String>,
    pub(crate) state: String,
    pub(crate) created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all(serialize = "camelCase", deserialize = "snake_case"))]
pub(crate) struct Pipeline {
    pub(crate) id: u64,
    pub(crate) iid: Option<u64>,
    pub(crate) project_id: u64,
    pub(crate) status: String,
    pub(crate) source: String,
    pub(crate) r#ref: String,
    pub(crate) sha: String,
    pub(crate) web_url: String,
    pub(crate) created_at: String,
    pub(crate) updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct InboxData {
    pub(crate) merge_requests: Vec<MergeRequest>,
    pub(crate) todos: Vec<Todo>,
    pub(crate) pipelines: Vec<Pipeline>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all(serialize = "camelCase", deserialize = "snake_case"))]
pub(crate) struct ApprovalUser {
    pub(crate) id: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all(serialize = "camelCase", deserialize = "snake_case"))]
pub(crate) struct ApprovalEntry {
    pub(crate) user: ApprovalUser,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all(serialize = "camelCase", deserialize = "snake_case"))]
pub(crate) struct MergeRequestApprovals {
    pub(crate) approved_by: Vec<ApprovalEntry>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all(serialize = "camelCase", deserialize = "snake_case"))]
pub(crate) struct MergeRequestReviewerUser {
    pub(crate) id: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all(serialize = "camelCase", deserialize = "snake_case"))]
pub(crate) struct MergeRequestReviewerStatus {
    pub(crate) user: MergeRequestReviewerUser,
    pub(crate) state: String,
}
