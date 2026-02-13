use std::sync::{Mutex, MutexGuard};
use tracing::warn;

/// Locks a mutex and recovers from poisoning to keep app state available.
pub(crate) fn lock_or_recover<'a, T>(mutex: &'a Mutex<T>, label: &str) -> MutexGuard<'a, T> {
    match mutex.lock() {
        Ok(guard) => guard,
        Err(poisoned) => {
            warn!(target: "gitlabify::state", %label, "poisoned mutex recovered");
            poisoned.into_inner()
        }
    }
}
