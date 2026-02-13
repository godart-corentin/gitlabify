use thiserror::Error;

#[derive(Debug, Error)]
pub(crate) enum GitLabError {
    #[error("Network error: {0}")]
    Network(#[from] reqwest::Error),
    #[error("API error: {0}")]
    Api(String),
    #[error("Unauthorized")]
    Unauthorized,
    #[error("Rate limited")]
    RateLimited,
}
