// test-main.js - öffnet test.html um xterm.js zu testen
const { app, BrowserWindow } = require('electron')
const path = require('path')

app.whenReady().then(() => {
  const win = new BrowserWindow({ width: 900, height: 600, webPreferences: { nodeIntegration: false, contextIsolation: true } })
  win.loadFile(path.join(__dirname, 'renderer', 'test.html'))
  win.webContents.openDevTools()
})
