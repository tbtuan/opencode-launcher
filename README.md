# OpenCode Launcher

A tab-based Electron launcher for managing multiple OpenCode terminal sessions.

## Features

### Dashboard
- **Directory Cards** – Saved directories are displayed as cards showing name, path, and optional description
- **Drag & Drop Reordering** – Rearrange cards on the dashboard by dragging
- **Inline Card Editor** – Edit name, description, auto-launch, and session continuation settings per card
- **Live Status Indicators** – Play, Stop, and Restart buttons sync with running terminal state
- **Preview Terminals** – Read-only mini previews of all running terminals shown directly below the cards; click to open full view

### Terminal Management
- **Multi-Tab Interface** – Open multiple terminal sessions in tabs
- **Tab Drag & Drop** – Reorder tabs by dragging
- **Tab Context Menu** – Right-click tabs to rename, change directory, restart, or close
- **Keyboard Shortcuts**
  - `Ctrl+T` – New terminal
  - `Ctrl+W` – Close current tab
  - `Ctrl+Tab` / `Ctrl+Shift+Tab` – Cycle through tabs
- **Copy & Paste** – `Ctrl+C` copies selection, `Ctrl+V` pastes clipboard content
- **Auto-Resize** – Terminal and PTY automatically resize when the window changes

### Model Management
- **Per-Directory Model Selection** – Choose a preferred AI model for each directory
- **Provider Grouping** – Models grouped by provider (OpenCode, GitHub Copilot, LiteLLM)
- **Model Caching** – Models are cached with a timestamp to avoid slow reloads
- **Manual Refresh** – Reload models on demand via the Actions menu

### Startup & Configuration
- **Auto-Launch** – Mark directories to automatically start on launcher open
- **Default Startup Tab** – Choose which tab opens on startup (Home or any saved directory) via Settings
- **Session Continuation** – Option to resume previous sessions with `--continue`
- **Persistent Config** – All settings saved to `config.json`

### Actions Menu
- **Reload Models** – Refresh the available model list
- **Restart Launcher** – Restart the application
- **Settings** – Configure default startup tab

### Directory Management
- **Add Directory** – Browse and add project directories
- **Save Dialog** – Choose to save only, open only, or save & open when adding a directory
- **Remove Card** – Right-click a card to remove it from the dashboard

### Technical
- **PTY-Based Terminals** – Uses `node-pty` for real shell sessions
- **Graceful Shutdown** – All PTY processes are killed on window close
- **xterm.js v5** – Modern terminal rendering with FitAddon
- **Auto-Hide Menu Bar** – Clean, distraction-free UI

## Requirements

- Node.js 18+
- OpenCode CLI (`opencode` must be in PATH)
- Build tools for `node-pty` native compilation

## Installation

```bash
npm install
```

### Linux / macOS

```bash
npm run rebuild   # Rebuild node-pty for your platform
```

## Usage

### Windows
```bash
start.bat
# or
npm start
```

### Linux / macOS
```bash
./start.sh
# or
npm start
```

## Configuration

Settings are stored in `config.json` in the project root:

```json
{
  "directories": [
    {
      "name": "my-project",
      "path": "/path/to/project",
      "description": "My project description",
      "model": "anthropic/claude-sonnet-4-20250514",
      "startOnLaunch": false,
      "continueSession": false
    }
  ],
  "defaultTab": "home",
  "tabOrder": [],
  "modelsCache": {
    "timestamp": "2025-01-01T00:00:00.000Z",
    "models": []
  }
}
```
