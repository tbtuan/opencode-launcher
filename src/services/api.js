// API-Abstraktionsschicht für Electron IPC
// Läuft im Browser-Mode (z.B. Vite dev) als Mock oder nutzt window.api im Electron-Kontext

const isElectron = typeof window !== 'undefined' && window.api

function log(...args) {
  try { console.log('[api]', ...args) } catch {}
}

async function invokeIpc(channel, ...args) {
  log('invokeIpc', channel, args.length, 'args')
  if (isElectron) {
    const method = window.api[channel]
    if (typeof method === 'function') {
      log('invokeIpc calling', channel)
      return method(...args)
    }
    log('invokeIpc NO METHOD for', channel)
  } else {
    log('invokeIpc NOT ELECTRON')
  }
  return null
}

function sendIpc(channel, ...args) {
  log('sendIpc', channel, args.length, 'args')
  if (isElectron) {
    const method = window.api[channel]
    if (typeof method === 'function') {
      return method(...args)
    }
  }
}

function onIpc(channel, ...args) {
  log('onIpc', channel, args.length, 'args')
  if (isElectron) {
    const method = window.api[channel]
    if (typeof method === 'function') {
      log('onIpc found method for', channel)
      const result = method(...args)
      log('onIpc result for', channel, typeof result)
      return result
    }
    log('onIpc NO METHOD for', channel)
  } else {
    log('onIpc NOT ELECTRON')
  }
  return () => {}
}

export const api = {
  loadConfig: () => invokeIpc('loadConfig'),
  saveConfig: (config) => invokeIpc('saveConfig', config),
  openFolder: (lang) => invokeIpc('openFolder', lang),
  listModels: () => invokeIpc('listModels'),
  refreshModels: () => invokeIpc('refreshModels'),
  createPty: (tabId, cwd, args) => invokeIpc('createPty', tabId, cwd, args),
  killPty: (tabId) => invokeIpc('killPty', tabId),
  writePty: (tabId, data) => sendIpc('writePty', tabId, data),
  resizePty: (tabId, cols, rows) => sendIpc('resizePty', tabId, cols, rows),
  onPtyData: (tabId, cb) => onIpc('onPtyData', tabId, cb),
  onPtyExit: (tabId, cb) => onIpc('onPtyExit', tabId, cb),
  restartApp: () => invokeIpc('restartApp'),
  onBuildStatus: (cb) => onIpc('onBuildStatus', cb),
  readOpencodeConfig: () => invokeIpc('readOpencodeConfig'),
  writeOpencodeConfig: (content, filePath) => invokeIpc('writeOpencodeConfig', content, filePath),
  triggerPaste: (tabId) => sendIpc('triggerPaste', tabId),
  onPasteComplete: (tabId, cb) => onIpc('onPasteComplete', tabId, cb),
  onOpencodeStarted: (tabId, cb) => onIpc('onOpencodeStarted', tabId, cb),
  writeClipboard: (text) => invokeIpc('writeClipboard', text),
  checkDirectories: (paths) => invokeIpc('checkDirectories', paths),
  readResource: (filename) => invokeIpc('readResource', filename),
  loadI18n: (lang) => invokeIpc('loadI18n', lang),
}
