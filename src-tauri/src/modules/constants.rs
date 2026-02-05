// Shared constants for the GitLabify backend

pub const GITLAB_HOST: &str = "https://gitlab.com";
pub const SERVICE_NAME: &str = "gitlabify";
pub const PAT_KEY: &str = "private-token";
pub const CONSECUTIVE_FAILURE_THRESHOLD: usize = 3;
pub const POLLING_INTERVAL_SECONDS: u64 = 30;
