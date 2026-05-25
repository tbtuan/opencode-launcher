const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  openDevTools: () => ipcRenderer.invoke('app:openDevTools'),
  sendToMain: (channel, data) => ipcRenderer.send(channel, data),
  saveTextFile: (content, defaultName) => ipcRenderer.invoke('dialog:saveText', { content, defaultName }),
  onBuildStatus: (cb) => {
    const handler = (_, data) => cb(data)
    ipcRenderer.on('build:status', handler)
    return () => ipcRenderer.removeListener('build:status', handler)
  },
})
