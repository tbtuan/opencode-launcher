import { describe, it, expect, beforeEach } from 'vitest'
import { getDirNameFromPath } from '../src/utils/helpers'
import { generateId } from '../src/services/configService'
import { generateTabId } from '../src/services/terminalService'

describe('getDirNameFromPath', () => {
  it('extracts directory name from unix path', () => {
    expect(getDirNameFromPath('/home/user/project')).toBe('project')
  })

  it('extracts directory name from windows path', () => {
    expect(getDirNameFromPath('C:\\Users\\Tuan\\project')).toBe('project')
  })

  it('extracts directory name from mixed separator path', () => {
    expect(getDirNameFromPath('/home/user\\subdir/mixed')).toBe('mixed')
  })

  it('extracts directory name from path with trailing slash', () => {
    expect(getDirNameFromPath('/home/user/project/')).toBe('project')
  })

  it('extracts directory name from path with trailing backslash', () => {
    expect(getDirNameFromPath('C:\\Users\\Tuan\\project\\')).toBe('project')
  })

  it('returns the path itself when there is no separator', () => {
    expect(getDirNameFromPath('project')).toBe('project')
  })

  it('handles empty string', () => {
    expect(getDirNameFromPath('')).toBe('')
  })
})

describe('generateId', () => {
  beforeEach(() => {
    // Reset module state by re-importing won't work, so test relative ordering
  })

  it('returns a unique number', () => {
    const a = generateId()
    const b = generateId()
    expect(b).toBe(a + 1)
  })

  it('returns consecutive integers', () => {
    const ids = Array.from({ length: 10 }, () => generateId())
    for (let i = 1; i < ids.length; i++) {
      expect(ids[i]).toBe(ids[i - 1] + 1)
    }
  })

  it('returns a number type', () => {
    expect(typeof generateId()).toBe('number')
  })
})

describe('generateTabId', () => {
  beforeEach(() => {
    // Reset module state by re-importing won't work, so test relative ordering
  })

  it('returns a string with tab- prefix', () => {
    expect(generateTabId()).toMatch(/^tab-\d+$/)
  })

  it('returns unique ids', () => {
    const a = generateTabId()
    const b = generateTabId()
    expect(a).not.toBe(b)
  })

  it('increments the numeric suffix', () => {
    const a = parseInt(generateTabId().replace('tab-', ''), 10)
    const b = parseInt(generateTabId().replace('tab-', ''), 10)
    expect(b).toBe(a + 1)
  })
})
