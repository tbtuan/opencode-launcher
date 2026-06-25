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

// Escape sequences that disable terminal modes commonly left enabled by crashed
// TUIs (vim/less/htop/opencode). Write this directly into xterm.js (via
// terminal.write()) to reset xterm's internal mode state:
//   mouseTrackingMode → "none", bracketedPasteMode → false,
//   applicationCursorKeysMode → false, alternate screen → main buffer, etc.
//
// IMPORTANT: Do NOT send this to the PTY stdin (writeToPty). Programs like
// opencode (Go TUI) will crash with a segfault if they receive raw escape
// sequences on stdin that they don't expect.
export const TERMINAL_RESET_SEQUENCE =
  '\x1b[?2004l' +  // bracketed paste off
  '\x1b[?1l' +     // application cursor keys off
  '\x1b[?1000l' +  // X10 mouse tracking off
  '\x1b[?1002l' +  // cell motion mouse tracking off
  '\x1b[?1003l' +  // all motion mouse tracking off
  '\x1b[?1006l' +  // SGR mouse mode off
  '\x1b[?1049l' +  // alternate screen buffer off
  '\x1b[?25h' +    // cursor visible
  '\x1b='          // numeric keypad mode off

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
