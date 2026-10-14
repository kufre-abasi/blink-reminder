# 👁️ Blink Reminder

A lightweight desktop app for developers that reminds you to blink at regular intervals — protecting your eyes during long coding sessions.

Runs on **macOS** and **Windows**. Lives in the system tray.

---

## Features

- ⏱ Configurable interval (1–30 min, default 20)
- 👁️ Full-screen blink overlay with countdown
- 🔔 Native OS notifications
- 🚀 Launch at login (autostart)
- 🖥 System tray icon — hides to tray, doesn't clutter your dock/taskbar
- 🔒 Single instance (reopens existing window if launched again)

---

## Prerequisites

### 1. Node.js (v18+)
```bash
node -v
```

### 2. Rust + Cargo
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### 3. Tauri system dependencies

**macOS** — Xcode Command Line Tools:
```bash
xcode-select --install
```

**Windows** — Install these:
- [Microsoft Visual Studio C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)  
  *(check "Desktop development with C++")*
- [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) *(usually pre-installed on Win 11)*

---

## Getting Started

```bash
# 1. Install npm dependencies
npm install

# 2. Run in development mode (hot reload)
npm run tauri dev
```

---

## Build for Production

```bash
npm run tauri build
```

Output locations:
| Platform | File | Location |
|----------|------|----------|
| macOS | `.dmg` | `src-tauri/target/release/bundle/dmg/` |
| macOS | `.app` | `src-tauri/target/release/bundle/macos/` |
| Windows | `.msi` | `src-tauri/target/release/bundle/msi/` |
| Windows | `.exe` | `src-tauri/target/release/bundle/nsis/` |

---

## App Icons

Replace the placeholder icons in `src-tauri/icons/` with your own before building. You can generate all required sizes from a single 1024×1024 PNG using:

```bash
npm run tauri icon path/to/your-icon.png
```

---

## Project Structure

```
blink-reminder/
├── index.html              # App shell
├── src/
│   ├── main.js             # App logic (timer, overlay, settings)
│   └── styles.css          # All styling
├── src-tauri/
│   ├── src/
│   │   ├── main.rs         # Rust entry point
│   │   └── lib.rs          # Tray icon, plugins, window management
│   ├── capabilities/
│   │   └── default.json    # Tauri v2 permissions
│   ├── icons/              # App icons (replace with your own)
│   ├── Cargo.toml          # Rust dependencies
│   ├── build.rs            # Build script
│   └── tauri.conf.json     # Window config, bundle settings
├── package.json
└── vite.config.js
```

---

## Customisation

| What | Where |
|------|-------|
| Default interval | `src/main.js` → `value="20"` on the interval slider |
| Default blink count | `src/main.js` → `value="10"` on the blinks slider |
| Window size | `src-tauri/tauri.conf.json` → `width` / `height` |
| Colors / theme | `src/styles.css` → `:root` variables |

---

## Tray Behaviour

- **Left-click tray icon** → toggle window show/hide  
- **Right-click tray icon** → menu with "Show Window" and "Quit"  
- **Window close button (×)** → hides to tray (doesn't quit)  
- To fully quit: right-click tray → **Quit Blink Reminder**
