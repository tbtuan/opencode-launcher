import { api } from './api'

let tabCounter = 0

// Stores actual terminal dimensions (after fit) keyed by tabId
const terminalDimensions = new Map()

export function setTerminalDimensions(tabId, cols, rows) {
  terminalDimensions.set(tabId, { cols, rows })
}

export function getTerminalDimensions(tabId) {
  return terminalDimensions.get(tabId)
}

export function clearTerminalDimensions(tabId) {
  terminalDimensions.delete(tabId)
}

export function generateTabId() {
  tabCounter++
  return `tab-${tabCounter}`
}

export async function createPtySession(tabId, cwd, args) {
  return api.createPty(tabId, cwd, args)
}

export function writeToPty(tabId, data) {
  api.writePty(tabId, data)
}

export function resizePty(tabId, cols, rows) {
  api.resizePty(tabId, cols, rows)
}

export async function killPty(tabId) {
  return api.killPty(tabId)
}

export function onPtyData(tabId, cb) {
  return api.onPtyData(tabId, cb)
}

export function onPtyExit(tabId, cb) {
  return api.onPtyExit(tabId, cb)
}

export function onOpencodeStarted(tabId, cb) {
  return api.onOpencodeStarted(tabId, cb)
}

export function triggerPaste(tabId) {
  api.triggerPaste(tabId)
}

export function onPasteComplete(tabId, cb) {
  return api.onPasteComplete(tabId, cb)
}

export function writeClipboard(text) {
  api.writeClipboard(text)
}
