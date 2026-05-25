import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { Tab } from '../components/TabBar/Tab'

const mockAppState = { tabs: [] }
vi.mock('../store/AppContext', () => ({
  useApp: () => ({
    state: mockAppState,
  })
}))

vi.mock('../i18n', () => ({
  t: (key) => key,
}))

const baseTab = (overrides = {}) => ({
  id: 'tab-1',
  name: 'test',
  type: 'terminal',
  status: 'running',
  isProcessing: () => false,
  isDirty: false,
  ...overrides,
})

describe('Tab', () => {
  beforeEach(() => {
    mockAppState.tabs = []
  })

  it('renders with correct data-id', () => {
    const { container } = render(
      <Tab id="tab-1" tab={baseTab()} isActive={false} index={0} totalTabs={1} />
    )
    expect(container.querySelector('[data-id="tab-1"]')).toBeTruthy()
  })

  it('renders home tab with home icon', () => {
    const { container } = render(
      <Tab id="home" isHome tab={null} isActive={false} />
    )
    expect(container.querySelector('[data-id="home"]')).toBeTruthy()
  })

  it('shows display label without dirty indicator', () => {
    const { getByText } = render(
      <Tab id="tab-1" tab={baseTab()} isActive={false} index={0} totalTabs={1} />
    )
    expect(getByText('test')).toBeTruthy()
  })

  it('shows dirty indicator asterisk', () => {
    const { getByText } = render(
      <Tab id="tab-1" tab={baseTab({ isDirty: true })} isActive={false} index={0} totalTabs={1} />
    )
    expect(getByText('* test')).toBeTruthy()
  })

  it('shows displayName when set', () => {
    const { getByText } = render(
      <Tab id="tab-1" tab={baseTab({ displayName: 'Custom' })} isActive={false} index={0} totalTabs={1} />
    )
    expect(getByText('Custom')).toBeTruthy()
  })

  it('renders without crashing when there are child splits', () => {
    mockAppState.tabs = [
      { id: 's1', parentId: 'tab-1', isSplit: true, type: 'terminal', status: 'running', isProcessing: () => true }
    ]
    const { container } = render(
      <Tab id="tab-1" tab={baseTab()} isActive={false} index={0} totalTabs={1} />
    )
    expect(container.querySelector('[data-id="tab-1"]')).toBeTruthy()
  })

  it('renders without crashing when child split is not processing', () => {
    mockAppState.tabs = [
      { id: 's1', parentId: 'tab-1', isSplit: true, type: 'terminal', status: 'running', isProcessing: () => false }
    ]
    const { container } = render(
      <Tab id="tab-1" tab={baseTab()} isActive={false} index={0} totalTabs={1} />
    )
    expect(container.querySelector('[data-id="tab-1"]')).toBeTruthy()
  })
})
