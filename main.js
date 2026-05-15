const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron')
const path = require('path')
const fs = require('fs')
const pty = require('node-pty')
const { execSync } = require('child_process')

let mainWindow
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

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'))

  mainWindow.on('closed', () => {
    // Kill all PTY processes on close
    for (const [id, ptyProc] of ptyProcesses) {
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

// ── IPC: Create PTY ──────────────────────────────────────────────────────────
ipcMain.handle('pty:create', (_, { tabId, cwd, args }) => {
  // Kill existing if any
  if (ptyProcesses.has(tabId)) {
    try { ptyProcesses.get(tabId).kill() } catch (e) {}
    ptyProcesses.delete(tabId)
  }

  const shell = 'powershell.exe'
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
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(`pty:exit:${tabId}`, exitCode)
    }
    ptyProcesses.delete(tabId)
  })

  ptyProcesses.set(tabId, ptyProc)

  // Auto-start opencode
  setTimeout(() => {
    if (ptyProcesses.has(tabId)) {
      const cmd = args ? `opencode ${args}\r` : 'opencode\r'
      ptyProc.write(cmd)
    }
  }, 500)

  return { ok: true, pid: ptyProc.pid }
})

// ── IPC: Write to PTY ────────────────────────────────────────────────────────
ipcMain.on('pty:write', (_, { tabId, data }) => {
  const ptyProc = ptyProcesses.get(tabId)
  if (ptyProc) {
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

// ── IPC: Restart App ─────────────────────────────────────────────────────────
ipcMain.handle('app:restart', () => {
  app.relaunch()
  app.exit()
})

// ── IPC: Load i18n translations ──────────────────────────────────────────────
ipcMain.handle('i18n:load', async (_, lang) => {
  const filePath = path.join(__dirname, 'resources', `${lang}.json`)
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  } catch (e) {
    return null
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
