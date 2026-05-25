const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  openDevTools: () => ipcRenderer.invoke('app:openDevTools'),
  openChromeDevTools: () => ipcRenderer.invoke('app:openChromeDevTools'),
  sendToMain: (channel, data) => ipcRenderer.send(channel, data),
  saveTextFile: (content, defaultName) => ipcRenderer.invoke('dialog:saveText', { content, defaultName }),
  writeClipboard: (text) => ipcRenderer.invoke('clipboard:write', text),
  onBuildStatus: (cb) => {
    const handler = (_, data) => cb(data)
    ipcRenderer.on('build:status', handler)
    return () => ipcRenderer.removeListener('build:status', handler)
  },
})
