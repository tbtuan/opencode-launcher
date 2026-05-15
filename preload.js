const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  // Config
  loadConfig: () => ipcRenderer.invoke('config:load'),
  saveConfig: (config) => ipcRenderer.invoke('config:save', config),

  // Dialog
  openFolder: () => ipcRenderer.invoke('dialog:openFolder'),

  // Models
  listModels:    () => ipcRenderer.invoke('models:list'),
  refreshModels: () => ipcRenderer.invoke('models:refresh'),

  // PTY lifecycle
  createPty: (tabId, cwd, args) => ipcRenderer.invoke('pty:create', { tabId, cwd, args }),
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
  restartApp: () => ipcRenderer.invoke('app:restart')
})
