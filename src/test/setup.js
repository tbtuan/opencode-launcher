import '@testing-library/jest-dom'

// Mock window.api (Electron contextBridge API)
window.api = {
  loadConfig: () => Promise.resolve({ directories: [] }),
  saveConfig: () => Promise.resolve({ ok: true }),
  openFolder: () => Promise.resolve(null),
  listModels: () => Promise.resolve({ models: [], timestamp: null }),
  refreshModels: () => Promise.resolve({ models: [], timestamp: null }),
  createPty: () => Promise.resolve({ ok: true, pid: 12345 }),
  killPty: () => Promise.resolve({ ok: true }),
  writePty: () => {},
  resizePty: () => {},
  onPtyData: (tabId, cb) => { return () => {} },
  onPtyExit: (tabId, cb) => { return () => {} },
  restartApp: () => Promise.resolve(),
  readOpencodeConfig: () => Promise.resolve({ content: '{}', filePath: '/tmp/config.json' }),
  writeOpencodeConfig: () => Promise.resolve({ ok: true }),
  triggerPaste: () => {},
  onPasteComplete: (tabId, cb) => { return () => {} },
  onOpencodeStarted: (tabId, cb) => { return () => {} },
  writeClipboard: () => Promise.resolve(),
  checkDirectories: () => Promise.resolve([]),
  readResource: () => Promise.resolve(''),
}
