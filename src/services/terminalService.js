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

export async function createPtySession(tabId, cwd, args, autoStart = true) {
  return api.createPty(tabId, cwd, args, autoStart)
}

export function writeToPty(tabId, data) {
  api.writePty(tabId, data)
}

// Soft-reset terminal modes that may have been left hanging by a crashed TUI
// (vim/less/htop) or aborted command (Ctrl+C). Resets:
//   ?2004l  bracketed paste off  (PowerShell can't handle paste-wrapped input)
//   ?1l     application cursor keys off
//   ?1000l  X10 mouse tracking off
//   ?1002l  cell motion mouse tracking off
//   ?1003l  all motion mouse tracking off
//   ?1006l  SGR mouse mode off
//   ?1049l  alternate screen buffer off (return to main buffer)
//   ?25h    cursor visible
//   \x1b=   numeric keypad mode (deactivate application keypad)
export function sendTerminalReset(tabId) {
  const RESET = '\x1b[?2004l\x1b[?1l\x1b[?1000l\x1b[?1002l\x1b[?1003l\x1b[?1006l\x1b[?1049l\x1b[?25h\x1b='
  api.writePty(tabId, RESET)
}

export function resizePty(tabId, cols, rows) {
  // Guard: never send zero or invalid dimensions to the PTY —
  // PowerShell/bash silently breaks and stops producing output when resized to 0x0
  if (!cols || !rows || cols < 10 || rows < 3) return
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
