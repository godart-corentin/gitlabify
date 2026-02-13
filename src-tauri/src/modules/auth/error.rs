use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Serialize, Deserialize, Error)]
#[serde(tag = "type", content = "message", rename_all = "camelCase")]
pub(crate) enum AuthError {
    #[error("Invalid Personal Access Token")]
    InvalidToken,
    #[error("Insufficient scope: {0}")]
    InsufficientScope(String),
    #[error("Network error: {0}")]
    NetworkError(String),
    #[error("Keychain error: {0}")]
    KeychainError(String),
}
