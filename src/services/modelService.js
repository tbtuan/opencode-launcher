import { api } from './api'

let cachedModels = []
let cachedTimestamp = null

export async function loadModels() {
  try {
    const result = await api.listModels()
    cachedModels = result?.models || []
    cachedTimestamp = result?.timestamp || null
  } catch {
    cachedModels = []
    cachedTimestamp = null
  }
  return { models: cachedModels, timestamp: cachedTimestamp }
}

export async function refreshModels() {
  try {
    const result = await api.refreshModels()
    cachedModels = result?.models || []
    cachedTimestamp = result?.timestamp || null
  } catch {
    cachedModels = []
    cachedTimestamp = null
  }
  return { models: cachedModels, timestamp: cachedTimestamp }
}

export function getModels() {
  return cachedModels
}

export function getTimestamp() {
  return cachedTimestamp
}
