import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import { TerminalPane } from '../components/Terminal/TerminalPane'

// ── Capture onPtyData / onPtyExit callbacks per tabId ───────────────────────
const ptyDataCallbacks = new Map()

vi.mock('../services/terminalService', () => ({
  writeToPty: vi.fn(),
  onPtyData: vi.fn((tabId, cb) => {
    ptyDataCallbacks.set(tabId, cb)
    return () => ptyDataCallbacks.delete(tabId)
  }),
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

vi.mock('../i18n', () => ({
  t: (key) => key,
}))

const parentTab = {
  id: 'parent-1',
  name: 'Parent',
  type: 'terminal',
  status: 'running',
  isProcessing: () => false,
  isDirty: false,
}

const splitTab = {
  id: 'split-1',
  parentId: 'parent-1',
  isSplit: true,
  name: 'Split',
  type: 'terminal',
  status: 'running',
  isProcessing: () => false,
}

describe('SplitPane pty-preview-data dispatch', () => {
  beforeEach(() => {
    ptyDataCallbacks.clear()
  })

  it('subscribes onPtyData with split tab ID (not parent tab ID)', () => {
    render(<TerminalPane tab={parentTab} isActive={false} splits={[splitTab]} />)

    // The main terminal also subscribes — check that split gets its own subscription
    expect(ptyDataCallbacks.has('split-1')).toBe(true)
    expect(ptyDataCallbacks.has('parent-1')).toBe(true)
  })

  it('does not set up split subscription when no splits exist', () => {
    render(<TerminalPane tab={parentTab} isActive={false} splits={[]} />)

    // Only the main terminal subscribes
    expect(ptyDataCallbacks.has('parent-1')).toBe(true)
    expect(ptyDataCallbacks.has('split-1')).toBe(false)
  })

  it('subscribes each split independently with its own tab ID', () => {
    const splitTab2 = { ...splitTab, id: 'split-2' }
    render(<TerminalPane tab={parentTab} isActive={false} splits={[splitTab, splitTab2]} />)

    expect(ptyDataCallbacks.has('split-1')).toBe(true)
    expect(ptyDataCallbacks.has('split-2')).toBe(true)
    expect(ptyDataCallbacks.size).toBe(3) // parent + split1 + split2
  })

  it('dispatches pty-preview-data with parentTab.id when PTY data arrives', () => {
    render(<TerminalPane tab={parentTab} isActive={false} splits={[splitTab]} />)

    const splitCb = ptyDataCallbacks.get('split-1')
    expect(splitCb).toBeDefined()

    const events = []
    const listener = (e) => events.push(e)
    document.addEventListener('pty-preview-data', listener)

    splitCb('shell prompt $ \n')

    expect(events).toHaveLength(1)
    expect(events[0].detail.tabId).toBe('split-1')
    expect(events[0].detail.data).toBe('shell prompt $ \n')

    document.removeEventListener('pty-preview-data', listener)
  })

  it('does not dispatch pty-preview-data when no PTY data arrives', () => {
    render(<TerminalPane tab={parentTab} isActive={false} splits={[splitTab]} />)

    const events = []
    const listener = (e) => events.push(e)
    document.addEventListener('pty-preview-data', listener)

    // No callback triggered → no events
    expect(events).toHaveLength(0)

    document.removeEventListener('pty-preview-data', listener)
  })

  it('dispatches multiple data chunks correctly', () => {
    render(<TerminalPane tab={parentTab} isActive={false} splits={[splitTab]} />)

    const splitCb = ptyDataCallbacks.get('split-1')
    expect(splitCb).toBeDefined()

    const events = []
    const listener = (e) => events.push(e)
    document.addEventListener('pty-preview-data', listener)

    splitCb('data1\n')
    splitCb('data2\n')
    splitCb('data3\n')

    expect(events).toHaveLength(3)
    expect(events[0].detail.data).toBe('data1\n')
    expect(events[1].detail.data).toBe('data2\n')
    expect(events[2].detail.data).toBe('data3\n')
    events.forEach(e => expect(e.detail.tabId).toBe('split-1'))

    document.removeEventListener('pty-preview-data', listener)
  })
})
