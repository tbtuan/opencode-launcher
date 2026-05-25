import { describe, it, expect, vi, beforeEach } from 'vitest'
import { api } from '../services/api.js'

const tabId = 'tab-1'
const cwd = '/some/path'
const args = ['arg1', 'arg2']
const data = 'hello\n'
const cols = 80
const rows = 24
const config = { key: 'value' }
const content = 'some content'
const filePath = '/tmp/test.json'
const text = 'clipboard text'
const paths = ['/path1', '/path2']
const filename = 'resource.txt'
const lang = 'en'
const cb = () => {}

beforeEach(() => {
  window.api = {
    loadConfig: vi.fn(() => Promise.resolve({ directories: [] })),
    saveConfig: vi.fn(() => Promise.resolve({ ok: true })),
    openFolder: vi.fn(() => Promise.resolve(null)),
    listModels: vi.fn(() => Promise.resolve({ models: [], timestamp: null })),
    refreshModels: vi.fn(() => Promise.resolve({ models: [], timestamp: null })),
    createPty: vi.fn(() => Promise.resolve({ ok: true, pid: 12345 })),
    killPty: vi.fn(() => Promise.resolve({ ok: true })),
    writePty: vi.fn(),
    resizePty: vi.fn(),
    onPtyData: vi.fn(() => () => {}),
    onPtyExit: vi.fn(() => () => {}),
    restartApp: vi.fn(() => Promise.resolve()),
    readOpencodeConfig: vi.fn(() => Promise.resolve({ content: '{}', filePath: '/tmp/config.json' })),
    writeOpencodeConfig: vi.fn(() => Promise.resolve({ ok: true })),
    triggerPaste: vi.fn(),
    onPasteComplete: vi.fn(() => () => {}),
    onOpencodeStarted: vi.fn(() => () => {}),
    writeClipboard: vi.fn(() => Promise.resolve()),
    checkDirectories: vi.fn(() => Promise.resolve([])),
    readResource: vi.fn(() => Promise.resolve('')),

  }
})

