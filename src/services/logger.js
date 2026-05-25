const CHANNEL = 'opencode:logs'
const MAX_LOGS = 2000

let logId = 0
let entries = []
const listeners = new Set()
const errorCallbacks = new Set()
let bc = null

if (typeof BroadcastChannel !== 'undefined') {
  try {
    bc = new BroadcastChannel(CHANNEL)
    bc.onmessage = (e) => {
      for (const fn of listeners) fn(e.data)
    }
  } catch {}
}

export const logger = {
  log(component, level, ...args) {
    const entry = {
      id: ++logId,
      component,
      level,
      args,
      timestamp: Date.now(),
    }
    entries.push(entry)
    if (entries.length > MAX_LOGS) entries.shift()

    const fn = console[level] || console.log
    fn(`[${component}]`, ...args)

    try {
      bc?.postMessage(entry)
    } catch {}

    for (const fn of listeners) fn(entry)

    if (level === 'error') {
      for (const cb of errorCallbacks) cb(entry)
    }
  },

  info(component, ...args) { this.log(component, 'info', ...args) },
  warn(component, ...args) { this.log(component, 'warn', ...args) },
  error(component, ...args) { this.log(component, 'error', ...args) },
  debug(component, ...args) { this.log(component, 'debug', ...args) },

  subscribe(fn) {
    listeners.add(fn)
    return () => listeners.delete(fn)
  },

  onError(cb) {
    errorCallbacks.add(cb)
    return () => errorCallbacks.delete(cb)
  },

  getHistory() { return [...entries] },

  getRecent(count) {
    return entries.slice(-count)
  },

  formatEntries(list) {
    return list.map(e => {
      const time = new Date(e.timestamp).toISOString()
      const args = e.args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')
      return `[${time}] [${e.level.toUpperCase()}] [${e.component}] ${args}`
    }).join('\n')
  },

  clear() { entries = [] },
}
