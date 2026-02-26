# 🦊 Gitlabify

**Gitlabify** is a cross-platform system tray application designed to streamline the GitLab notification workflow for developers. It aims to replicate the "Gitify" experience for GitLab, focusing on speed, focus, and a premium design to prevent missed reviews and reduce context switching.

## 🚀 Features

- **System Tray Integration:** Quick access to your GitLab notifications directly from your menu bar or taskbar.
- **Pipeline Failure Alerts:** High-urgency notifications for CI/CD pipeline failures so you can fix builds immediately.
- **Premium Design:** A clean, information-dense, and highly readable UI utilizing a "Premium Utility" design system with Tailwind CSS and DaisyUI.
- **Desktop Platforms:** Built with Tauri, providing a lightweight desktop experience on macOS and Windows.
- **Thick Backend Architecture:** Core business logic, secure storage, and API polling are handled robustly in Rust, keeping the React frontend fast and responsive.

## 🛠️ Technical Stack

- **Framework:** Desktop Application (Tauri v2)
- **Backend:** Rust (Tauri)
- **Frontend:** React (v19), TypeScript, Vite
- **Styling:** Tailwind CSS (v4), DaisyUI (v5)
- **State Management:** React Query (Server State), Tauri Plugin Store (Local Persistence)
- **Package Manager:** Bun

## 💻 Development Guide

### Prerequisites

Ensure you have the following installed on your system:

- [Bun](https://bun.sh/)
- [Rust](https://www.rust-lang.org/tools/install)
- [Tauri Dependencies](https://v2.tauri.app/start/prerequisites/)

### Getting Started

```bash
# Install dependencies
bun install

# Start Development Server (Frontend + Tauri)
bun tauri dev

# Build for Production
bun tauri build

# Run Code Quality Checks (Lint, Format, Typecheck)
bun run validate

# Run Tests (Unit/Frontend)
bun run test
```

## 📐 Architecture & Conventions

- **React Clean Code:** Strictly adheres to Feature-Sliced Design (FSD) architecture. State logic and side-effects are properly encapsulated and separated from the UI components.
- **Styling & UI:** UI is completely based on a bespoke Design System minimizing decoration in favor of utility, with strict grayscale base colors and status-driven semantic accents.
- **Rust/Tauri:** Prioritizes a "Thick Backend" architecture. Core business logic, including GitLab API interactions, data transformation, polling, and secure storage management, reside in the Rust backend.

## 🤝 Contributing & Community

- See `CONTRIBUTING.md` for contribution workflow and quality gates.
- See `CODE_OF_CONDUCT.md` for community participation guidelines.
- See `SECURITY.md` to report vulnerabilities privately.
- License: `LICENSE` (MIT).
