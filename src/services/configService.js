import { api } from './api'

let dirIdCounter = 0

export async function loadConfig() {
  try {
    const config = await api.loadConfig()
    const dirs = (config?.directories || []).map(d => {
      if (!d._id) d._id = ++dirIdCounter
      else dirIdCounter = Math.max(dirIdCounter, d._id)
      return d
    })
    return { ...config, directories: dirs }
  } catch {
    return { directories: [], defaultTab: 'home', language: 'en' }
  }
}

export async function checkAndCleanDirectories(dirs) {
  try {
    const paths = dirs.map(d => d.path)
    const exists = await api.checkDirectories(paths)
    const valid = dirs.filter((_, i) => exists[i])
    const removed = dirs.filter((_, i) => !exists[i])
    return { valid, removed }
  } catch {
    return { valid: dirs, removed: [] }
  }
}

export async function persistConfig(directories, defaultTab, language) {
  try {
    const existing = await api.loadConfig()
    await api.saveConfig({ ...existing, directories, defaultTab, language })
  } catch (e) {
    console.error('[persistConfig]', e)
  }
}

export async function persistTabOrder(tabOrder) {
  try {
    const existing = await api.loadConfig()
    await api.saveConfig({ ...existing, tabOrder })
  } catch (e) {
    console.error('[persistTabOrder]', e)
  }
}

export function generateId() {
  return ++dirIdCounter
}
