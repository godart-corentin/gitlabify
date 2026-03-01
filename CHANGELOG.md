# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.1] - 2026-03-01

### Changed

- Replaced the app settings menu with a contextual update button that reflects the current updater state (available, downloading, ready to restart).

### Fixed

- Tray notification badge count now correctly aligns with inbox filter logic: excludes draft MRs, filters todo actions to relevant types (commented, mentioned, directly addressed), and omits self-authored actions.

## [1.1.0] - 2026-02-28

### Added

- Full in-app update lifecycle: check for updates, download/install, prompt for restart, and resilient user-facing update status handling.

### Changed

- Reworked app settings UI to support updater-related controls and messaging.
- CI workflow now also runs for pushes to the `develop` branch.

## [1.0.2] - 2026-02-27

### Fixed

- Reset selection state when switching tabs.

## [1.0.1] - 2026-02-26

### Fixed

- Release workflow now installs valid Rust macOS targets (`aarch64-apple-darwin` and `x86_64-apple-darwin`) instead of `universal-apple-darwin` during toolchain setup.
- CI and release workflows now run `bun install --frozen-lockfile` without the invalid `&& break` suffix.

## [1.0.0] - 2026-02-25

### Added

- Initial public release of Gitlabify.
- System tray integration for quick access to GitLab notifications.
- High-urgency alerts for CI/CD pipeline failures.
- Desktop support on macOS and Windows via Tauri.
- Premium utility UI built with React, Tailwind CSS, and DaisyUI.
- Thick Rust backend architecture for GitLab API interactions, polling, and secure local storage.
