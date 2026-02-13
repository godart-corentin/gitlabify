use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct User {
    pub(crate) id: u64,
    pub(crate) username: String,
    pub(crate) name: String,
    #[serde(alias = "avatar_url")]
    pub(crate) avatar_url: Option<String>,
}

#[derive(Debug, Deserialize)]
pub(super) struct ScopeErrorBody {
    pub(super) error_description: Option<String>,
    pub(super) scope: Option<String>,
}
