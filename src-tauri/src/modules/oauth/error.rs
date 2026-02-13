use thiserror::Error;

#[derive(Debug, Error)]
pub(crate) enum OAuthError {
    #[error("Missing OAuth code verifier")]
    MissingVerifier,
    #[error("Failed to open OAuth URL in browser")]
    OpenBrowser,
    #[error("Token exchange request failed: {0}")]
    TokenExchangeRequest(String),
    #[error("Token exchange failed: {0}")]
    TokenExchangeFailed(String),
    #[error("Failed to parse token response: {0}")]
    TokenParse(String),
    #[error("Token verification failed: {0}")]
    TokenVerification(String),
    #[error("Saving token failed: {0}")]
    SaveToken(String),
    #[error("Saving refresh token failed: {0}")]
    SaveRefreshToken(String),
    #[error("Failed to persist OAuth refresh token: {0}")]
    PersistRefreshToken(String),
    #[error("Failed to delete OAuth refresh token: {0}")]
    DeleteRefreshToken(String),
    #[error("OAuth token refresh request failed: {0}")]
    RefreshRequest(String),
    #[error("Token refresh failed: {0}")]
    RefreshFailed(String),
    #[error("Failed to parse refresh token response: {0}")]
    RefreshParse(String),
}
