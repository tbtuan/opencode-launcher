const { app, BrowserWindow, ipcMain, clipboard, dialog, Menu } = require('electron')
const path = require('path')
const fs = require('fs')
const pty = require('node-pty')
const { execSync, exec } = require('child_process')

let mainWindow
let devToolsWindow = null
const ptyProcesses = new Map() // tabId -> pty process

function loadConfig() {
  const configPath = path.join(__dirname, 'config.json')
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'))
  } catch (e) {
    return { directories: [] }
  }
}

function saveConfig(config) {
  const configPath = path.join(__dirname, 'config.json')
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
}

function loadModels(refresh = false) {
  try {
    const cmd = refresh ? 'opencode models --refresh --verbose' : 'opencode models --verbose'
    const output = execSync(cmd, { encoding: 'utf8', timeout: 15000 })
    const models = []
    const lines = output.split('\n')
    let i = 0
    while (i < lines.length) {
      const header = lines[i].trim()
      if (/^[a-zA-Z]/.test(header) && header.includes('/')) {
        let json = '', depth = 0, j = i + 1
        while (j < lines.length) {
          json += lines[j] + '\n'
          depth += (lines[j].match(/{/g) || []).length
          depth -= (lines[j].match(/}/g) || []).length
          j++
          if (depth === 0 && json.trim().startsWith('{')) break
        }
        try {
          const obj = JSON.parse(json)
          models.push({ id: header, name: obj.name, providerID: obj.providerID })
        } catch {}
        i = j
      } else { i++ }
    }
    return models
  } catch (e) {
    return []
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 600,
    minHeight: 400,
    backgroundColor: '#1e1e1e',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'))

  mainWindow.webContents.on('did-finish-load', () => {
    const checkScript = path.join(__dirname, 'check-build.js')
    if (fs.existsSync(checkScript)) {
      try {
        execSync(`node "${checkScript}"`, { cwd: __dirname, stdio: 'ignore' })
      } catch {
        mainWindow.webContents.send('build:status', { status: 'needsBuild' })
      }
    }
  })

  mainWindow.on('close', () => {
    console.log('[main] mainWindow close event triggered')
  })
  mainWindow.on('closed', () => {
    console.log('[main] mainWindow closed, killing', ptyProcesses.size, 'PTYs')
    // Kill all PTY processes on close
    for (const [id, ptyProc] of ptyProcesses) {
      console.log('[main] killing PTY', id)
      try { ptyProc.kill() } catch (e) {}
    }
    ptyProcesses.clear()
    mainWindow = null
  })
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ── IPC: Load config ──────────────────────────────────────────────────────────
ipcMain.handle('config:load', () => loadConfig())

// ── IPC: Save config ──────────────────────────────────────────────────────────
ipcMain.handle('config:save', (_, config) => {
  saveConfig(config)
  return { ok: true }
})

// ── IPC: Open folder dialog ───────────────────────────────────────────────────
ipcMain.handle('dialog:openFolder', async (_, lang) => {
  const title = lang === 'de' ? 'Verzeichnis auswählen' : 'Select Directory'
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title
  })
  if (result.canceled) return null
  return result.filePaths[0]
})

