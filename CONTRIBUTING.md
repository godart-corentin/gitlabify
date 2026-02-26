# Contributing to Gitlabify

Thanks for your interest in contributing.

## Before You Start

- Read the `README.md` for setup instructions.
- Check existing issues and pull requests to avoid duplicate work.
- For significant changes, open an issue first to discuss scope and approach.

## Local Setup

```bash
bun install
bun tauri dev
```

## Quality Gates

Run the same checks as CI before opening a PR:

```bash
bun run validate
```

For backend-specific checks:

```bash
cd src-tauri
cargo fmt -- --check
cargo clippy -- -D warnings
cargo test
```

## Pull Request Guidelines

- Keep PRs focused and small when possible.
- Add or update tests for behavioral changes.
- Update docs for user-visible changes.
- Add a changelog entry when relevant.

## Commit Messages

Use clear, descriptive commit messages that explain intent.

## Code of Conduct

By participating, you agree to follow `CODE_OF_CONDUCT.md`.
