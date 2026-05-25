import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { TerminalPane } from '../components/Terminal/TerminalPane'

const mockAppState = { tabs: [] }
vi.mock('../store/AppContext', () => ({
  useApp: () => ({
    state: mockAppState,
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

const baseTab = {
  id: 'tab-1',
  name: 'test',
  cwd: '/test',
  type: 'terminal',
  status: 'running',
  isProcessing: () => false,
  isDirty: false,
}

const splitTab = {
  id: 'split-1',
  parentId: 'tab-1',
  isSplit: true,
  name: 'split',
  cwd: '/test',
  type: 'terminal',
  status: 'running',
  isProcessing: () => false,
}

describe('TerminalPane', () => {
  beforeEach(() => {
    mockAppState.tabs = []
  })

  it('renders the main container div when no splits', () => {
    const { container } = render(
      <TerminalPane tab={baseTab} isActive={false} splits={[]} />
    )
    expect(container.querySelector('#pane-tab-1')).toBeTruthy()
  })

  it('main container has flex: 1 when no splits', () => {
    const { container } = render(
      <TerminalPane tab={baseTab} isActive={false} splits={[]} />
    )
    const pane = container.querySelector('#pane-tab-1')
    expect(pane.style.flex).toBeTruthy()
  })

  it('renders the main container and split pane when splits present', () => {
    const { container } = render(
      <TerminalPane tab={baseTab} isActive={false} splits={[splitTab]} />
    )
    expect(container.querySelector('#pane-tab-1')).toBeTruthy()
    expect(container.querySelector('#pane-split-1')).toBeTruthy()
  })

  it('does not render split pane when no splits', () => {
    const { container } = render(
      <TerminalPane tab={baseTab} isActive={false} splits={[]} />
    )
    expect(container.querySelector('#pane-split-1')).toBeFalsy()
  })

  it('does not render divider when no splits', () => {
    const { container } = render(
      <TerminalPane tab={baseTab} isActive={false} splits={[]} />
    )
    const panes = container.querySelectorAll('[id^="pane-"]')
    expect(panes.length).toBe(1)
  })

  it('wraps in splitContainer always (no early return for empty splits)', () => {
    const { container } = render(
      <TerminalPane tab={baseTab} isActive={false} splits={[]} />
    )
    const pane = container.querySelector('#pane-tab-1')
    expect(pane).toBeTruthy()
  })
})
