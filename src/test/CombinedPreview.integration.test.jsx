import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'

// ── Shared mock terminal ref (for PreviewCard) ───────────────────────────────
const ptyDataCallbacks = new Map()
const mockPreviewWrite = vi.fn()
const mockPreviewResize = vi.fn()
const mockPreviewTerminalRef = { current: null }

// ── Mocks ────────────────────────────────────────────────────────────────────
// Mock BEFORE imports (vi.mock is hoisted)

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
  getTerminalDimensions: vi.fn(() => ({ cols: 80, rows: 24 })),
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

vi.mock('../hooks/usePreviewTerminal', () => ({
  usePreviewTerminal: () => mockPreviewTerminalRef,
}))

vi.mock('../services/api', () => ({
  api: {
    openFolder: vi.fn(() => Promise.resolve(null)),
    readResource: vi.fn(() => Promise.resolve('')),
  }
}))

vi.mock('../services/configService', () => ({
  generateId: vi.fn(() => 12345),
}))

vi.mock('../i18n', () => ({
  t: (key) => key,
}))

// ── Now import components ────────────────────────────────────────────────────
import { TerminalPane } from '../components/Terminal/TerminalPane'
import { PreviewCard } from '../components/Dashboard/PreviewSection/PreviewCard'

const parentTab = {
  id: 'parent-1',
  name: 'Parent',
  displayName: 'Parent',
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
  displayName: 'Split',
  type: 'terminal',
  status: 'running',
  isProcessing: () => false,
}

describe('CombinedPreview — full integration', () => {
  beforeEach(() => {
    ptyDataCallbacks.clear()
    mockPreviewTerminalRef.current = { write: mockPreviewWrite, resize: mockPreviewResize, dispose: vi.fn() }
    mockPreviewWrite.mockClear()
    mockPreviewResize.mockClear()
  })

  afterEach(() => {
    mockPreviewTerminalRef.current = null
  })

  it('data flows to parent PreviewCard with splits', () => {
    // PreviewCard now receives splits and renders a PreviewTerminal for each
    render(<>
      <TerminalPane tab={parentTab} isActive={true} splits={[splitTab]} />
      <PreviewCard tab={parentTab} cols={80} rows={24} isProcessing={false}
        onClick={vi.fn()}
        splits={[{ tab: splitTab, cols: 80, rows: 12, isProcessing: false, splitRatio: 0.5 }]}
      />
    </>)

    // Simulate PTY data arriving for the split tab
    const splitCb = ptyDataCallbacks.get('split-1')
    expect(splitCb).toBeDefined()
    splitCb('split terminal output\n')

    // Parent PreviewCard contains a PreviewTerminal for the split tab
    expect(mockPreviewWrite).toHaveBeenCalledTimes(1)
    expect(mockPreviewWrite).toHaveBeenCalledWith('split terminal output\n')
  })

  it('both parent and split data arrive at same PreviewCard', () => {
    render(<>
      <TerminalPane tab={parentTab} isActive={true} splits={[splitTab]} />
      <PreviewCard tab={parentTab} cols={80} rows={24} isProcessing={false}
        onClick={vi.fn()}
        splits={[{ tab: splitTab, cols: 80, rows: 12, isProcessing: false, splitRatio: 0.5 }]}
      />
    </>)

    // Parent PTY data
    const parentCb = ptyDataCallbacks.get('parent-1')
    expect(parentCb).toBeDefined()
    parentCb('parent output\n')

    // Split PTY data
    const splitCb = ptyDataCallbacks.get('split-1')
    expect(splitCb).toBeDefined()
    splitCb('split output\n')

    expect(mockPreviewWrite).toHaveBeenCalledTimes(2)
    expect(mockPreviewWrite).toHaveBeenNthCalledWith(1, 'parent output\n')
    expect(mockPreviewWrite).toHaveBeenNthCalledWith(2, 'split output\n')
  })

  it('PreviewCard ignores data for unknown split tabs', () => {
    // PreviewCard for parent-1 without splits should ignore split-1 data
    render(<>
      <TerminalPane tab={parentTab} isActive={true} splits={[splitTab]} />
      <PreviewCard tab={parentTab} cols={80} rows={24} isProcessing={false}
        onClick={vi.fn()}
        splits={[]}
      />
    </>)

    const splitCb = ptyDataCallbacks.get('split-1')
    expect(splitCb).toBeDefined()
    splitCb('data for split\n')

    // No PreviewTerminal for the split tab → no write
    expect(mockPreviewWrite).not.toHaveBeenCalled()
  })
})
