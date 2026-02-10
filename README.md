# Tusker

A modern, fast PostgreSQL database client built with Tauri, React, and TypeScript. Browse schemas, edit data, write queries, and manage your databases with a native interface.

| | | |
|:-------------------------:|:-------------------------:|:-------------------------:|
|<img width="1312" height="912" alt="image" src="https://github.com/user-attachments/assets/663cac93-7554-42dc-894d-93e7ab90bc41" />  Main Screen |  <img width="1312" height="912" alt="image" src="https://github.com/user-attachments/assets/da2731af-bf81-435f-9540-da873378d4d7" /> Table Browse | <img width="1312" height="912" alt="image" src="https://github.com/user-attachments/assets/980bd21f-5b65-42ef-b863-27a5e1762081" /> Git Diff Changes |
| <img width="1312" height="912" alt="image" src="https://github.com/user-attachments/assets/55a00f44-dd92-4dfa-ba91-40aad979cab6" /> Commits History | <img width="1312" height="912" alt="image" src="https://github.com/user-attachments/assets/3645b480-6cbd-43d7-9adb-31d50f5b3b4c" /> Fully Custom Table Builder | <img width="1312" height="912" alt="image" src="https://github.com/user-attachments/assets/3ed05e72-e4ed-4154-833b-fa052ce7f1e7" /> SQL Playgound with autocomplete

## Installation

Download the latest release from the [Releases page](https://github.com/18jad/tusker/releases/latest).

- **macOS** (Apple Silicon): `.dmg`
- **Windows**: `.exe` or `.msi`

### macOS: "App is damaged" warning
<img width="270" height="280" alt="image" src="https://github.com/user-attachments/assets/eb29e46f-2efe-4609-a66d-d38f64da68fd" />

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
