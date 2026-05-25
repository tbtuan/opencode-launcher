// API-Abstraktionsschicht für Electron IPC
// Läuft im Browser-Mode (z.B. Vite dev) als Mock oder nutzt window.api im Electron-Kontext

import { logger } from './logger'

const isElectron = typeof window !== 'undefined' && window.api

function log(...args) {
  try { logger.debug('API', ...args) } catch {}
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
  if (isElectron) {
    const method = window.api[channel]
    if (typeof method === 'function') {
      return method(...args)
    }
  }
}

function onIpc(channel, ...args) {
  if (isElectron) {
    const method = window.api[channel]
    if (typeof method === 'function') {
      const result = method(...args)
      return result
    }
  }
  return () => {}
}

export const api = {
  loadConfig: () => invokeIpc('loadConfig'),
  saveConfig: (config) => invokeIpc('saveConfig', config),
  openFolder: (lang) => invokeIpc('openFolder', lang),
  listModels: () => invokeIpc('listModels'),
  refreshModels: () => invokeIpc('refreshModels'),
  createPty: (tabId, cwd, args, autoStart = true) => invokeIpc('createPty', tabId, cwd, args, autoStart),
  killPty: (tabId) => invokeIpc('killPty', tabId),
  writePty: (tabId, data) => sendIpc('writePty', tabId, data),
  resizePty: (tabId, cols, rows) => sendIpc('resizePty', tabId, cols, rows),
  onPtyData: (tabId, cb) => onIpc('onPtyData', tabId, cb),
  onPtyExit: (tabId, cb) => onIpc('onPtyExit', tabId, cb),
  restartApp: () => invokeIpc('restartApp'),
  openDevTools: () => invokeIpc('openDevTools'),
  onBuildStatus: (cb) => onIpc('onBuildStatus', cb),
  readOpencodeConfig: () => invokeIpc('readOpencodeConfig'),
  writeOpencodeConfig: (content, filePath) => invokeIpc('writeOpencodeConfig', content, filePath),
  triggerPaste: (tabId) => sendIpc('triggerPaste', tabId),
  onPasteComplete: (tabId, cb) => onIpc('onPasteComplete', tabId, cb),
  onOpencodeStarted: (tabId, cb) => onIpc('onOpencodeStarted', tabId, cb),
  writeClipboard: (text) => invokeIpc('writeClipboard', text),
  checkDirectories: (paths) => invokeIpc('checkDirectories', paths),
  readResource: (filename) => invokeIpc('readResource', filename),
}
