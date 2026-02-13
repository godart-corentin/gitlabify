// Shared constants for the GitLabify backend

pub(crate) const GITLAB_HOST: &str = "https://gitlab.com";
pub(crate) const SERVICE_NAME: &str = "gitlabify";
pub(crate) const PAT_KEY: &str = "private-token";
pub(crate) const OAUTH_REFRESH_TOKEN_KEY: &str = "oauth-refresh-token";
pub(crate) const CONSECUTIVE_FAILURE_THRESHOLD: usize = 3;
pub(crate) const POLLING_INTERVAL_SECONDS: u64 = 30;
pub(crate) const PIPELINE_PAGE_SIZE: u32 = 1;
pub(crate) const HTTP_TIMEOUT_SECS: u64 = 10;
pub(crate) const GITLAB_API_MAX_RETRIES: usize = 3;
pub(crate) const GITLAB_API_RETRY_BASE_DELAY_MS: u64 = 500;
pub(crate) const OAUTH_VERIFIER_LENGTH: usize = 128;

pub(crate) const INBOX_CACHE_FILE_NAME: &str = "inbox_cache.json";
pub(crate) const INBOX_CACHE_KEY_DATA: &str = "inbox_data";
pub(crate) const INBOX_CACHE_KEY_LAST_UPDATED_MS: &str = "last_updated_at_ms";
pub(crate) const INBOX_CACHE_KEY_UNREAD_COUNT: &str = "unread_count";
pub(crate) const INBOX_CACHE_KEY_CONNECTION_STATUS: &str = "connection_status";
pub(crate) const INBOX_CACHE_KEY_LAST_ERROR: &str = "last_error";
pub(crate) const INBOX_CACHE_STALE_THRESHOLD_MS: u64 = 1000 * 60 * 5;
pub(crate) const INBOX_CACHE_WRITE_DEBOUNCE_MS: u64 = 1000;
