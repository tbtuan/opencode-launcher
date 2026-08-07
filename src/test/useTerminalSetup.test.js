import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createRef } from 'react'
import { renderHook, act } from '@testing-library/react'

const openMock = vi.fn(() => Promise.resolve({ ok: true }))
window.api = window.api || {}
window.api.openExternal = openMock

const addonInstance = { fit: vi.fn() }
let capturedOptions = null

vi.mock('@xterm/xterm', () => ({
  Terminal: vi.fn().mockImplementation(function (options) {
    capturedOptions = options
    this.loadAddon = vi.fn(() => {
      return addonInstance
    })
    this.open = vi.fn()
    this.dispose = vi.fn()
    return this
  }),
}))

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: vi.fn().mockImplementation(function () {
    return addonInstance
  }),
}))

import { useTerminalSetup } from '../hooks/useTerminalSetup'

describe('useTerminalSetup linkHandler', () => {
  beforeEach(() => {
    openMock.mockClear()
    capturedOptions = null
  })

  it('registers an OSC 8 linkHandler on the terminal', () => {
    const container = document.createElement('div')
    Object.defineProperty(container, 'clientWidth', { value: 100 })
    Object.defineProperty(container, 'clientHeight', { value: 100 })
    const ref = { current: container }

    renderHook(() => useTerminalSetup(ref))

    expect(capturedOptions.linkHandler).toBeTypeOf('object')
    expect(typeof capturedOptions.linkHandler.activate).toBe('function')
  })

  it('activate forwards the link URL to window.api.openExternal', () => {
    const container = document.createElement('div')
    Object.defineProperty(container, 'clientWidth', { value: 100 })
    Object.defineProperty(container, 'clientHeight', { value: 100 })
    const ref = { current: container }

    const { unmount } = renderHook(() => useTerminalSetup(ref))
    act(() => {
      capturedOptions.linkHandler.activate(new MouseEvent('click'), 'https://example.com', null)
    })

    expect(openMock).toHaveBeenCalledOnce()
    expect(openMock).toHaveBeenCalledWith('https://example.com')
    unmount()
  })
})