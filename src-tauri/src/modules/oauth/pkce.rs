use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use rand::{distributions::Alphanumeric, Rng};
use sha2::{Digest, Sha256};

pub(super) fn generate_verifier(verifier_length: usize) -> String {
    rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(verifier_length)
        .map(char::from)
        .collect()
}

pub(super) fn generate_challenge(verifier: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(verifier.as_bytes());
    URL_SAFE_NO_PAD.encode(hasher.finalize())
}

#[cfg(test)]
mod tests {
    use super::generate_challenge;

    #[test]
    fn pkce_generation() {
        let verifier = "test_verifier_with_enough_length_for_entropy_1234567890";
        let challenge = generate_challenge(verifier);
        assert!(!challenge.is_empty());
        assert!(challenge
            .chars()
            .all(|character| character.is_alphanumeric() || character == '-' || character == '_'));
    }
}
