# Tusker

A modern, fast PostgreSQL database client built with Tauri, React, and TypeScript. Browse schemas, edit data, write queries, and manage your databases with a native interface.

## Installation

Download the latest release from the [Releases page](https://github.com/18jad/tusker/releases/latest).

- **macOS** (Apple Silicon): `.dmg`
- **Windows**: `.exe` or `.msi`

### macOS: "App is damaged" warning

The app is not code-signed with an Apple Developer certificate, so macOS Gatekeeper may block it. To fix this, run after installing:

```bash
xattr -cr /Applications/Tusker.app
```

Alternatively, right-click the app > **Open** > click **Open** again in the dialog. macOS will remember your choice.

## Development

### Prerequisites

- [Rust](https://rustup.rs/)
- [Bun](https://bun.sh/)
- **Linux only:** `libwebkit2gtk-4.1-dev libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev`

### Setup

```bash
git clone https://github.com/18jad/tusker.git
cd tusker
bun install
bun tauri dev
```

### Build

```bash
bun tauri build
```

## Contributing

1. Fork the repository
2. Create a branch: `git checkout -b feature/your-feature`
3. Make your changes and test locally
4. Submit a Pull Request
