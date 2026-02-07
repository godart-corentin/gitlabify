// Shared constants for the GitLabify backend

pub const GITLAB_HOST: &str = "https://gitlab.com";
pub const SERVICE_NAME: &str = "gitlabify";
pub const PAT_KEY: &str = "private-token";
pub const CONSECUTIVE_FAILURE_THRESHOLD: usize = 3;
pub const POLLING_INTERVAL_SECONDS: u64 = 30;
pub const PIPELINE_PAGE_SIZE: u32 = 1;

pub const INBOX_CACHE_FILE_NAME: &str = "inbox_cache.json";
pub const INBOX_CACHE_KEY_DATA: &str = "inbox_data";
pub const INBOX_CACHE_KEY_LAST_UPDATED_MS: &str = "last_updated_at_ms";
pub const INBOX_CACHE_KEY_UNREAD_COUNT: &str = "unread_count";
pub const INBOX_CACHE_KEY_CONNECTION_STATUS: &str = "connection_status";
pub const INBOX_CACHE_KEY_LAST_ERROR: &str = "last_error";
pub const INBOX_CACHE_STALE_THRESHOLD_MS: u64 = 1000 * 60 * 5;
pub const INBOX_CACHE_WRITE_DEBOUNCE_MS: u64 = 1000;