// ── IPC: Save text file via dialog ──────────────────────────────────────────
ipcMain.handle('dialog:saveText', async (_, { content, defaultName }) => {
  const result = await dialog.showSaveDialog({
    defaultPath: defaultName || 'logs.txt',
    filters: [
      { name: 'Textdateien', extensions: ['txt', 'log'] },
      { name: 'Alle Dateien', extensions: ['*'] },
    ],
  })
  if (result.canceled || !result.filePath) return { ok: false }
  try {
    fs.writeFileSync(result.filePath, content, 'utf-8')
    return { ok: true, filePath: result.filePath }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

// ── IPC: Create PTY ──────────────────────────────────────────────────────────
ipcMain.handle('pty:create', (_, { tabId, cwd, args, autoStart }) => {
  console.log('[main] pty:create', { tabId, cwd, autoStart })
  // Kill existing if any
  if (ptyProcesses.has(tabId)) {
    console.log('[main] pty:create killing existing for', tabId)
    try { ptyProcesses.get(tabId).kill() } catch (e) {}
    ptyProcesses.delete(tabId)
  }

  const shell = process.platform === 'win32'
    ? 'pwsh.exe'
    : process.platform === 'darwin'
      ? '/bin/zsh'
      : process.platform === 'linux'
        ? (process.env.SHELL || '/bin/bash')
        : 'sh'
  const ptyProc = pty.spawn(shell, [], {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd: cwd,
    env: process.env
  })

  ptyProc.onData((data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(`pty:data:${tabId}`, data)
    }
  })

  ptyProc.onExit(({ exitCode }) => {
    console.log('[main] pty:exit', { tabId, exitCode })
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(`pty:exit:${tabId}`, exitCode)
    }
    ptyProcesses.delete(tabId)
  })

  ptyProcesses.set(tabId, ptyProc)

  // Auto-start opencode (skip for split terminals and when explicitly disabled)
  if (autoStart !== false) {
    setTimeout(() => {
      if (ptyProcesses.has(tabId)) {
        const cmd = args ? `opencode ${args}\r` : 'opencode\r'
        ptyProc.write(cmd)
        // Signal renderer that opencode is starting
        mainWindow?.webContents.send(`opencode:started:${tabId}`)
      }
    }, 500)
  }

  return { ok: true, pid: ptyProc.pid }
})

// ── IPC: Write to PTY ────────────────────────────────────────────────────────
ipcMain.on('pty:write', (_, { tabId, data }) => {
  const ptyProc = ptyProcesses.get(tabId)
  if (ptyProc) {
    const isExitCmd = data.includes('exit') || data.includes('\x04') || data.includes('\x03')
    if (isExitCmd) console.log('[main] pty:write EXIT CMD for', tabId, JSON.stringify(data))
    try { ptyProc.write(data) } catch (e) {}
  }
})

// ── IPC: Resize PTY ──────────────────────────────────────────────────────────
ipcMain.on('pty:resize', (_, { tabId, cols, rows }) => {
  const ptyProc = ptyProcesses.get(tabId)
  if (ptyProc) {
    try { ptyProc.resize(cols, rows) } catch (e) {}
  }
})

// ── IPC: Kill PTY ────────────────────────────────────────────────────────────
ipcMain.handle('pty:kill', (_, { tabId }) => {
  console.log('[main] pty:kill', { tabId })
  const ptyProc = ptyProcesses.get(tabId)
  if (ptyProc) {
    try { ptyProc.kill() } catch (e) {}
    ptyProcesses.delete(tabId)
  }
  return { ok: true }
})

// ── IPC: List Models ─────────────────────────────────────────────────────────
ipcMain.handle('models:list', () => {
  const config = loadConfig()
  if (config.modelsCache?.models?.length) {
    return { models: config.modelsCache.models, timestamp: config.modelsCache.timestamp }
  }
  // Kein Cache → einmalig laden und speichern
  const models = loadModels(false)
  const timestamp = new Date().toISOString()
  config.modelsCache = { timestamp, models }
  saveConfig(config)
  return { models, timestamp }
})

// ── IPC: Refresh Models ──────────────────────────────────────────────────────
ipcMain.handle('models:refresh', () => {
  const models = loadModels(true)
  const timestamp = new Date().toISOString()
  const config = loadConfig()
  config.modelsCache = { timestamp, models }
  saveConfig(config)
  return { models, timestamp }
})

// ── IPC: Open DevTools (separate window with custom log viewer) ─────────────
ipcMain.handle('app:openDevTools', () => {
  if (devToolsWindow && !devToolsWindow.isDestroyed()) {
    devToolsWindow.focus()
    return
  }

  devToolsWindow = new BrowserWindow({
    width: 1000,
    height: 750,
    title: 'OpenCode Launcher — Entwicklertools',
    webPreferences: {
      preload: path.join(__dirname, 'preload-dev.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  const indexPath = path.join(__dirname, 'dist', 'index.html').replace(/\\/g, '/')
  devToolsWindow.loadURL(`file://${indexPath}#/devtools`)
  devToolsWindow.on('closed', () => { devToolsWindow = null })
})

// ── IPC: Open Chrome DevTools on the main window ────────────────────────────
ipcMain.handle('app:openChromeDevTools', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  }
})

// ── IPC: Restart App ─────────────────────────────────────────────────────────
ipcMain.handle('app:restart', async (event) => {
  console.log('[main] app:restart called')
  const checkScript = path.join(__dirname, 'check-build.js')
  if (fs.existsSync(checkScript)) {
    try {
      execSync(`node "${checkScript}"`, { cwd: __dirname, stdio: 'ignore' })
    } catch {
      event.sender.send('build:status', { status: 'building' })
      await new Promise((resolve, reject) => {
        exec('npm run build', { cwd: __dirname }, (err) => {
          if (err) {
            console.error('[restart] Build failed:', err.message)
            reject(err)
          } else {
            event.sender.send('build:status', { status: 'done' })
            resolve()
          }
        })
      }).catch(() => {})
    }
  }
  app.relaunch()
  app.exit()
})

// ── IPC: Read OpenCode config ──────────────────────────────────────────────────
ipcMain.handle('config:opencode:read', () => {
  let configPath

  // 1. OPENCODE_CONFIG env var
  if (process.env.OPENCODE_CONFIG) {
    configPath = process.env.OPENCODE_CONFIG
  } else {
    // 2. OS-spezifischer Default
    const home = process.env.USERPROFILE || process.env.HOME
    configPath = path.join(home, '.config', 'opencode', 'opencode.json')
  }

  // Sicherstellen, dass das Verzeichnis existiert
  const dir = path.dirname(configPath)
  if (!fs.existsSync(dir)) {
    try { fs.mkdirSync(dir, { recursive: true }) } catch (e) {}
  }

  // Datei lesen oder minimales JSON anlegen
  let content
  if (fs.existsSync(configPath)) {
    content = fs.readFileSync(configPath, 'utf-8')
  } else {
    content = JSON.stringify({ "$schema": "https://opencode.ai/config.json" }, null, 2)
    try { fs.writeFileSync(configPath, content, 'utf-8') } catch (e) {}
  }

  return { content, filePath: configPath }
})

// ── IPC: Write OpenCode config ─────────────────────────────────────────────────
ipcMain.handle('config:opencode:write', (_, { content, filePath }) => {
  if (!filePath) return { ok: false, error: 'No file path provided' }
  try {
    // JSON-Validierung vor dem Schreiben
    JSON.parse(content)
    fs.writeFileSync(filePath, content, 'utf-8')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

// ── IPC: Read resource file ────────────────────────────────────────────────────
ipcMain.handle('resource:read', async (_, filename) => {
  const filePath = path.join(__dirname, 'resources', filename)
  try {
    return fs.readFileSync(filePath, 'utf-8')
  } catch (e) {
    return null
  }
})

// ── IPC: Fast Terminal Paste (Main reads clipboard, sends text to renderer) ──
ipcMain.on('terminal-paste', (event, { tabId }) => {
  const text = clipboard.readText()
  if (text) {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) win.webContents.send(`paste-content:${tabId}`, text)
  }
})

// ── IPC: Clipboard Write (for Copy) ──────────────────────────────────────────
ipcMain.handle('clipboard:write', (_, text) => clipboard.writeText(text, 'clipboard'))

// ── IPC: Check which directories still exist ────────────────────────────────
ipcMain.handle('fs:checkDirs', async (_, paths) => {
  return paths.map(p => fs.existsSync(p))
})
