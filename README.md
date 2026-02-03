# Tusker

A PostgreSQL database viewer built with Tauri, React, and TypeScript.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## Contributing

We welcome contributions! This section will guide you through setting up the project locally for development.

### Prerequisites

Before you begin, ensure you have the following installed on your system:

#### 1. Rust

Tusker's backend is built with Rust. Install Rust using rustup:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

After installation, restart your terminal and verify:

```bash
rustc --version
cargo --version
```

#### 2. Bun

This project uses [Bun](https://bun.sh/) as the JavaScript runtime and package manager.

**macOS/Linux:**

```bash
curl -fsSL https://bun.sh/install | bash
```

**Windows:**

```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

Verify installation:

```bash
bun --version
```

#### 3. System Dependencies

**macOS:**

Install the required system libraries using Homebrew:

```bash
brew install libpng
```

**Linux (Ubuntu/Debian):**

```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev libpng-dev
```

**Linux (Fedora):**

```bash
sudo dnf install webkit2gtk4.1-devel openssl-devel gtk3-devel libappindicator-gtk3-devel librsvg2-devel libpng-devel
```

**Windows:**

No additional system dependencies required. Ensure you have [Microsoft Visual Studio C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) installed.

### Getting Started

#### 1. Clone the Repository

```bash
git clone https://github.com/your-username/tusker.git
cd tusker
```

#### 2. Install Dependencies

Install the frontend dependencies:

```bash
bun install
```

#### 3. Run the Development Server

Start the application in development mode:

```bash
bun tauri dev
```

This command will:
- Start the Vite development server for the React frontend
- Compile the Rust backend
- Launch the Tauri application window

> **Note:** The first run will take longer as Rust compiles all dependencies. Subsequent runs will be faster.

### Available Commands

| Command | Description |
|---------|-------------|
| `bun tauri dev` | Start the app in development mode with hot-reload |
| `bun tauri build` | Build the production application |
| `bun run dev` | Start only the frontend dev server (without Tauri) |
| `bun run build` | Build only the frontend |

### Project Structure

```
tusker/
├── src/                  # React frontend source code
│   ├── components/       # React components
│   ├── hooks/            # Custom React hooks
│   └── ...
├── src-tauri/            # Rust backend source code
│   ├── src/              # Rust source files
│   ├── Cargo.toml        # Rust dependencies
│   └── tauri.conf.json   # Tauri configuration
├── package.json          # Frontend dependencies
└── README.md
```

### Troubleshooting

**Rust compilation errors:**
- Ensure Rust is up to date: `rustup update`

**Missing system libraries (Linux):**
- Make sure all system dependencies listed above are installed

**pngquant build failures:**
- Install libpng: `brew install libpng` (macOS) or `sudo apt install libpng-dev` (Linux)

**Port already in use:**
- The dev server uses port 1420 by default. Kill any process using that port or configure a different port in `vite.config.ts`

### Submitting Changes

1. Fork the repository
2. Create a new branch: `git checkout -b feature/your-feature-name`
3. Make your changes
4. Test your changes locally
5. Commit with a descriptive message
6. Push to your fork and submit a Pull Request
