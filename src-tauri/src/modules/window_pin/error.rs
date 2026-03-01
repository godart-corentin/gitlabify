use thiserror::Error;

#[derive(Debug, Error)]
pub(crate) enum WindowPinError {
    #[error("window preferences store unavailable")]
    StoreUnavailable,

    #[error("failed to persist pin state: {0}")]
    PersistFailed(String),

    #[error("failed to set always-on-top: {0}")]
    AlwaysOnTopFailed(String),
}
