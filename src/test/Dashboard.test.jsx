import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { Dashboard } from '../components/Dashboard/Dashboard'

const mockAppState = {
  savedDirectories: [],
  tabs: [],
  modelsTimestamp: null,
  flagDe: '',
  flagEn: '',
}
vi.mock('../store/AppContext', () => ({
  useApp: () => ({
    state: mockAppState,
    removeDirectory: vi.fn(),
    moveDirectory: vi.fn(),
  })
}))

vi.mock('../hooks/usePreviewTerminal', () => ({
  usePreviewTerminal: () => ({ current: null }),
}))

vi.mock('../services/terminalService', () => ({
  getTerminalDimensions: vi.fn(() => ({ cols: 80, rows: 24 })),
}))

vi.mock('../services/configService', () => ({
  generateId: vi.fn(() => 12345),
}))

vi.mock('../services/api', () => ({
  api: {
    openFolder: vi.fn(() => Promise.resolve(null)),
    readResource: vi.fn(() => Promise.resolve('')),
  }
}))

vi.mock('../i18n', () => ({
  t: (key) => key,
}))

const runningTab = (id, overrides = {}) => ({
  id,
  name: `tab-${id}`,
  type: 'terminal',
  status: 'running',
  isProcessing: () => false,
  isDirty: false,
  ...overrides,
})

describe('Dashboard', () => {
  beforeEach(() => {
    mockAppState.savedDirectories = []
    mockAppState.tabs = []
  })

  it('renders without crashing with no tabs or directories', () => {
    const { container } = render(
      <Dashboard onOpenTerminal={vi.fn()} onCloseTab={vi.fn()} onRestartTerminal={vi.fn()} />
    )
    expect(container.querySelector('#dashboard')).toBeTruthy()
  })

  it('shows no preview section when there are no running tabs', () => {
    const { container } = render(
      <Dashboard onOpenTerminal={vi.fn()} onCloseTab={vi.fn()} onRestartTerminal={vi.fn()} />
    )
    expect(container.querySelector('#preview-section')).toBeFalsy()
  })

  it('shows preview cards for running non-split terminal tabs', () => {
    mockAppState.tabs = [
      runningTab('t1'),
    ]
    const { container } = render(
      <Dashboard onOpenTerminal={vi.fn()} onCloseTab={vi.fn()} onRestartTerminal={vi.fn()} />
    )
    expect(container.querySelector('#preview-section')).toBeTruthy()
    expect(container.querySelector('[data-tab-id="t1"]')).toBeTruthy()
  })

  it('excludes split tabs from main previews list', () => {
    mockAppState.tabs = [
      runningTab('main', { isProcessing: () => false }),
      runningTab('split-1', { isSplit: true, parentId: 'main' }),
    ]
    const { container } = render(
      <Dashboard onOpenTerminal={vi.fn()} onCloseTab={vi.fn()} onRestartTerminal={vi.fn()} />
    )
    // Main tab gets a preview card (which may contain the split inside)
    expect(container.querySelector('[data-tab-id="main"]')).toBeTruthy()
    // Split is NOT rendered as its own preview card
    expect(container.querySelector('[data-tab-id="split-1"]')).toBeFalsy()
  })

  it('excludes editor tabs from previews', () => {
    mockAppState.tabs = [
      runningTab('t1'),
      runningTab('editor', { type: 'editor' }),
    ]
    const { container } = render(
      <Dashboard onOpenTerminal={vi.fn()} onCloseTab={vi.fn()} onRestartTerminal={vi.fn()} />
    )
    expect(container.querySelector('[data-tab-id="t1"]')).toBeTruthy()
    expect(container.querySelector('[data-tab-id="editor"]')).toBeFalsy()
  })

  it('excludes stopped tabs from previews', () => {
    mockAppState.tabs = [
      runningTab('t1'),
      runningTab('stopped', { status: 'stopped' }),
    ]
    const { container } = render(
      <Dashboard onOpenTerminal={vi.fn()} onCloseTab={vi.fn()} onRestartTerminal={vi.fn()} />
    )
    expect(container.querySelector('[data-tab-id="t1"]')).toBeTruthy()
    expect(container.querySelector('[data-tab-id="stopped"]')).toBeFalsy()
  })
})
