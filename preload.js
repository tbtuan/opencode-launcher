const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  // Config
  loadConfig: () => ipcRenderer.invoke('config:load'),
  saveConfig: (config) => ipcRenderer.invoke('config:save', config),

  // Dialog
  openFolder: (lang) => ipcRenderer.invoke('dialog:openFolder', lang),

  // Models
  listModels:    () => ipcRenderer.invoke('models:list'),
  refreshModels: () => ipcRenderer.invoke('models:refresh'),

  // PTY lifecycle
  createPty: (tabId, cwd, args, autoStart) => ipcRenderer.invoke('pty:create', { tabId, cwd, args, autoStart }),
  killPty: (tabId) => ipcRenderer.invoke('pty:kill', { tabId }),

  // PTY I/O
  writePty: (tabId, data) => ipcRenderer.send('pty:write', { tabId, data }),
  resizePty: (tabId, cols, rows) => ipcRenderer.send('pty:resize', { tabId, cols, rows }),

  // PTY events (returns unsubscribe function)
  onPtyData: (tabId, cb) => {
    const channel = `pty:data:${tabId}`
    const handler = (_, data) => cb(data)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  },
  onPtyExit: (tabId, cb) => {
    const channel = `pty:exit:${tabId}`
    const handler = (_, code) => cb(code)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  },

  // App
  restartApp: () => ipcRenderer.invoke('app:restart'),
  openDevTools: () => ipcRenderer.invoke('app:openDevTools'),
  onBuildStatus: (cb) => {
    const handler = (_, data) => cb(data)
    ipcRenderer.on('build:status', handler)
    return () => ipcRenderer.removeListener('build:status', handler)
  },

  // i18n
  loadI18n: (lang) => ipcRenderer.invoke('i18n:load', lang),

  // Resources
  readResource: (filename) => ipcRenderer.invoke('resource:read', filename),

  // OpenCode Config
  readOpencodeConfig:    () => ipcRenderer.invoke('config:opencode:read'),
  writeOpencodeConfig:   (content, filePath) => ipcRenderer.invoke('config:opencode:write', { content, filePath }),

  // Paste: Main reads clipboard, sends text back
  triggerPaste: (tabId) => ipcRenderer.send('terminal-paste', { tabId }),
  onPasteComplete: (tabId, cb) => {
    const channel = `paste-content:${tabId}`
    const handler = (_, text) => cb(text)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  },
  onOpencodeStarted: (tabId, cb) => {
    const channel = `opencode:started:${tabId}`
    const handler = () => cb()
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  },
  writeClipboard: (text) => ipcRenderer.invoke('clipboard:write', text),
  checkDirectories: (paths) => ipcRenderer.invoke('fs:checkDirs', paths),

  // Generic IPC for dev tools
  sendToMain: (channel, data) => ipcRenderer.send(channel, data),

  // Save text file via dialog
  saveTextFile: (content, defaultName) => ipcRenderer.invoke('dialog:saveText', { content, defaultName }),
})