describe('api IPC bridge', () => {
  it('api.loadConfig() calls window.api.loadConfig() and returns its result', async () => {
    const result = await api.loadConfig()
    expect(window.api.loadConfig).toHaveBeenCalledOnce()
    expect(window.api.loadConfig).toHaveBeenCalledWith()
    expect(result).toEqual({ directories: [] })
  })

  it('api.saveConfig(config) calls window.api.saveConfig(config) with correct arg', async () => {
    const result = await api.saveConfig(config)
    expect(window.api.saveConfig).toHaveBeenCalledOnce()
    expect(window.api.saveConfig).toHaveBeenCalledWith(config)
    expect(result).toEqual({ ok: true })
  })

  it('api.createPty(tabId, cwd, args) calls window.api.createPty(tabId, cwd, args, true) with autoStart default', async () => {
    const result = await api.createPty(tabId, cwd, args)
    expect(window.api.createPty).toHaveBeenCalledOnce()
    expect(window.api.createPty).toHaveBeenCalledWith(tabId, cwd, args, true)
    expect(result).toEqual({ ok: true, pid: 12345 })
  })

  it('api.killPty(tabId) calls window.api.killPty(tabId) with tabId', async () => {
    const result = await api.killPty(tabId)
    expect(window.api.killPty).toHaveBeenCalledOnce()
    expect(window.api.killPty).toHaveBeenCalledWith(tabId)
    expect(result).toEqual({ ok: true })
  })

  it('api.writePty(tabId, data) calls window.api.writePty(tabId, data) with 2 args', () => {
    api.writePty(tabId, data)
    expect(window.api.writePty).toHaveBeenCalledOnce()
    expect(window.api.writePty).toHaveBeenCalledWith(tabId, data)
  })

  it('api.resizePty(tabId, cols, rows) calls window.api.resizePty(tabId, cols, rows) with 3 args', () => {
    api.resizePty(tabId, cols, rows)
    expect(window.api.resizePty).toHaveBeenCalledOnce()
    expect(window.api.resizePty).toHaveBeenCalledWith(tabId, cols, rows)
  })

  it('api.onPtyData(tabId, cb) calls window.api.onPtyData(tabId, cb) with 2 args and returns a cleanup function', () => {
    const cleanup = api.onPtyData(tabId, cb)
    expect(window.api.onPtyData).toHaveBeenCalledOnce()
    expect(window.api.onPtyData).toHaveBeenCalledWith(tabId, cb)
    expect(typeof cleanup).toBe('function')
  })

  it('api.onPtyExit(tabId, cb) calls window.api.onPtyExit(tabId, cb) with 2 args', () => {
    api.onPtyExit(tabId, cb)
    expect(window.api.onPtyExit).toHaveBeenCalledOnce()
    expect(window.api.onPtyExit).toHaveBeenCalledWith(tabId, cb)
  })

  it('api.restartApp() calls window.api.restartApp()', async () => {
    await api.restartApp()
    expect(window.api.restartApp).toHaveBeenCalledOnce()
    expect(window.api.restartApp).toHaveBeenCalledWith()
  })

  it('api.readOpencodeConfig() calls window.api.readOpencodeConfig()', async () => {
    const result = await api.readOpencodeConfig()
    expect(window.api.readOpencodeConfig).toHaveBeenCalledOnce()
    expect(window.api.readOpencodeConfig).toHaveBeenCalledWith()
    expect(result).toEqual({ content: '{}', filePath: '/tmp/config.json' })
  })

  it('api.writeOpencodeConfig(content, filePath) calls window.api.writeOpencodeConfig(content, filePath) with 2 args', async () => {
    const result = await api.writeOpencodeConfig(content, filePath)
    expect(window.api.writeOpencodeConfig).toHaveBeenCalledOnce()
    expect(window.api.writeOpencodeConfig).toHaveBeenCalledWith(content, filePath)
    expect(result).toEqual({ ok: true })
  })

  it('api.triggerPaste(tabId) calls window.api.triggerPaste(tabId)', () => {
    api.triggerPaste(tabId)
    expect(window.api.triggerPaste).toHaveBeenCalledOnce()
    expect(window.api.triggerPaste).toHaveBeenCalledWith(tabId)
  })

  it('api.onPasteComplete(tabId, cb) calls window.api.onPasteComplete(tabId, cb) with 2 args', () => {
    api.onPasteComplete(tabId, cb)
    expect(window.api.onPasteComplete).toHaveBeenCalledOnce()
    expect(window.api.onPasteComplete).toHaveBeenCalledWith(tabId, cb)
  })

  it('api.onOpencodeStarted(tabId, cb) calls window.api.onOpencodeStarted(tabId, cb) with 2 args', () => {
    api.onOpencodeStarted(tabId, cb)
    expect(window.api.onOpencodeStarted).toHaveBeenCalledOnce()
    expect(window.api.onOpencodeStarted).toHaveBeenCalledWith(tabId, cb)
  })

  it('api.writeClipboard(text) calls window.api.writeClipboard(text)', async () => {
    await api.writeClipboard(text)
    expect(window.api.writeClipboard).toHaveBeenCalledOnce()
    expect(window.api.writeClipboard).toHaveBeenCalledWith(text)
  })

  it('api.checkDirectories(paths) calls window.api.checkDirectories(paths) with paths', async () => {
    const result = await api.checkDirectories(paths)
    expect(window.api.checkDirectories).toHaveBeenCalledOnce()
    expect(window.api.checkDirectories).toHaveBeenCalledWith(paths)
    expect(result).toEqual([])
  })

  it('api.readResource(filename) calls window.api.readResource(filename)', async () => {
    const result = await api.readResource(filename)
    expect(window.api.readResource).toHaveBeenCalledOnce()
    expect(window.api.readResource).toHaveBeenCalledWith(filename)
    expect(result).toBe('')
  })

  it('api.openFolder(lang) calls window.api.openFolder(lang)', async () => {
    const result = await api.openFolder(lang)
    expect(window.api.openFolder).toHaveBeenCalledOnce()
    expect(window.api.openFolder).toHaveBeenCalledWith(lang)
    expect(result).toBeNull()
  })

  it('api.listModels() calls window.api.listModels()', async () => {
    const result = await api.listModels()
    expect(window.api.listModels).toHaveBeenCalledOnce()
    expect(window.api.listModels).toHaveBeenCalledWith()
    expect(result).toEqual({ models: [], timestamp: null })
  })

  it('api.refreshModels() calls window.api.refreshModels()', async () => {
    const result = await api.refreshModels()
    expect(window.api.refreshModels).toHaveBeenCalledOnce()
    expect(window.api.refreshModels).toHaveBeenCalledWith()
    expect(result).toEqual({ models: [], timestamp: null })
  })
})
