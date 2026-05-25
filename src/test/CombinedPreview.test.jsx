import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { PreviewCard } from '../components/Dashboard/PreviewSection/PreviewCard'
import { TerminalPane } from '../components/Terminal/TerminalPane'

// ── Shared mock terminal ref ─────────────────────────────────────────────────
const mockWrite = vi.fn()
const mockResize = vi.fn()

export const mockTerminalRef = { current: null }

vi.mock('../hooks/usePreviewTerminal', () => ({
  usePreviewTerminal: () => mockTerminalRef,
}))

vi.mock('../store/AppContext', () => ({
  useApp: () => ({
    state: { tabs: [] },
    updateTab: vi.fn(),
    removeTab: vi.fn(),
  })
}))

vi.mock('../hooks/useTerminalSetup', () => ({
  useTerminalSetup: () => ({
    terminalRef: { current: null },
    fitAddonRef: { current: null },
    fit: vi.fn(),
    focus: vi.fn(),
    write: vi.fn(),
    clear: vi.fn(),
    hasSelection: vi.fn(() => false),
    getSelection: vi.fn(() => ''),
    getCols: vi.fn(() => 80),
    getRows: vi.fn(() => 24),
  })
}))

vi.mock('../hooks/useProcessingDetection', () => ({
  useProcessingDetection: () => ({
    suppressIndicator: vi.fn(),
    handlePtyData: vi.fn(),
    handleUserInput: vi.fn(),
    handleOpencodeStarted: vi.fn(),
    cleanup: vi.fn(),
  })
}))

vi.mock('../services/terminalService', () => ({
  writeToPty: vi.fn(),
  onPtyData: vi.fn(() => vi.fn()),
  onPtyExit: vi.fn(() => vi.fn()),
  onOpencodeStarted: vi.fn(() => vi.fn()),
  triggerPaste: vi.fn(),
  onPasteComplete: vi.fn(() => vi.fn()),
  writeClipboard: vi.fn(),
  resizePty: vi.fn(),
  setTerminalDimensions: vi.fn(),
  clearTerminalDimensions: vi.fn(),
  killPty: vi.fn(),
}))

vi.mock('../i18n', () => ({
  t: (key) => key,
}))

describe('CombinedPreview — pty-preview-data flow', () => {
  beforeEach(() => {
    mockTerminalRef.current = { write: mockWrite, resize: mockResize, dispose: vi.fn() }
    mockWrite.mockClear()
    mockResize.mockClear()
  })

  afterEach(() => {
    mockTerminalRef.current = null
  })

  it('PreviewCard writes data when pty-preview-data matches its tabId', () => {
    const tab = { id: 'parent-1', name: 'Parent', displayName: 'Parent' }
    render(<PreviewCard tab={tab} cols={80} rows={24} isProcessing={false} onClick={vi.fn()} />)

    act(() => {
      document.dispatchEvent(new CustomEvent('pty-preview-data', {
        detail: { tabId: 'parent-1', data: 'hello\n' }
      }))
    })

    expect(mockWrite).toHaveBeenCalledTimes(1)
    expect(mockWrite).toHaveBeenCalledWith('hello\n')
  })

  it('PreviewCard ignores pty-preview-data with different tabId', () => {
    const tab = { id: 'parent-1', name: 'Parent', displayName: 'Parent' }
    render(<PreviewCard tab={tab} cols={80} rows={24} isProcessing={false} onClick={vi.fn()} />)

    act(() => {
      document.dispatchEvent(new CustomEvent('pty-preview-data', {
        detail: { tabId: 'other-tab', data: 'should not appear\n' }
      }))
    })

    expect(mockWrite).not.toHaveBeenCalled()
  })

  it('PreviewCard ignores pty-preview-data when terminalRef.current is null', () => {
    mockTerminalRef.current = null
    const tab = { id: 'parent-1', name: 'Parent', displayName: 'Parent' }
    render(<PreviewCard tab={tab} cols={80} rows={24} isProcessing={false} onClick={vi.fn()} />)

    act(() => {
      document.dispatchEvent(new CustomEvent('pty-preview-data', {
        detail: { tabId: 'parent-1', data: 'dropped\n' }
      }))
    })

    expect(mockWrite).not.toHaveBeenCalled()
  })

  it('receives data via document event (cross-component integration)', () => {
    const tab = { id: 'parent-1', name: 'Parent', displayName: 'Parent' }
    render(<PreviewCard tab={tab} cols={80} rows={24} isProcessing={false} onClick={vi.fn()} />)

    const data = 'shell prompt $ '
    act(() => {
      document.dispatchEvent(new CustomEvent('pty-preview-data', {
        detail: { tabId: 'parent-1', data }
      }))
    })

    expect(mockWrite).toHaveBeenCalledWith(data)
  })

  it('writes multiple data chunks in sequence', () => {
    const tab = { id: 'parent-1', name: 'Parent', displayName: 'Parent' }
    render(<PreviewCard tab={tab} cols={80} rows={24} isProcessing={false} onClick={vi.fn()} />)

    act(() => {
      document.dispatchEvent(new CustomEvent('pty-preview-data', {
        detail: { tabId: 'parent-1', data: 'line1\n' }
      }))
      document.dispatchEvent(new CustomEvent('pty-preview-data', {
        detail: { tabId: 'parent-1', data: 'line2\n' }
      }))
      document.dispatchEvent(new CustomEvent('pty-preview-data', {
        detail: { tabId: 'parent-1', data: 'line3\n' }
      }))
    })

    expect(mockWrite).toHaveBeenCalledTimes(3)
    expect(mockWrite).toHaveBeenNthCalledWith(1, 'line1\n')
    expect(mockWrite).toHaveBeenNthCalledWith(2, 'line2\n')
    expect(mockWrite).toHaveBeenNthCalledWith(3, 'line3\n')
  })
})
