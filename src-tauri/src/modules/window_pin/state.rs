use std::sync::atomic::{AtomicBool, Ordering};

pub(crate) struct WindowPinState {
    pub(crate) is_pinned: AtomicBool,
}

impl WindowPinState {
    pub(crate) fn new(initial: bool) -> Self {
        Self {
            is_pinned: AtomicBool::new(initial),
        }
    }

    pub(crate) fn get(&self) -> bool {
        self.is_pinned.load(Ordering::Relaxed)
    }

    pub(crate) fn set(&self, pinned: bool) {
        self.is_pinned.store(pinned, Ordering::Relaxed);
    }
}
