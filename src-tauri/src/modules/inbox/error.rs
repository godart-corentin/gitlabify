use thiserror::Error;

#[derive(Debug, Error)]
pub(crate) enum InboxServiceError {
    #[error("Keyring error: {0}")]
    Keyring(String),
    #[error("Failed to initialize GitLab client: {0}")]
    ClientInit(String),
    #[error("Fetch error: {0}")]
    Fetch(String),
}
